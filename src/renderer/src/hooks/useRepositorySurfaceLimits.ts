import { useState, type Dispatch, type SetStateAction } from "react";

import { maxCommitHistoryLimit } from "../components/repository/CommitHistoryPanel";
import { defaultContributorLimit, maxContributorLimit } from "../components/repository/repositoryUi";

const defaultCommitHistoryLimit = 12;
const defaultRightRailCommitHistoryLimit = 3;
const defaultRefListLimit = 50;
const expandedRefListLimit = 200;
const defaultForksLimit = 12;
const maxForksLimit = 100;
const defaultRepositoryAccessLimit = 30;
const maxRepositoryAccessLimit = 100;
const defaultActionsLimit = 20;
const maxActionsLimit = 100;
const defaultWorkflowDefinitionLimit = 50;
const maxWorkflowDefinitionLimit = 100;
const defaultProjectsLimit = 20;
const maxProjectsLimit = 100;
const defaultReleasesLimit = 20;
const maxReleasesLimit = 100;
const defaultDiscussionsLimit = 30;
const maxDiscussionsLimit = 100;
const defaultSecurityListLimit = 20;
const maxSecurityListLimit = 100;
const defaultIssueListLimit = 50;
const maxIssueListLimit = 100;
const defaultPullRequestListLimit = 50;
const maxPullRequestListLimit = 100;

type LimitMapSetter = Dispatch<SetStateAction<Record<string, number>>>;

function expandLimitForKey(
  setLimits: LimitMapSetter,
  key: string,
  defaultLimit: number,
  maxLimit: number
): void {
  setLimits((limits) => {
    const currentLimit = limits[key] ?? defaultLimit;
    if (currentLimit >= maxLimit) {
      return limits;
    }

    const nextLimit = currentLimit < 50 ? 50 : maxLimit;
    return { ...limits, [key]: nextLimit };
  });
}

export function useRepositorySurfaceLimits({
  effectiveRepository,
  repositorySelectedRef,
  codeBrowserRef,
  codeBrowserPath
}: {
  effectiveRepository: string;
  repositorySelectedRef: string | null;
  codeBrowserRef: string | null;
  codeBrowserPath: string;
}) {
  const [commitHistoryLimits, setCommitHistoryLimits] = useState<Record<string, number>>({});
  const [repositoryRefListLimits, setRepositoryRefListLimits] = useState<Record<string, number>>({});
  const [repositoryContributorLimits, setRepositoryContributorLimits] = useState<Record<string, number>>({});
  const [repositoryForkLimits, setRepositoryForkLimits] = useState<Record<string, number>>({});
  const [repositoryAccessLimits, setRepositoryAccessLimits] = useState<Record<string, number>>({});
  const [repositoryActionsLimits, setRepositoryActionsLimits] = useState<Record<string, number>>({});
  const [repositoryWorkflowDefinitionLimits, setRepositoryWorkflowDefinitionLimits] = useState<
    Record<string, number>
  >({});
  const [repositoryProjectLimits, setRepositoryProjectLimits] = useState<Record<string, number>>({});
  const [repositoryReleaseLimits, setRepositoryReleaseLimits] = useState<Record<string, number>>({});
  const [repositoryDiscussionLimits, setRepositoryDiscussionLimits] = useState<Record<string, number>>({});
  const [repositoryIssueListLimits, setRepositoryIssueListLimits] = useState<Record<string, number>>({});
  const [repositoryPullRequestListLimits, setRepositoryPullRequestListLimits] = useState<
    Record<string, number>
  >({});
  const [repositorySecurityListLimits, setRepositorySecurityListLimits] = useState<Record<string, number>>(
    {}
  );
  const repositoryRefListLimit = repositoryRefListLimits[effectiveRepository] ?? defaultRefListLimit;
  const repositoryContributorLimit =
    repositoryContributorLimits[effectiveRepository] ?? defaultContributorLimit;
  const forksLimit = repositoryForkLimits[effectiveRepository] ?? defaultForksLimit;
  const repositoryAccessLimit = repositoryAccessLimits[effectiveRepository] ?? defaultRepositoryAccessLimit;
  const actionsLimit = repositoryActionsLimits[effectiveRepository] ?? defaultActionsLimit;
  const workflowDefinitionLimit =
    repositoryWorkflowDefinitionLimits[effectiveRepository] ?? defaultWorkflowDefinitionLimit;
  const projectsLimit = repositoryProjectLimits[effectiveRepository] ?? defaultProjectsLimit;
  const releasesLimit = repositoryReleaseLimits[effectiveRepository] ?? defaultReleasesLimit;
  const discussionsLimit = repositoryDiscussionLimits[effectiveRepository] ?? defaultDiscussionsLimit;
  const issueListLimit = repositoryIssueListLimits[effectiveRepository] ?? defaultIssueListLimit;
  const pullRequestListLimit =
    repositoryPullRequestListLimits[effectiveRepository] ?? defaultPullRequestListLimit;

  const securityListLimitKey = (listKind: string): string => `${effectiveRepository}:${listKind}`;
  const dependabotAlertsLimit =
    repositorySecurityListLimits[securityListLimitKey("dependabot")] ?? defaultSecurityListLimit;
  const codeScanningAlertsLimit =
    repositorySecurityListLimits[securityListLimitKey("codeScanning")] ?? defaultSecurityListLimit;
  const secretScanningAlertsLimit =
    repositorySecurityListLimits[securityListLimitKey("secretScanning")] ?? defaultSecurityListLimit;
  const repositoryRulesetsLimit =
    repositorySecurityListLimits[securityListLimitKey("rulesets")] ?? defaultSecurityListLimit;
  const repositorySecurityAdvisoriesLimit =
    repositorySecurityListLimits[securityListLimitKey("advisories")] ?? defaultSecurityListLimit;

  const repositoryCommitHistoryRefKey = repositorySelectedRef ?? "default";
  const fileCommitHistoryRefKey = codeBrowserRef ?? "default";
  const repositoryCommitHistoryKey = `${effectiveRepository}:${repositoryCommitHistoryRefKey}:`;
  const fileCommitHistoryKey = `${effectiveRepository}:${fileCommitHistoryRefKey}:${codeBrowserPath}`;
  const repositoryCommitHistoryLimit =
    commitHistoryLimits[repositoryCommitHistoryKey] ?? defaultRightRailCommitHistoryLimit;
  const fileCommitHistoryLimit = commitHistoryLimits[fileCommitHistoryKey] ?? defaultCommitHistoryLimit;
  const expandActiveRepositoryRefs = (): void => {
    setRepositoryRefListLimits((limits) => {
      if ((limits[effectiveRepository] ?? defaultRefListLimit) >= expandedRefListLimit) {
        return limits;
      }

      return { ...limits, [effectiveRepository]: expandedRefListLimit };
    });
  };

  return {
    repositoryRefListLimit,
    maxRefListLimit: expandedRefListLimit,
    repositoryContributorLimit,
    forksLimit,
    repositoryAccessLimit,
    actionsLimit,
    workflowDefinitionLimit,
    projectsLimit,
    releasesLimit,
    discussionsLimit,
    issueListLimit,
    pullRequestListLimit,
    dependabotAlertsLimit,
    codeScanningAlertsLimit,
    secretScanningAlertsLimit,
    repositoryRulesetsLimit,
    repositorySecurityAdvisoriesLimit,
    repositoryCommitHistoryLimit,
    fileCommitHistoryLimit,
    expandActiveRepositoryRefs,
    expandRepositoryCommitHistory: () =>
      expandLimitForKey(
        setCommitHistoryLimits,
        repositoryCommitHistoryKey,
        defaultRightRailCommitHistoryLimit,
        maxCommitHistoryLimit
      ),
    expandFileCommitHistory: () =>
      expandLimitForKey(
        setCommitHistoryLimits,
        fileCommitHistoryKey,
        defaultCommitHistoryLimit,
        maxCommitHistoryLimit
      ),
    expandActiveRepositoryContributors: () =>
      expandLimitForKey(
        setRepositoryContributorLimits,
        effectiveRepository,
        defaultContributorLimit,
        maxContributorLimit
      ),
    expandActiveRepositoryForks: () =>
      expandLimitForKey(setRepositoryForkLimits, effectiveRepository, defaultForksLimit, maxForksLimit),
    expandActiveRepositoryAccess: () =>
      expandLimitForKey(
        setRepositoryAccessLimits,
        effectiveRepository,
        defaultRepositoryAccessLimit,
        maxRepositoryAccessLimit
      ),
    expandActiveRepositoryActions: () =>
      expandLimitForKey(
        setRepositoryActionsLimits,
        effectiveRepository,
        defaultActionsLimit,
        maxActionsLimit
      ),
    expandActiveRepositoryWorkflowDefinitions: () =>
      expandLimitForKey(
        setRepositoryWorkflowDefinitionLimits,
        effectiveRepository,
        defaultWorkflowDefinitionLimit,
        maxWorkflowDefinitionLimit
      ),
    expandActiveRepositoryProjects: () =>
      expandLimitForKey(
        setRepositoryProjectLimits,
        effectiveRepository,
        defaultProjectsLimit,
        maxProjectsLimit
      ),
    expandActiveRepositoryReleases: () =>
      expandLimitForKey(
        setRepositoryReleaseLimits,
        effectiveRepository,
        defaultReleasesLimit,
        maxReleasesLimit
      ),
    expandActiveRepositoryDiscussions: () =>
      expandLimitForKey(
        setRepositoryDiscussionLimits,
        effectiveRepository,
        defaultDiscussionsLimit,
        maxDiscussionsLimit
      ),
    expandActiveRepositoryIssues: () =>
      expandLimitForKey(
        setRepositoryIssueListLimits,
        effectiveRepository,
        defaultIssueListLimit,
        maxIssueListLimit
      ),
    expandActiveRepositoryPullRequests: () =>
      expandLimitForKey(
        setRepositoryPullRequestListLimits,
        effectiveRepository,
        defaultPullRequestListLimit,
        maxPullRequestListLimit
      ),
    expandActiveRepositorySecurityList: (listKind: string) =>
      expandLimitForKey(
        setRepositorySecurityListLimits,
        securityListLimitKey(listKind),
        defaultSecurityListLimit,
        maxSecurityListLimit
      )
  };
}
