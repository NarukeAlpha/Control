use std::{
    collections::HashSet,
    fs,
    path::{Path, PathBuf},
};

use anyhow::{bail, Context, Result};
use async_graphql::{Enum, SimpleObject};
use serde::Serialize;

const MAX_DISCOVERY_DEPTH: usize = 8;

#[derive(Clone, Copy, Debug, Eq, PartialEq, Enum, Serialize)]
pub enum VcsKind {
    Git,
    Jj,
}

#[derive(Clone, Debug, SimpleObject, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepositoryInfo {
    pub id: String,
    pub name: String,
    pub path: String,
    pub vcs: Vec<VcsKind>,
}

#[derive(Clone, Debug, SimpleObject)]
pub struct Territory {
    pub root: String,
    pub repositories: Vec<RepositoryInfo>,
}

#[derive(Clone, Debug, SimpleObject)]
pub struct ContentEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: Option<u64>,
}

#[derive(Clone, Debug, SimpleObject)]
pub struct FileContent {
    pub path: String,
    pub content: String,
}

#[derive(Clone)]
pub struct RepositoryCatalog {
    root: PathBuf,
}

impl RepositoryCatalog {
    pub fn new(root: PathBuf) -> Result<Self> {
        let requested_root = root.clone();
        let root = expand_home(root)
            .canonicalize()
            .with_context(|| format!("cannot resolve root {}", requested_root.display()))?;
        if !root.is_dir() {
            bail!("root is not a directory: {}", root.display());
        }
        Ok(Self { root })
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    pub fn discover(&self) -> Result<Vec<RepositoryInfo>> {
        let mut repos = Vec::new();
        let mut seen = HashSet::new();
        self.visit(&self.root, 0, &mut repos, &mut seen)?;
        repos.sort_by(|left, right| left.id.cmp(&right.id));
        Ok(repos)
    }

    pub fn find(&self, id: &str) -> Result<Option<RepositoryInfo>> {
        Ok(self
            .discover()?
            .into_iter()
            .find(|repo| repo.id == id || repo.path == id))
    }

    pub fn resolve_repository(&self, id: &str) -> Result<PathBuf> {
        let repo = self
            .find(id)?
            .with_context(|| format!("repository not found: {id}"))?;
        self.resolve_relative(&repo.id)
    }

    pub fn list_contents(&self, repository: &str, path: Option<&str>) -> Result<Vec<ContentEntry>> {
        let repo_path = self.resolve_repository(repository)?;
        let target = resolve_inside(&repo_path, path.unwrap_or(""))?;
        if !target.is_dir() {
            bail!("contents target is not a directory: {}", target.display());
        }

        let mut entries = Vec::new();
        for entry in
            fs::read_dir(&target).with_context(|| format!("cannot read {}", target.display()))?
        {
            let entry = entry?;
            let metadata = entry.metadata()?;
            let absolute = entry.path();
            let relative = absolute.strip_prefix(&repo_path).unwrap_or(&absolute);
            entries.push(ContentEntry {
                name: entry.file_name().to_string_lossy().into_owned(),
                path: normalize_path(relative),
                is_dir: metadata.is_dir(),
                size: metadata.is_file().then_some(metadata.len()),
            });
        }
        entries.sort_by(|left, right| left.path.cmp(&right.path));
        Ok(entries)
    }

    pub fn read_file(&self, repository: &str, path: &str) -> Result<FileContent> {
        let repo_path = self.resolve_repository(repository)?;
        let target = resolve_inside(&repo_path, path)?;
        if !target.is_file() {
            bail!("file target is not a regular file: {}", target.display());
        }
        let content = fs::read_to_string(&target)
            .with_context(|| format!("cannot read {}", target.display()))?;
        Ok(FileContent {
            path: normalize_path(Path::new(path)),
            content,
        })
    }

    fn visit(
        &self,
        directory: &Path,
        depth: usize,
        repos: &mut Vec<RepositoryInfo>,
        seen: &mut HashSet<PathBuf>,
    ) -> Result<()> {
        if depth > MAX_DISCOVERY_DEPTH {
            return Ok(());
        }

        let git = directory.join(".git").exists();
        let jj = directory.join(".jj").exists();
        if git || jj {
            let canonical = directory.canonicalize()?;
            if seen.insert(canonical.clone()) {
                let relative = canonical.strip_prefix(&self.root).unwrap_or(&canonical);
                let id = if relative.as_os_str().is_empty() {
                    ".".to_string()
                } else {
                    normalize_path(relative)
                };
                repos.push(RepositoryInfo {
                    id,
                    name: directory
                        .file_name()
                        .map(|name| name.to_string_lossy().into_owned())
                        .unwrap_or_else(|| self.root.display().to_string()),
                    path: canonical.display().to_string(),
                    vcs: [git.then_some(VcsKind::Git), jj.then_some(VcsKind::Jj)]
                        .into_iter()
                        .flatten()
                        .collect(),
                });
            }
            return Ok(());
        }

        for entry in fs::read_dir(directory)
            .with_context(|| format!("cannot read {}", directory.display()))?
        {
            let entry = entry?;
            let path = entry.path();
            if entry.file_type()?.is_dir() && !is_ignored_dir(&path) {
                self.visit(&path, depth + 1, repos, seen)?;
            }
        }
        Ok(())
    }

    fn resolve_relative(&self, relative: &str) -> Result<PathBuf> {
        if relative == "." {
            return Ok(self.root.clone());
        }
        resolve_inside(&self.root, relative)
    }
}

fn expand_home(path: PathBuf) -> PathBuf {
    let value = path.to_string_lossy();
    if value == "~" {
        return std::env::var_os("HOME").map(PathBuf::from).unwrap_or(path);
    }
    if let Some(rest) = value.strip_prefix("~/") {
        return std::env::var_os("HOME")
            .map(|home| PathBuf::from(home).join(rest))
            .unwrap_or(path);
    }
    path
}

fn resolve_inside(root: &Path, relative: &str) -> Result<PathBuf> {
    let joined = root.join(relative);
    let canonical = joined
        .canonicalize()
        .with_context(|| format!("cannot resolve {}", joined.display()))?;
    if !canonical.starts_with(root) {
        bail!("path escapes root: {}", joined.display());
    }
    Ok(canonical)
}

fn normalize_path(path: &Path) -> String {
    path.components()
        .map(|component| component.as_os_str().to_string_lossy())
        .collect::<Vec<_>>()
        .join("/")
}

fn is_ignored_dir(path: &Path) -> bool {
    matches!(
        path.file_name().and_then(|name| name.to_str()),
        Some(".git" | ".jj" | "node_modules" | "target" | "dist" | "out")
    )
}

#[cfg(test)]
mod tests {
    use std::{fs, path::PathBuf};

    use tempfile::tempdir;

    use super::*;

    #[test]
    fn discovers_git_and_jj_repositories() {
        let root = tempdir().unwrap();
        fs::create_dir_all(root.path().join("git-repo/.git")).unwrap();
        fs::create_dir_all(root.path().join("jj-repo/.jj")).unwrap();

        let catalog = RepositoryCatalog::new(root.path().to_path_buf()).unwrap();
        let repos = catalog.discover().unwrap();

        assert_eq!(repos.len(), 2);
        assert_eq!(repos[0].id, "git-repo");
        assert_eq!(repos[1].id, "jj-repo");
    }

    #[test]
    fn expands_home_in_root_path() {
        let home = tempdir().unwrap();
        let previous_home = std::env::var_os("HOME");
        std::env::set_var("HOME", home.path());
        fs::create_dir_all(home.path().join("controltest/repo/.git")).unwrap();

        let catalog = RepositoryCatalog::new(PathBuf::from("~/controltest")).unwrap();
        let repos = catalog.discover().unwrap();

        assert_eq!(repos.len(), 1);
        assert_eq!(repos[0].id, "repo");
        if let Some(previous_home) = previous_home {
            std::env::set_var("HOME", previous_home);
        } else {
            std::env::remove_var("HOME");
        }
    }

    #[test]
    fn discovers_repositories_at_depth_eight() {
        let root = tempdir().unwrap();
        fs::create_dir_all(root.path().join("a/b/c/d/e/f/g/repo/.git")).unwrap();

        let catalog = RepositoryCatalog::new(root.path().to_path_buf()).unwrap();
        let repos = catalog.discover().unwrap();

        assert_eq!(repos.len(), 1);
        assert_eq!(repos[0].id, "a/b/c/d/e/f/g/repo");
    }

    #[test]
    fn rejects_paths_outside_repository() {
        let root = tempdir().unwrap();
        fs::create_dir_all(root.path().join("repo/.git")).unwrap();

        let catalog = RepositoryCatalog::new(root.path().to_path_buf()).unwrap();
        let error = catalog.read_file("repo", "../Cargo.toml").unwrap_err();

        assert!(
            error.to_string().contains("cannot resolve") || error.to_string().contains("escapes")
        );
    }
}
