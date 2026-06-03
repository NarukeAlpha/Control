import { createContext, use, useCallback, useEffect, useMemo, useReducer } from "react";
import type { JSX, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";

import type { GitHubSignInSession } from "@shared/github";
import { useControlApi } from "../../hooks/useControlApi";
import { createGitHubAuthAdapter, type ProviderAuthController } from "./providerAuthAdapters";

interface ProviderAuthContextValue {
  github: ProviderAuthController;
}

const ProviderAuthContext = createContext<ProviderAuthContextValue | null>(null);

interface AuthProviderState {
  status: ProviderAuthController["status"];
  session: GitHubSignInSession | null;
  error: string | null;
  completedAt: number | null;
}

type AuthProviderAction =
  | { type: "signInStarted" }
  | { type: "sessionReceived"; session: GitHubSignInSession }
  | { type: "signInCompleted"; completedAt: number }
  | { type: "signedOut" }
  | { type: "signInFailed"; error: string }
  | { type: "errorCleared" };

const initialAuthProviderState: AuthProviderState = {
  status: "idle",
  session: null,
  error: null,
  completedAt: null
};

function authProviderReducer(state: AuthProviderState, action: AuthProviderAction): AuthProviderState {
  switch (action.type) {
    case "signInStarted":
      return { ...state, status: "waiting", session: null, error: null };
    case "sessionReceived":
      return { ...state, session: action.session };
    case "signInCompleted":
      return { status: "idle", session: null, error: null, completedAt: action.completedAt };
    case "signedOut":
      return { ...state, status: "idle", session: null, error: null };
    case "signInFailed":
      return { ...state, status: "error", error: action.error };
    case "errorCleared":
      return { ...state, status: state.status === "error" ? "idle" : state.status, error: null };
  }
}

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const api = useControlApi();
  const queryClient = useQueryClient();
  const githubAdapter = useMemo(() => createGitHubAuthAdapter(api, queryClient), [api, queryClient]);
  const [{ status, session, error, completedAt }, dispatch] = useReducer(
    authProviderReducer,
    initialAuthProviderState
  );

  const markSignInComplete = useCallback((): void => {
    dispatch({ type: "signInCompleted", completedAt: Date.now() });
  }, []);

  const completeSignIn = useCallback(async (): Promise<void> => {
    await githubAdapter.invalidate();
    markSignInComplete();
  }, [githubAdapter, markSignInComplete]);

  useEffect(() => {
    if (status !== "waiting" || !session) {
      return;
    }

    let active = true;
    let pollHandle: number | null = null;

    const poll = async (): Promise<void> => {
      try {
        const nextSession = await githubAdapter.current();
        if (!active) {
          return;
        }

        if (!nextSession) {
          dispatch({ type: "signedOut" });
          return;
        }

        dispatch({ type: "sessionReceived", session: nextSession });

        if (nextSession.status === "complete") {
          await githubAdapter.invalidate();
          if (active) {
            markSignInComplete();
          }
          return;
        }

        if (nextSession.status === "error") {
          dispatch({ type: "signInFailed", error: nextSession.error ?? "GitHub sign-in failed." });
          return;
        }

        if (nextSession.status === "cancelled") {
          dispatch({ type: "signedOut" });
          return;
        }

        pollHandle = window.setTimeout(() => {
          void poll();
        }, 300);
      } catch (pollError) {
        if (!active) {
          return;
        }
        dispatch({
          type: "signInFailed",
          error: pollError instanceof Error ? pollError.message : "GitHub sign-in failed."
        });
      }
    };

    pollHandle = window.setTimeout(() => {
      void poll();
    }, 300);

    return () => {
      active = false;
      if (pollHandle !== null) {
        window.clearTimeout(pollHandle);
      }
    };
  }, [githubAdapter, markSignInComplete, session, status]);

  const github = useMemo<ProviderAuthController>(
    () => ({
      provider: "github",
      status,
      session,
      error,
      completedAt,
      signIn: async () => {
        dispatch({ type: "signInStarted" });

        try {
          const nextSession = await githubAdapter.start();
          dispatch({ type: "sessionReceived", session: nextSession });

          if (nextSession.status === "complete") {
            await completeSignIn();
            return;
          }

          if (nextSession.status === "error") {
            dispatch({ type: "signInFailed", error: nextSession.error ?? "GitHub sign-in failed." });
            return;
          }

          if (nextSession.status === "cancelled") {
            dispatch({ type: "signedOut" });
          }
        } catch (signInError) {
          dispatch({
            type: "signInFailed",
            error: signInError instanceof Error ? signInError.message : "GitHub sign-in failed."
          });
        }
      },
      cancelSignIn: async () => {
        await githubAdapter.cancel();
        dispatch({ type: "signedOut" });
      },
      clearToken: async () => {
        await githubAdapter.clearToken();
        await githubAdapter.invalidate();
        dispatch({ type: "signedOut" });
      },
      clearError: () => {
        dispatch({ type: "errorCleared" });
      }
    }),
    [completeSignIn, completedAt, githubAdapter, error, session, status]
  );

  const value = useMemo<ProviderAuthContextValue>(() => ({ github }), [github]);

  return <ProviderAuthContext.Provider value={value}>{children}</ProviderAuthContext.Provider>;
}

export function useProviderAuth(): ProviderAuthContextValue {
  const value = use(ProviderAuthContext);
  if (!value) {
    throw new Error("useProviderAuth must be used inside AuthProvider.");
  }
  return value;
}
