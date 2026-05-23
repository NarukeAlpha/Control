import { useState } from "react";

import {
  defaultMailboxListLimit,
  maxMailboxListLimit,
  type MailboxNotificationFilter
} from "../components/collection/notificationUi";
import {
  defaultOrganizationListLimit,
  defaultOrganizationMemberLimit,
  defaultOrganizationProjectLimit,
  defaultOrganizationRepositoryLimit,
  defaultOrganizationTeamLimit,
  defaultOrganizationTeamMemberLimit,
  defaultOrganizationTeamRepositoryLimit,
  maxOrganizationListLimit,
  maxOrganizationMemberLimit,
  maxOrganizationProjectLimit,
  maxOrganizationRepositoryLimit,
  maxOrganizationTeamLimit,
  maxOrganizationTeamMemberLimit,
  maxOrganizationTeamRepositoryLimit
} from "../components/collection/organizationUi";
import { maxRepositoryListLimit } from "../components/repository/repositorySearch";

const defaultRepositoryListLimit = 80;
const defaultHomeRepositoryActivityLimit = 6;
const defaultRecentItemLimit = 12;

interface UseCollectionSurfaceStateInput {
  activeRouteKind: string;
}

interface UseCollectionSurfaceStateResult {
  repositoryListLimit: number;
  organizationListLimit: number;
  organizationRepositoryLimits: Record<string, number>;
  organizationTeamLimits: Record<string, number>;
  organizationMemberLimits: Record<string, number>;
  organizationProjectLimits: Record<string, number>;
  organizationTeamRepositoryLimits: Record<string, number>;
  organizationTeamMemberLimits: Record<string, number>;
  homeRepositoryActivityLimit: number;
  homeWorkLimit: number;
  mailboxWorkLimit: number;
  mailboxNotificationLimits: Partial<Record<MailboxNotificationFilter, number>>;
  recentItemLimit: number;
  selectedOrganizationLogin: string | null;
  selectedOrganizationTeamSlug: string | null;
  selectedOrganizationMemberLogin: string | null;
  selectedOrganizationProjectId: string | null;
  notificationFilter: MailboxNotificationFilter;
  accountWorkLimit: number;
  notificationLimit: number;
  maxHomeWorkLimit: number;
  setSelectedOrganizationLogin: (login: string | null) => void;
  setSelectedOrganizationTeamSlug: (slug: string | null) => void;
  setSelectedOrganizationMemberLogin: (login: string | null) => void;
  setSelectedOrganizationProjectId: (id: string | null) => void;
  setNotificationFilter: (filter: MailboxNotificationFilter) => void;
  expandMailboxWork: () => void;
  loadMoreHomeWork: () => void;
  loadMoreHomeRepositoryActivity: (repositoryItemCount: number) => void;
  expandMailboxNotifications: () => void;
  expandRepositoryList: () => void;
  expandOrganizationList: () => void;
  expandSelectedOrganizationRepositories: () => void;
  expandSelectedOrganizationTeams: () => void;
  expandSelectedOrganizationMembers: () => void;
  expandSelectedOrganizationProjects: () => void;
  expandSelectedOrganizationTeamRepositories: () => void;
  expandSelectedOrganizationTeamMembers: () => void;
}

export function useCollectionSurfaceState({
  activeRouteKind
}: UseCollectionSurfaceStateInput): UseCollectionSurfaceStateResult {
  const [repositoryListLimit, setRepositoryListLimit] = useState(defaultRepositoryListLimit);
  const [organizationListLimit, setOrganizationListLimit] = useState(defaultOrganizationListLimit);
  const [organizationRepositoryLimits, setOrganizationRepositoryLimits] = useState<Record<string, number>>(
    {}
  );
  const [organizationTeamLimits, setOrganizationTeamLimits] = useState<Record<string, number>>({});
  const [organizationMemberLimits, setOrganizationMemberLimits] = useState<Record<string, number>>({});
  const [organizationProjectLimits, setOrganizationProjectLimits] = useState<Record<string, number>>({});
  const [organizationTeamRepositoryLimits, setOrganizationTeamRepositoryLimits] = useState<
    Record<string, number>
  >({});
  const [organizationTeamMemberLimits, setOrganizationTeamMemberLimits] = useState<Record<string, number>>(
    {}
  );
  const [homeRepositoryActivityLimit, setHomeRepositoryActivityLimit] = useState(
    defaultHomeRepositoryActivityLimit
  );
  const [homeWorkLimit, setHomeWorkLimit] = useState(8);
  const [mailboxWorkLimit, setMailboxWorkLimit] = useState(defaultMailboxListLimit);
  const [mailboxNotificationLimits, setMailboxNotificationLimits] = useState<
    Partial<Record<MailboxNotificationFilter, number>>
  >({});
  const [selectedOrganizationLogin, setSelectedOrganizationLogin] = useState<string | null>(null);
  const [selectedOrganizationTeamSlug, setSelectedOrganizationTeamSlug] = useState<string | null>(null);
  const [selectedOrganizationMemberLogin, setSelectedOrganizationMemberLogin] = useState<string | null>(null);
  const [selectedOrganizationProjectId, setSelectedOrganizationProjectId] = useState<string | null>(null);
  const [notificationFilter, setNotificationFilter] = useState<MailboxNotificationFilter>("unread");

  const accountWorkLimit = activeRouteKind === "mailbox" ? mailboxWorkLimit : defaultMailboxListLimit;
  const notificationLimit = mailboxNotificationLimits[notificationFilter] ?? defaultMailboxListLimit;

  const expandMailboxWork = (): void => {
    setMailboxWorkLimit((currentLimit) => {
      if (currentLimit >= maxMailboxListLimit) {
        return currentLimit;
      }

      return currentLimit < 50 ? 50 : maxMailboxListLimit;
    });
  };

  const loadMoreHomeWork = (): void => {
    setHomeWorkLimit(defaultMailboxListLimit);
  };

  const loadMoreHomeRepositoryActivity = (repositoryItemCount: number): void => {
    setHomeRepositoryActivityLimit((currentLimit) => {
      const loadedRepositoryLimit = Math.min(repositoryItemCount || currentLimit, maxRepositoryListLimit);
      if (currentLimit >= loadedRepositoryLimit) {
        return currentLimit;
      }

      return Math.min(currentLimit + defaultHomeRepositoryActivityLimit, loadedRepositoryLimit);
    });
  };

  const expandMailboxNotifications = (): void => {
    setMailboxNotificationLimits((limits) => {
      const currentLimit = limits[notificationFilter] ?? defaultMailboxListLimit;
      if (currentLimit >= maxMailboxListLimit) {
        return limits;
      }

      const nextLimit = currentLimit < 50 ? 50 : maxMailboxListLimit;
      return { ...limits, [notificationFilter]: nextLimit };
    });
  };

  const expandRepositoryList = (): void => {
    setRepositoryListLimit((currentLimit) => {
      if (currentLimit >= maxRepositoryListLimit) {
        return currentLimit;
      }

      return maxRepositoryListLimit;
    });
  };

  const expandOrganizationList = (): void => {
    setOrganizationListLimit((currentLimit) => {
      if (currentLimit >= maxOrganizationListLimit) {
        return currentLimit;
      }

      return maxOrganizationListLimit;
    });
  };

  const expandSelectedOrganizationRepositories = (): void => {
    if (!selectedOrganizationLogin) {
      return;
    }

    setOrganizationRepositoryLimits((limits) => {
      const currentLimit = limits[selectedOrganizationLogin] ?? defaultOrganizationRepositoryLimit;
      if (currentLimit >= maxOrganizationRepositoryLimit) {
        return limits;
      }

      return { ...limits, [selectedOrganizationLogin]: maxOrganizationRepositoryLimit };
    });
  };

  const expandSelectedOrganizationTeams = (): void => {
    if (!selectedOrganizationLogin) {
      return;
    }

    setOrganizationTeamLimits((limits) => {
      const currentLimit = limits[selectedOrganizationLogin] ?? defaultOrganizationTeamLimit;
      if (currentLimit >= maxOrganizationTeamLimit) {
        return limits;
      }

      return { ...limits, [selectedOrganizationLogin]: maxOrganizationTeamLimit };
    });
  };

  const expandSelectedOrganizationMembers = (): void => {
    if (!selectedOrganizationLogin) {
      return;
    }

    setOrganizationMemberLimits((limits) => {
      const currentLimit = limits[selectedOrganizationLogin] ?? defaultOrganizationMemberLimit;
      if (currentLimit >= maxOrganizationMemberLimit) {
        return limits;
      }

      return { ...limits, [selectedOrganizationLogin]: maxOrganizationMemberLimit };
    });
  };

  const expandSelectedOrganizationProjects = (): void => {
    if (!selectedOrganizationLogin) {
      return;
    }

    setOrganizationProjectLimits((limits) => {
      const currentLimit = limits[selectedOrganizationLogin] ?? defaultOrganizationProjectLimit;
      if (currentLimit >= maxOrganizationProjectLimit) {
        return limits;
      }

      return { ...limits, [selectedOrganizationLogin]: maxOrganizationProjectLimit };
    });
  };

  const expandSelectedOrganizationTeamRepositories = (): void => {
    if (!selectedOrganizationLogin || !selectedOrganizationTeamSlug) {
      return;
    }

    const key = `${selectedOrganizationLogin}/${selectedOrganizationTeamSlug}`;
    setOrganizationTeamRepositoryLimits((limits) => {
      const currentLimit = limits[key] ?? defaultOrganizationTeamRepositoryLimit;
      if (currentLimit >= maxOrganizationTeamRepositoryLimit) {
        return limits;
      }

      return { ...limits, [key]: maxOrganizationTeamRepositoryLimit };
    });
  };

  const expandSelectedOrganizationTeamMembers = (): void => {
    if (!selectedOrganizationLogin || !selectedOrganizationTeamSlug) {
      return;
    }

    const key = `${selectedOrganizationLogin}/${selectedOrganizationTeamSlug}`;
    setOrganizationTeamMemberLimits((limits) => {
      const currentLimit = limits[key] ?? defaultOrganizationTeamMemberLimit;
      if (currentLimit >= maxOrganizationTeamMemberLimit) {
        return limits;
      }

      return { ...limits, [key]: maxOrganizationTeamMemberLimit };
    });
  };

  return {
    repositoryListLimit,
    organizationListLimit,
    organizationRepositoryLimits,
    organizationTeamLimits,
    organizationMemberLimits,
    organizationProjectLimits,
    organizationTeamRepositoryLimits,
    organizationTeamMemberLimits,
    homeRepositoryActivityLimit,
    homeWorkLimit,
    mailboxWorkLimit,
    mailboxNotificationLimits,
    recentItemLimit: defaultRecentItemLimit,
    selectedOrganizationLogin,
    selectedOrganizationTeamSlug,
    selectedOrganizationMemberLogin,
    selectedOrganizationProjectId,
    notificationFilter,
    accountWorkLimit,
    notificationLimit,
    maxHomeWorkLimit: defaultMailboxListLimit,
    setSelectedOrganizationLogin,
    setSelectedOrganizationTeamSlug,
    setSelectedOrganizationMemberLogin,
    setSelectedOrganizationProjectId,
    setNotificationFilter,
    expandMailboxWork,
    loadMoreHomeWork,
    loadMoreHomeRepositoryActivity,
    expandMailboxNotifications,
    expandRepositoryList,
    expandOrganizationList,
    expandSelectedOrganizationRepositories,
    expandSelectedOrganizationTeams,
    expandSelectedOrganizationMembers,
    expandSelectedOrganizationProjects,
    expandSelectedOrganizationTeamRepositories,
    expandSelectedOrganizationTeamMembers
  };
}
