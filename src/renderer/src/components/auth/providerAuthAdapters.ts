import type { QueryClient } from "@tanstack/react-query";

import type { GitHubSignInSession } from "@shared/github";
import type { ControlApi } from "@shared/ipc";

export type ProviderAuthId = "github";
export type ProviderAuthStatus = "idle" | "waiting" | "error";

export interface ProviderAuthController {
  provider: ProviderAuthId;
  status: ProviderAuthStatus;
  session: GitHubSignInSession | null;
  error: string | null;
  completedAt: number | null;
  signIn(): Promise<void>;
  cancelSignIn(): Promise<void>;
  clearToken(): Promise<void>;
  clearError(): void;
}

export async function invalidateProviderAuthQueries(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["app-state"] }),
    queryClient.invalidateQueries({ queryKey: ["repositories"] }),
    queryClient.invalidateQueries({ queryKey: ["account-profile"] }),
    queryClient.invalidateQueries({ queryKey: ["account-issues"] }),
    queryClient.invalidateQueries({ queryKey: ["account-pulls"] }),
    queryClient.invalidateQueries({ queryKey: ["notifications"] }),
    queryClient.invalidateQueries({ queryKey: ["organizations"] }),
    queryClient.invalidateQueries({ queryKey: ["github-account-repositories"] }),
    queryClient.invalidateQueries({ queryKey: ["repository-tree"] }),
    queryClient.invalidateQueries({ queryKey: ["organization-teams"] }),
    queryClient.invalidateQueries({ queryKey: ["organization-repositories"] }),
    queryClient.invalidateQueries({ queryKey: ["organization-members"] }),
    queryClient.invalidateQueries({ queryKey: ["organization-projects"] }),
    queryClient.invalidateQueries({ queryKey: ["organization-team-repositories"] }),
    queryClient.invalidateQueries({ queryKey: ["organization-team-members"] })
  ]);
}

export interface GitHubAuthAdapter {
  start(): Promise<GitHubSignInSession>;
  current(): Promise<GitHubSignInSession | null>;
  cancel(): Promise<void>;
  clearToken(): Promise<void>;
  invalidate(): Promise<void>;
}

export function createGitHubAuthAdapter(api: ControlApi, queryClient: QueryClient): GitHubAuthAdapter {
  return {
    start: () => api.signInWithGitHub(),
    current: () => api.getGitHubSignIn(),
    cancel: () => api.cancelGitHubSignIn(),
    clearToken: async () => {
      await api.clearGitHubToken();
    },
    invalidate: () => invalidateProviderAuthQueries(queryClient)
  };
}
