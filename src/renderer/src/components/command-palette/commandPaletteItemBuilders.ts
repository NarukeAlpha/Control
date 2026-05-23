import {
  BookOpen,
  Building2,
  CircleDot,
  Code2,
  Download,
  File as FileIcon,
  GitBranch,
  GitPullRequest,
  MessageSquare,
  Pin,
  ShieldCheck,
  SquareKanban,
  Tag,
  Users,
  Workflow
} from "lucide-react";

import type { RepositorySummary } from "@shared/github";
import type { LocalRecentItem } from "@shared/local";
import type { CommandPaletteItem } from "./CommandPalette";
import {
  displayRepositoryName,
  displayRepositoryShortcutName,
  repositoryShortcutsFromPins
} from "../repository/repositorySearch";
import {
  recentMetadataBooleanKeyword,
  recentMetadataKeyword,
  recentMetadataString
} from "../recent/recentRecordInputs";

export function appendPinnedRepositoryCommandPaletteItems(
  items: CommandPaletteItem[],
  input: {
    pinnedRepositoryNames: string[];
    repositoryItems: RepositorySummary[];
    viewerLogin: string | null;
    onOpenRepository(nameWithOwner: string): void;
  }
): void {
  for (const repositoryShortcut of repositoryShortcutsFromPins(
    input.pinnedRepositoryNames,
    input.repositoryItems
  )) {
    items.push({
      id: `pinned-${repositoryShortcut.nameWithOwner}`,
      title: displayRepositoryShortcutName(repositoryShortcut, input.viewerLogin),
      subtitle: repositoryShortcut.description ?? repositoryShortcut.nameWithOwner,
      group: "Pinned",
      icon: Pin,
      keywords: [
        repositoryShortcut.nameWithOwner,
        repositoryShortcut.owner,
        repositoryShortcut.name,
        repositoryShortcut.primaryLanguage?.name ?? ""
      ],
      run: () => input.onOpenRepository(repositoryShortcut.nameWithOwner)
    });
  }
}

export function appendRecentCommandPaletteItems(
  items: CommandPaletteItem[],
  input: {
    recentItems: LocalRecentItem[];
    onOpenRecent(item: LocalRecentItem): void;
  }
): void {
  for (const recent of input.recentItems) {
    items.push({
      id: `recent-${recent.kind}-${recent.itemKey}`,
      title: recent.title,
      subtitle: recent.subtitle ?? recent.repositoryNameWithOwner ?? "Recent GitHub item",
      group: "Recents",
      icon:
        recent.kind === "file"
          ? FileIcon
          : recent.kind === "commit"
            ? GitBranch
            : recent.kind === "issue"
              ? CircleDot
              : recent.kind === "pullRequest"
                ? GitPullRequest
                : recent.kind === "discussion"
                  ? MessageSquare
                  : recent.kind === "organization"
                    ? Building2
                    : recent.kind === "team"
                      ? Users
                      : recent.kind === "contributor"
                        ? Users
                        : recent.kind === "project"
                          ? SquareKanban
                          : recent.kind === "release"
                            ? Tag
                            : recent.kind === "releaseAsset"
                              ? Download
                              : recent.kind === "workflowRun"
                                ? Workflow
                                : recent.kind === "workflowArtifact"
                                  ? Download
                                  : recent.kind === "securityItem"
                                    ? ShieldCheck
                                    : recent.kind === "wikiPage"
                                      ? BookOpen
                                      : Code2,
      keywords: [
        recent.itemKey,
        recent.repositoryNameWithOwner ?? "",
        recent.kind,
        recentMetadataString(recent, "path") ?? "",
        recentMetadataKeyword(recent, "ref"),
        recentMetadataKeyword(recent, "branch"),
        recentMetadataKeyword(recent, "headRefName"),
        recentMetadataKeyword(recent, "baseRefName"),
        recentMetadataKeyword(recent, "headRepositoryNameWithOwner"),
        recentMetadataKeyword(recent, "baseRepositoryNameWithOwner"),
        recentMetadataKeyword(recent, "tagName"),
        recentMetadataKeyword(recent, "releaseTitle"),
        recentMetadataKeyword(recent, "assetId"),
        recentMetadataKeyword(recent, "assetName"),
        recentMetadataKeyword(recent, "artifactId"),
        recentMetadataKeyword(recent, "artifactName"),
        recentMetadataKeyword(recent, "securityItemKind"),
        recentMetadataKeyword(recent, "securityItemId"),
        recentMetadataKeyword(recent, "title"),
        recentMetadataKeyword(recent, "sha"),
        recentMetadataKeyword(recent, "htmlUrl"),
        recentMetadataKeyword(recent, "severity"),
        recentMetadataKeyword(recent, "rule"),
        recentMetadataKeyword(recent, "packageName"),
        recentMetadataKeyword(recent, "ghsaId"),
        recentMetadataKeyword(recent, "cveId"),
        recentMetadataKeyword(recent, "contentType"),
        recentMetadataKeyword(recent, "state"),
        recentMetadataKeyword(recent, "runId"),
        recentMetadataKeyword(recent, "runName"),
        recentMetadataKeyword(recent, "runTitle"),
        recentMetadataKeyword(recent, "runNumber"),
        recentMetadataKeyword(recent, "runAttempt"),
        recentMetadataKeyword(recent, "event"),
        recentMetadataKeyword(recent, "conclusion"),
        recentMetadataKeyword(recent, "status"),
        recentMetadataKeyword(recent, "reason"),
        recentMetadataKeyword(recent, "subjectType"),
        recentMetadataKeyword(recent, "login"),
        recentMetadataKeyword(recent, "id"),
        recentMetadataKeyword(recent, "contributions"),
        recentMetadataKeyword(recent, "avatarUrl"),
        recentMetadataKeyword(recent, "organizationLogin"),
        recentMetadataKeyword(recent, "slug"),
        recentMetadataKeyword(recent, "membershipRole"),
        recentMetadataKeyword(recent, "membershipState"),
        recentMetadataKeyword(recent, "privacy"),
        recentMetadataKeyword(recent, "permission"),
        recentMetadataKeyword(recent, "projectId"),
        recentMetadataKeyword(recent, "number"),
        recentMetadataKeyword(recent, "title"),
        recentMetadataKeyword(recent, "ownerLogin"),
        recentMetadataKeyword(recent, "ownerKind"),
        recentMetadataBooleanKeyword(recent, "closed"),
        recentMetadataBooleanKeyword(recent, "isPublic"),
        recentMetadataBooleanKeyword(recent, "unread")
      ],
      run: () => input.onOpenRecent(recent)
    });
  }
}

export function appendRepositoryCommandPaletteItems(
  items: CommandPaletteItem[],
  input: {
    repositoryItems: RepositorySummary[];
    viewerLogin: string | null;
    onOpenRepository(nameWithOwner: string): void;
  }
): void {
  for (const repositorySummary of input.repositoryItems) {
    items.push({
      id: `repository-${repositorySummary.nameWithOwner}`,
      title: displayRepositoryName(repositorySummary, input.viewerLogin),
      subtitle: repositorySummary.description ?? repositorySummary.nameWithOwner,
      group: "Repositories",
      icon: Code2,
      keywords: [
        repositorySummary.nameWithOwner,
        repositorySummary.owner,
        repositorySummary.name,
        repositorySummary.primaryLanguage?.name ?? ""
      ],
      run: () => input.onOpenRepository(repositorySummary.nameWithOwner)
    });
  }
}
