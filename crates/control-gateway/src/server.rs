use std::{convert::Infallible, net::SocketAddr, path::Path};

use anyhow::{Context, Result};
use async_graphql::{http::GraphiQLSource, Request, Response};
use async_stream::stream;
use axum::{
    extract::State,
    http::{header, HeaderMap, StatusCode},
    response::{
        sse::{Event, KeepAlive, Sse},
        Html, IntoResponse,
    },
    routing::{get, post},
    Json, Router,
};
use serde::Serialize;
use tokio::{net::TcpListener, sync::watch};

use crate::{
    api::{build_state, schema, validate_root, AppState, GatewaySchema},
    cli::Args,
    events::EventBus,
    operations::OperationManager,
};

#[derive(Clone)]
struct HttpState {
    schema: GatewaySchema,
    app: AppState,
    events: EventBus,
}

#[derive(Clone)]
struct AdminState {
    stop: watch::Sender<bool>,
    token: Option<std::sync::Arc<str>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Manifest {
    api_url: String,
    graphql_url: String,
    events_url: String,
    admin_url: String,
    version: String,
    pid: u32,
    token_required: bool,
    started_at: time::OffsetDateTime,
}

pub async fn run(args: Args) -> Result<()> {
    let catalog = validate_root(args.root)?;
    let events = EventBus::new();
    let operations = OperationManager::new(catalog.clone(), events.clone());
    let api_token = resolve_api_token(args.token, args.token_file.as_deref()).await?;
    let admin_token = read_optional_token_file(args.admin_token_file.as_deref()).await?;
    let app_state = build_state(catalog, operations, api_token);
    let schema = schema(app_state.clone());

    let public_listener = TcpListener::bind(SocketAddr::new(args.host, args.port))
        .await
        .with_context(|| format!("cannot bind public listener on {}:{}", args.host, args.port))?;
    let public_addr = public_listener.local_addr()?;
    let admin_listener = TcpListener::bind(SocketAddr::new(args.host, args.admin_port))
        .await
        .with_context(|| {
            format!(
                "cannot bind admin listener on {}:{}",
                args.host, args.admin_port
            )
        })?;
    let admin_addr = admin_listener.local_addr()?;

    if let Some(path) = args.manifest {
        let manifest = Manifest {
            api_url: format!("http://{public_addr}"),
            graphql_url: format!("http://{public_addr}/graphql"),
            events_url: format!("http://{public_addr}/events"),
            admin_url: format!("http://{admin_addr}"),
            version: env!("CARGO_PKG_VERSION").to_string(),
            pid: std::process::id(),
            token_required: app_state.token.is_some(),
            started_at: time::OffsetDateTime::now_utc(),
        };
        let content = serde_json::to_vec_pretty(&manifest)?;
        tokio::fs::write(&path, content)
            .await
            .with_context(|| format!("cannot write manifest {}", path.display()))?;
    }

    let (stop_tx, stop_rx) = watch::channel(false);
    let public_router = public_router(HttpState {
        schema,
        app: app_state,
        events,
    });
    let admin_router = admin_router(AdminState {
        stop: stop_tx,
        token: admin_token.map(std::sync::Arc::from),
    });

    eprintln!("control-gateway listening on http://{public_addr}; admin http://{admin_addr}");

    let public = axum::serve(public_listener, public_router)
        .with_graceful_shutdown(wait_for_stop(stop_rx.clone()));
    let admin =
        axum::serve(admin_listener, admin_router).with_graceful_shutdown(wait_for_stop(stop_rx));

    tokio::try_join!(public, admin)?;
    Ok(())
}

fn public_router(state: HttpState) -> Router {
    Router::new()
        .route("/", get(graphiql))
        .route("/graphql", post(graphql))
        .route("/events", get(events))
        .with_state(state)
}

fn admin_router(state: AdminState) -> Router {
    Router::new()
        .route("/", get(admin_index))
        .route("/stop", post(stop))
        .with_state(state)
}

async fn graphiql() -> Html<String> {
    Html(GraphiQLSource::build().endpoint("/graphql").finish())
}

async fn graphql(
    State(state): State<HttpState>,
    headers: HeaderMap,
    Json(request): Json<Request>,
) -> impl IntoResponse {
    if let Err(status) = authorize(&state.app, &headers) {
        return status.into_response();
    }
    Json::<Response>(state.schema.execute(request).await).into_response()
}

async fn events(
    State(state): State<HttpState>,
    headers: HeaderMap,
) -> Result<Sse<impl futures_core::Stream<Item = Result<Event, Infallible>>>, StatusCode> {
    authorize(&state.app, &headers)?;
    let mut receiver = state.events.subscribe();
    let stream = stream! {
        while let Ok(event) = receiver.recv().await {
            let payload = match serde_json::to_string(&event) {
                Ok(payload) => payload,
                Err(_) => continue,
            };
            yield Ok(Event::default().event("operation").data(payload));
        }
    };
    Ok(Sse::new(stream).keep_alive(KeepAlive::default()))
}

async fn admin_index() -> Html<&'static str> {
    Html(
        r#"<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Control Gateway</title>
    <style>
      body { margin: 0; font-family: system-ui, sans-serif; background: #f7f7f8; color: #111827; }
      form { position: fixed; top: 12px; left: 12px; }
      button { border: 1px solid #d1d5db; border-radius: 6px; background: white; padding: 8px 12px; font: inherit; }
    </style>
  </head>
  <body>
    <form method="post" action="/stop"><button type="submit">Stop gateway</button></form>
  </body>
</html>"#,
    )
}

async fn stop(State(state): State<AdminState>, headers: HeaderMap) -> StatusCode {
    if authorize_token(state.token.as_deref(), &headers).is_err() {
        return StatusCode::UNAUTHORIZED;
    }
    let _ = state.stop.send(true);
    StatusCode::ACCEPTED
}

async fn wait_for_stop(mut stop: watch::Receiver<bool>) {
    loop {
        if *stop.borrow() {
            return;
        }
        if stop.changed().await.is_err() {
            return;
        }
    }
}

fn authorize(state: &AppState, headers: &HeaderMap) -> Result<(), StatusCode> {
    authorize_token(state.token.as_deref(), headers)
}

fn authorize_token(token: Option<&str>, headers: &HeaderMap) -> Result<(), StatusCode> {
    let Some(token) = token else {
        return Ok(());
    };
    let bearer = headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "));
    let explicit = headers
        .get("x-control-token")
        .and_then(|value| value.to_str().ok());
    if bearer == Some(token) || explicit == Some(token) {
        Ok(())
    } else {
        Err(StatusCode::UNAUTHORIZED)
    }
}

async fn resolve_api_token(
    token: Option<String>,
    token_file: Option<&Path>,
) -> Result<Option<String>> {
    Ok(match token_file {
        Some(path) => Some(read_token_file(path).await?),
        None => token,
    })
}

async fn read_optional_token_file(path: Option<&Path>) -> Result<Option<String>> {
    match path {
        Some(path) => read_token_file(path).await.map(Some),
        None => Ok(None),
    }
}

async fn read_token_file(path: &Path) -> Result<String> {
    let content = tokio::fs::read_to_string(path)
        .await
        .with_context(|| format!("cannot read token file {}", path.display()))?;
    let _ = tokio::fs::remove_file(path).await;
    let token = content.trim_end_matches(&['\r', '\n'][..]).to_string();
    anyhow::ensure!(
        !token.trim().is_empty(),
        "token file {} did not contain a token",
        path.display()
    );
    Ok(token)
}

#[cfg(test)]
mod tests {
    use std::fs;

    use axum::{
        body::to_bytes,
        body::Body,
        http::{Request as HttpRequest, StatusCode},
    };
    use tempfile::{tempdir, TempDir};
    use tower::ServiceExt;

    use super::*;

    fn test_public_router(token: Option<&str>) -> (Router, TempDir) {
        let root = tempdir().unwrap();
        fs::create_dir_all(root.path().join("repo/.git")).unwrap();
        let catalog = validate_root(root.path().to_path_buf()).unwrap();
        let events = EventBus::new();
        let operations = OperationManager::new(catalog.clone(), events.clone());
        let app = build_state(catalog, operations, token.map(str::to_string));
        let router = public_router(HttpState {
            schema: schema(app.clone()),
            app,
            events,
        });
        (router, root)
    }

    fn test_admin_router(token: Option<&str>) -> (Router, watch::Receiver<bool>) {
        let (stop, receiver) = watch::channel(false);
        let router = admin_router(AdminState {
            stop,
            token: token.map(std::sync::Arc::from),
        });
        (router, receiver)
    }

    #[tokio::test]
    async fn graphql_requires_token_when_configured() {
        let (router, _root) = test_public_router(Some("secret"));

        let response = router
            .oneshot(
                HttpRequest::builder()
                    .method("POST")
                    .uri("/graphql")
                    .header(header::CONTENT_TYPE, "application/json")
                    .body(Body::from(r#"{"query":"{ repositories { id } }"}"#))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn graphql_accepts_matching_token_when_configured() {
        let (router, _root) = test_public_router(Some("secret"));

        let response = router
            .oneshot(
                HttpRequest::builder()
                    .method("POST")
                    .uri("/graphql")
                    .header(header::AUTHORIZATION, "Bearer secret")
                    .header(header::CONTENT_TYPE, "application/json")
                    .body(Body::from(r#"{"query":"{ repositories { id vcs } }"}"#))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
        let text = String::from_utf8(body.to_vec()).unwrap();
        assert!(text.contains("repo"));
        assert!(text.contains("GIT"));
    }

    #[tokio::test]
    async fn graphql_lists_repositories_without_token() {
        let (router, _root) = test_public_router(None);

        let response = router
            .oneshot(
                HttpRequest::builder()
                    .method("POST")
                    .uri("/graphql")
                    .header(header::CONTENT_TYPE, "application/json")
                    .body(Body::from(r#"{"query":"{ repositories { id vcs } }"}"#))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
        let text = String::from_utf8(body.to_vec()).unwrap();
        assert!(text.contains("repo"));
        assert!(text.contains("GIT"));
    }

    #[tokio::test]
    async fn stop_requires_admin_token_when_configured() {
        let (router, receiver) = test_admin_router(Some("admin-secret"));

        let response = router
            .oneshot(
                HttpRequest::builder()
                    .method("POST")
                    .uri("/stop")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
        assert!(!*receiver.borrow());
    }

    #[tokio::test]
    async fn stop_rejects_wrong_admin_token() {
        let (router, receiver) = test_admin_router(Some("admin-secret"));

        let response = router
            .oneshot(
                HttpRequest::builder()
                    .method("POST")
                    .uri("/stop")
                    .header(header::AUTHORIZATION, "Bearer wrong")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
        assert!(!*receiver.borrow());
    }

    #[tokio::test]
    async fn stop_accepts_matching_admin_token() {
        let (router, receiver) = test_admin_router(Some("admin-secret"));

        let response = router
            .oneshot(
                HttpRequest::builder()
                    .method("POST")
                    .uri("/stop")
                    .header(header::AUTHORIZATION, "Bearer admin-secret")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::ACCEPTED);
        assert!(*receiver.borrow());
    }

    #[tokio::test]
    async fn reading_token_file_removes_it() {
        let root = tempdir().unwrap();
        let token_path = root.path().join("token");
        fs::write(&token_path, "secret\n").unwrap();

        let token = read_token_file(&token_path).await.unwrap();

        assert_eq!(token, "secret");
        assert!(!token_path.exists());
    }
}
