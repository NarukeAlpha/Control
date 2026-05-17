use std::{collections::HashMap, path::PathBuf, sync::Arc};

use anyhow::{bail, Context, Result};
use async_graphql::{Enum, InputObject, SimpleObject};
use tokio::{process::Command, sync::Mutex};
use uuid::Uuid;

use crate::{
    events::{EventBus, OperationEvent, OperationPhase},
    repository::{RepositoryCatalog, VcsKind},
};

#[derive(Clone, Copy, Debug, Eq, PartialEq, Enum)]
pub enum OperationKind {
    Fetch,
    Push,
    Status,
}

#[derive(Clone, Debug, InputObject)]
pub struct OperationInput {
    pub repository: String,
    pub vcs: Option<VcsKind>,
    pub operation: OperationKind,
}

#[derive(Clone, Debug, InputObject)]
pub struct RunOperationInput {
    pub confirmation_id: String,
}

#[derive(Clone, Debug, SimpleObject)]
pub struct OperationPreview {
    pub confirmation_id: String,
    pub repository: String,
    pub vcs: VcsKind,
    pub operation: OperationKind,
    pub command: Vec<String>,
    pub requires_confirmation: bool,
}

#[derive(Clone, Debug, SimpleObject)]
pub struct OperationResult {
    pub operation_id: String,
    pub repository: String,
    pub vcs: VcsKind,
    pub operation: OperationKind,
    pub command: Vec<String>,
    pub exit_code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
}

#[derive(Clone)]
pub struct OperationManager {
    catalog: RepositoryCatalog,
    events: EventBus,
    previews: Arc<Mutex<HashMap<String, OperationPreview>>>,
}

impl OperationManager {
    pub fn new(catalog: RepositoryCatalog, events: EventBus) -> Self {
        Self {
            catalog,
            events,
            previews: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn prepare(&self, input: OperationInput) -> Result<OperationPreview> {
        let repo = self
            .catalog
            .find(&input.repository)?
            .with_context(|| format!("repository not found: {}", input.repository))?;
        let vcs = input.vcs.unwrap_or_else(|| repo.vcs[0]);
        if !repo.vcs.contains(&vcs) {
            bail!("repository {} does not support {:?}", repo.id, vcs);
        }

        let command = command_for(vcs, input.operation);
        let preview = OperationPreview {
            confirmation_id: Uuid::new_v4().to_string(),
            repository: repo.id,
            vcs,
            operation: input.operation,
            command,
            requires_confirmation: true,
        };

        self.previews
            .lock()
            .await
            .insert(preview.confirmation_id.clone(), preview.clone());
        self.events.publish(OperationEvent {
            operation_id: preview.confirmation_id.clone(),
            repository: preview.repository.clone(),
            operation: format!("{:?}", preview.operation),
            phase: OperationPhase::Prepared,
            message: "operation preview prepared".to_string(),
            timestamp: time::OffsetDateTime::now_utc(),
        });
        Ok(preview)
    }

    pub async fn run(&self, input: RunOperationInput) -> Result<OperationResult> {
        let preview = self
            .previews
            .lock()
            .await
            .remove(&input.confirmation_id)
            .with_context(|| format!("confirmation not found: {}", input.confirmation_id))?;
        let operation_id = Uuid::new_v4().to_string();
        let repository_path = self.catalog.resolve_repository(&preview.repository)?;

        self.publish(
            &operation_id,
            &preview,
            OperationPhase::Started,
            "operation started",
        );
        let output = run_command(&repository_path, &preview.command).await;
        match output {
            Ok(result) => {
                let phase = if result.exit_code == Some(0) {
                    OperationPhase::Succeeded
                } else {
                    OperationPhase::Failed
                };
                let message = if result.exit_code == Some(0) {
                    "operation succeeded"
                } else {
                    "operation failed"
                };
                self.publish(&operation_id, &preview, phase, message);
                Ok(OperationResult {
                    operation_id,
                    repository: preview.repository,
                    vcs: preview.vcs,
                    operation: preview.operation,
                    command: preview.command,
                    exit_code: result.exit_code,
                    stdout: result.stdout,
                    stderr: result.stderr,
                })
            }
            Err(error) => {
                self.publish(
                    &operation_id,
                    &preview,
                    OperationPhase::Failed,
                    &error.to_string(),
                );
                Err(error)
            }
        }
    }

    pub async fn status(
        &self,
        repository: String,
        vcs: Option<VcsKind>,
    ) -> Result<OperationResult> {
        let preview = self
            .prepare(OperationInput {
                repository,
                vcs,
                operation: OperationKind::Status,
            })
            .await?;
        self.run(RunOperationInput {
            confirmation_id: preview.confirmation_id,
        })
        .await
    }

    fn publish(
        &self,
        operation_id: &str,
        preview: &OperationPreview,
        phase: OperationPhase,
        message: &str,
    ) {
        self.events.publish(OperationEvent {
            operation_id: operation_id.to_string(),
            repository: preview.repository.clone(),
            operation: format!("{:?}", preview.operation),
            phase,
            message: message.to_string(),
            timestamp: time::OffsetDateTime::now_utc(),
        });
    }
}

struct CommandResult {
    exit_code: Option<i32>,
    stdout: String,
    stderr: String,
}

async fn run_command(repository_path: &PathBuf, command: &[String]) -> Result<CommandResult> {
    let (program, args) = command
        .split_first()
        .context("operation command is empty")?;
    let output = Command::new(program)
        .args(args)
        .current_dir(repository_path)
        .output()
        .await
        .with_context(|| format!("failed to run {}", command.join(" ")))?;
    Ok(CommandResult {
        exit_code: output.status.code(),
        stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
        stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
    })
}

fn command_for(vcs: VcsKind, operation: OperationKind) -> Vec<String> {
    let parts: &[&str] = match (vcs, operation) {
        (VcsKind::Git, OperationKind::Fetch) => &["git", "fetch"],
        (VcsKind::Git, OperationKind::Push) => &["git", "push"],
        (VcsKind::Git, OperationKind::Status) => &["git", "status", "--short", "--branch"],
        (VcsKind::Jj, OperationKind::Fetch) => &["jj", "git", "fetch"],
        (VcsKind::Jj, OperationKind::Push) => &["jj", "git", "push"],
        (VcsKind::Jj, OperationKind::Status) => &["jj", "status"],
    };
    parts.iter().map(|part| (*part).to_string()).collect()
}

#[cfg(test)]
mod tests {
    use std::fs;

    use tempfile::tempdir;

    use super::*;

    #[tokio::test]
    async fn prepares_git_status_with_confirmation() {
        let root = tempdir().unwrap();
        fs::create_dir_all(root.path().join("repo/.git")).unwrap();
        let catalog = RepositoryCatalog::new(root.path().to_path_buf()).unwrap();
        let manager = OperationManager::new(catalog, EventBus::new());

        let preview = manager
            .prepare(OperationInput {
                repository: "repo".to_string(),
                vcs: Some(VcsKind::Git),
                operation: OperationKind::Status,
            })
            .await
            .unwrap();

        assert!(preview.requires_confirmation);
        assert_eq!(preview.command, ["git", "status", "--short", "--branch"]);
    }
}
