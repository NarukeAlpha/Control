import { useState } from "react";

import {
  defaultMailboxListLimit,
  maxMailboxListLimit,
  type MailboxNotificationFilter
} from "../components/collection/notificationUi";
import { maxRepositoryListLimit } from "../components/repository/repositorySearch";

const defaultRepositoryListLimit = 80;
const defaultHomeRepositoryActivityLimit = 6;
const defaultRecentItemLimit = 12;

interface UseCollectionSurfaceStateInput {
  activeRouteKind: string;
}

interface UseCollectionSurfaceStateResult {
  repositoryListLimit: number;
  homeRepositoryActivityLimit: number;
  homeWorkLimit: number;
  mailboxWorkLimit: number;
  mailboxNotificationLimits: Partial<Record<MailboxNotificationFilter, number>>;
  recentItemLimit: number;
  notificationFilter: MailboxNotificationFilter;
  accountWorkLimit: number;
  notificationLimit: number;
  maxHomeWorkLimit: number;
  setNotificationFilter: (filter: MailboxNotificationFilter) => void;
  expandMailboxWork: () => void;
  loadMoreHomeWork: () => void;
  loadMoreHomeRepositoryActivity: (repositoryItemCount: number) => void;
  expandMailboxNotifications: () => void;
  expandRepositoryList: () => void;
}

export function useCollectionSurfaceState({
  activeRouteKind
}: UseCollectionSurfaceStateInput): UseCollectionSurfaceStateResult {
  const [repositoryListLimit, setRepositoryListLimit] = useState(defaultRepositoryListLimit);
  const [homeRepositoryActivityLimit, setHomeRepositoryActivityLimit] = useState(
    defaultHomeRepositoryActivityLimit
  );
  const [homeWorkLimit, setHomeWorkLimit] = useState(8);
  const [mailboxWorkLimit, setMailboxWorkLimit] = useState(defaultMailboxListLimit);
  const [mailboxNotificationLimits, setMailboxNotificationLimits] = useState<
    Partial<Record<MailboxNotificationFilter, number>>
  >({});
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

  return {
    repositoryListLimit,
    homeRepositoryActivityLimit,
    homeWorkLimit,
    mailboxWorkLimit,
    mailboxNotificationLimits,
    recentItemLimit: defaultRecentItemLimit,
    notificationFilter,
    accountWorkLimit,
    notificationLimit,
    maxHomeWorkLimit: defaultMailboxListLimit,
    setNotificationFilter,
    expandMailboxWork,
    loadMoreHomeWork,
    loadMoreHomeRepositoryActivity,
    expandMailboxNotifications,
    expandRepositoryList
  };
}
