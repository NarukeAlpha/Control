use std::sync::Arc;

use anyhow::Result;
use async_graphql::{Context, EmptySubscription, Error, Object, Schema};

use crate::{
    operations::{
        OperationInput, OperationManager, OperationPreview, OperationResult, RunOperationInput,
    },
    repository::{
        ContentEntry, FileContent, RepositoryCatalog, RepositoryInfo, Territory, VcsKind,
    },
};

pub type GatewaySchema = Schema<QueryRoot, MutationRoot, EmptySubscription>;

#[derive(Clone)]
pub struct AppState {
    pub catalog: RepositoryCatalog,
    pub operations: OperationManager,
    pub token: Option<Arc<str>>,
}

pub struct QueryRoot;
pub struct MutationRoot;

pub fn schema(state: AppState) -> GatewaySchema {
    Schema::build(QueryRoot, MutationRoot, EmptySubscription)
        .data(state.catalog)
        .data(state.operations)
        .finish()
}

#[Object]
impl QueryRoot {
    async fn territory(&self, ctx: &Context<'_>) -> async_graphql::Result<Territory> {
        let catalog = catalog(ctx)?;
        Ok(Territory {
            root: catalog.root().display().to_string(),
            repositories: catalog.discover().map_err(to_graphql_error)?,
        })
    }

    async fn repositories(&self, ctx: &Context<'_>) -> async_graphql::Result<Vec<RepositoryInfo>> {
        catalog(ctx)?.discover().map_err(to_graphql_error)
    }

    async fn repository(
        &self,
        ctx: &Context<'_>,
        id: String,
    ) -> async_graphql::Result<Option<RepositoryInfo>> {
        catalog(ctx)?.find(&id).map_err(to_graphql_error)
    }

    async fn status(
        &self,
        ctx: &Context<'_>,
        repository: String,
        vcs: Option<VcsKind>,
    ) -> async_graphql::Result<OperationResult> {
        operations(ctx)?
            .status(repository, vcs)
            .await
            .map_err(to_graphql_error)
    }

    async fn contents(
        &self,
        ctx: &Context<'_>,
        repository: String,
        path: Option<String>,
    ) -> async_graphql::Result<Vec<ContentEntry>> {
        catalog(ctx)?
            .list_contents(&repository, path.as_deref())
            .map_err(to_graphql_error)
    }

    async fn file_content(
        &self,
        ctx: &Context<'_>,
        repository: String,
        path: String,
    ) -> async_graphql::Result<FileContent> {
        catalog(ctx)?
            .read_file(&repository, &path)
            .map_err(to_graphql_error)
    }
}

#[Object]
impl MutationRoot {
    async fn prepare_operation(
        &self,
        ctx: &Context<'_>,
        input: OperationInput,
    ) -> async_graphql::Result<OperationPreview> {
        operations(ctx)?
            .prepare(input)
            .await
            .map_err(to_graphql_error)
    }

    async fn run_operation(
        &self,
        ctx: &Context<'_>,
        input: RunOperationInput,
    ) -> async_graphql::Result<OperationResult> {
        operations(ctx)?.run(input).await.map_err(to_graphql_error)
    }
}

fn catalog<'a>(ctx: &'a Context<'_>) -> async_graphql::Result<&'a RepositoryCatalog> {
    ctx.data::<RepositoryCatalog>()
        .map_err(|error| Error::new(error.message))
}

fn operations<'a>(ctx: &'a Context<'_>) -> async_graphql::Result<&'a OperationManager> {
    ctx.data::<OperationManager>()
        .map_err(|error| Error::new(error.message))
}

fn to_graphql_error(error: anyhow::Error) -> Error {
    Error::new(error.to_string())
}

pub fn build_state(
    catalog: RepositoryCatalog,
    operations: OperationManager,
    token: Option<String>,
) -> AppState {
    AppState {
        catalog,
        operations,
        token: token.map(Arc::from),
    }
}

pub fn validate_root(root: std::path::PathBuf) -> Result<RepositoryCatalog> {
    RepositoryCatalog::new(root)
}
