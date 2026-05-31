import type { RepositoryDetail, RepositorySummary, WikiPageContent, WikiPageSummary } from "@shared/github";
import type { LocalRecentRecordInput } from "@shared/local";
import type { AppRoute } from "../../stores/uiStore";
import { parseWorkflowRunIdFromUrl } from "../collection/notificationUi";
import type { CommitRecentCommit } from "./commitRecent";
import { parseGitHubCodeUrl, parseGitHubRepositoryUrl } from "./githubUrlRoutes";
import {
  discussionReferenceRecentInput,
  issueReferenceRecentInput,
  pullRequestReferenceRecentInput,
  releaseTagReferenceRecentInput,
  repositoryRecentInput
} from "../recent/recentRecordInputs";

interface RefSummary {
  name: string;
}

interface MarkdownUrlNavigationInput {
  branchItems: RefSummary[];
  tagItems: RefSummary[];
  repositoryRefs: Record<string, string | null | undefined>;
  effectiveRepository: string;
  contentsRef: string | null;
  repositoryDetail: RepositoryDetail | null;
  navigate(route: AppRoute): void;
  recordRecent(input: LocalRecentRecordInput): void;
  repositoryForRecent(nameWithOwner: string): RepositorySummary | RepositoryDetail | undefined;
  openExternal(url: string): void;
  openRepositoryInApp(nameWithOwner: string): void;
  openCodeBrowserInApp(
    nameWithOwner: string,
    path: string,
    entryType: "file" | "dir",
    ref: string | null,
    line?: number | null
  ): void;
  openCommitInApp(input: {
    nameWithOwner: string;
    commit: CommitRecentCommit;
    path?: string | null;
    entryType?: "file" | "dir";
    line?: number | null;
  }): void;
  openWorkflowRunReferenceInApp(nameWithOwner: string, runId: number, url?: string | null): void;
  selectWikiPageInApp(nameWithOwner: string, page: WikiPageSummary | WikiPageContent): void;
}

export function createMarkdownUrlHandler({
  branchItems,
  tagItems,
  repositoryRefs,
  effectiveRepository,
  contentsRef,
  repositoryDetail,
  navigate,
  recordRecent,
  repositoryForRecent,
  openExternal,
  openRepositoryInApp,
  openCodeBrowserInApp,
  openCommitInApp,
  openWorkflowRunReferenceInApp,
  selectWikiPageInApp
}: MarkdownUrlNavigationInput): (url: string) => void {
  return (url: string): void => {
    const parsed = parseGitHubRepositoryUrl(url);
    if (!parsed) {
      openExternal(url);
      return;
    }

    const [, , surface, rawValue] = parsed.segments;
    const nameWithOwner = parsed.nameWithOwner;
    const number = rawValue ? Number(rawValue) : null;

    if (parsed.segments.length === 2) {
      openRepositoryInApp(nameWithOwner);
      return;
    }

    if (surface === "issues" && number !== null && Number.isInteger(number) && number > 0) {
      navigate({ kind: "repository", nameWithOwner, tab: "issues", issueNumber: number });
      recordRecent(issueReferenceRecentInput(nameWithOwner, number, url));
      return;
    }

    if (
      (surface === "pull" || surface === "pulls") &&
      number !== null &&
      Number.isInteger(number) &&
      number > 0
    ) {
      navigate({ kind: "repository", nameWithOwner, tab: "pulls", pullNumber: number });
      recordRecent(pullRequestReferenceRecentInput(nameWithOwner, number, url));
      return;
    }

    if (surface === "discussions" && number !== null && Number.isInteger(number) && number > 0) {
      navigate({ kind: "repository", nameWithOwner, tab: "discussions", discussionNumber: number });
      recordRecent(discussionReferenceRecentInput(nameWithOwner, number, url));
      return;
    }

    if (surface === "actions" && parsed.segments[3] === "runs") {
      const runId = parseWorkflowRunIdFromUrl(url);
      if (runId !== null) {
        openWorkflowRunReferenceInApp(nameWithOwner, runId, url);
        return;
      }
    }

    if (surface === "releases") {
      const tagName = parsed.segments[3] === "tag" ? parsed.segments.slice(4).join("/") : null;
      navigate({
        kind: "repository",
        nameWithOwner,
        tab: "releases",
        releaseTagName: tagName || undefined
      });
      if (tagName) {
        recordRecent(releaseTagReferenceRecentInput(nameWithOwner, tagName, url));
      } else {
        recordRecent(repositoryRecentInput(nameWithOwner, repositoryForRecent(nameWithOwner), "releases"));
      }
      return;
    }

    if ((surface === "commit" || surface === "commits") && rawValue) {
      openCommitInApp({
        nameWithOwner,
        commit: {
          sha: rawValue,
          headline: rawValue.slice(0, 7),
          authorLogin: null,
          authorName: null,
          authoredDate: null,
          committedDate: null,
          htmlUrl: `https://github.com/${nameWithOwner}/commit/${rawValue}`
        }
      });
      return;
    }

    if (surface === "blob" || surface === "tree") {
      const refCandidates = [
        ...branchItems.map((branch) => branch.name),
        ...tagItems.map((tag) => tag.name),
        repositoryRefs[nameWithOwner],
        nameWithOwner.toLowerCase() === effectiveRepository.toLowerCase() ? contentsRef : null,
        repositoryDetail?.nameWithOwner.toLowerCase() === nameWithOwner.toLowerCase()
          ? repositoryDetail.defaultBranch
          : null
      ].filter((ref): ref is string => Boolean(ref));
      const codeRoute = parseGitHubCodeUrl(url, refCandidates, rawValue);
      if (codeRoute) {
        openCodeBrowserInApp(
          codeRoute.nameWithOwner,
          codeRoute.path,
          codeRoute.entryType,
          codeRoute.ref,
          codeRoute.line
        );
        return;
      }
    }

    if (surface === "wiki") {
      const pagePath = parsed.segments.slice(3).join("/");
      if (pagePath) {
        selectWikiPageInApp(nameWithOwner, {
          path: pagePath,
          title: pagePath.split("/").at(-1) ?? pagePath,
          htmlUrl: url,
          sha: pagePath,
          size: null
        });
      } else {
        navigate({ kind: "repository", nameWithOwner, tab: "wiki" });
        recordRecent(repositoryRecentInput(nameWithOwner, repositoryForRecent(nameWithOwner), "wiki"));
      }
      return;
    }

    openExternal(url);
  };
}
