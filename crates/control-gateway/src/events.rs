use serde::Serialize;
use time::OffsetDateTime;
use tokio::sync::broadcast;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OperationEvent {
    pub operation_id: String,
    pub repository: String,
    pub operation: String,
    pub phase: OperationPhase,
    pub message: String,
    pub timestamp: OffsetDateTime,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum OperationPhase {
    Prepared,
    Started,
    Succeeded,
    Failed,
}

#[derive(Clone)]
pub struct EventBus {
    sender: broadcast::Sender<OperationEvent>,
}

impl EventBus {
    pub fn new() -> Self {
        let (sender, _) = broadcast::channel(256);
        Self { sender }
    }

    pub fn subscribe(&self) -> broadcast::Receiver<OperationEvent> {
        self.sender.subscribe()
    }

    pub fn publish(&self, event: OperationEvent) {
        let _ = self.sender.send(event);
    }
}
