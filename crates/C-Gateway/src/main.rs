mod api;
mod cli;
mod events;
mod operations;
mod repository;
mod server;

use anyhow::Result;
use clap::Parser;
use cli::Args;

#[tokio::main]
async fn main() -> Result<()> {
    server::run(Args::parse()).await
}
