use std::{net::IpAddr, path::PathBuf};

use clap::Parser;

#[derive(Debug, Clone, Parser)]
#[command(name = "control-gateway", about = "Local Control gateway")]
pub struct Args {
    #[arg(long)]
    pub root: PathBuf,

    #[arg(long, default_value = "127.0.0.1")]
    pub host: IpAddr,

    #[arg(long, default_value_t = 0)]
    pub port: u16,

    #[arg(long, default_value_t = 0)]
    pub admin_port: u16,

    #[arg(long)]
    pub token: Option<String>,

    #[arg(long)]
    pub token_file: Option<PathBuf>,

    #[arg(long)]
    pub admin_token_file: Option<PathBuf>,

    #[arg(long)]
    pub manifest: Option<PathBuf>,
}
