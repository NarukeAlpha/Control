import { createContext, useMemo, type JSX, type ReactNode } from "react";
import type { QueryClient } from "@tanstack/react-query";

import type { ControlApi } from "@shared/ipc";

export interface RepositoryContextValue {
  owner: string;
  repo: string;
  nameWithOwner: string;
  githubReady: boolean;
  api: ControlApi;
  queryClient: QueryClient;
}

export const RepositoryContext = createContext<RepositoryContextValue | null>(null);

export function RepositoryContextProvider({
  value,
  children
}: {
  value: RepositoryContextValue;
  children: ReactNode;
}): JSX.Element {
  const { owner, repo, nameWithOwner, githubReady, api, queryClient } = value;
  const stableValue = useMemo(
    () => ({ owner, repo, nameWithOwner, githubReady, api, queryClient }),
    [api, githubReady, nameWithOwner, owner, queryClient, repo]
  );

  return <RepositoryContext.Provider value={stableValue}>{children}</RepositoryContext.Provider>;
}
