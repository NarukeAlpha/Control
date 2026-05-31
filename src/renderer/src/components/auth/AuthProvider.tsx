import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { JSX, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";

import type { GitHubSignInSession } from "@shared/github";
import { useControlApi } from "../../hooks/useControlApi";
import { createGitHubAuthAdapter, type ProviderAuthController } from "./providerAuthAdapters";

interface ProviderAuthContextValue {
  github: ProviderAuthController;
}

const ProviderAuthContext = createContext<ProviderAuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const api = useControlApi();
  const queryClient = useQueryClient();
  const githubAdapter = useMemo(() => createGitHubAuthAdapter(api, queryClient), [api, queryClient]);
  const [status, setStatus] = useState<ProviderAuthController["status"]>("idle");
  const [session, setSession] = useState<GitHubSignInSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completedAt, setCompletedAt] = useState<number | null>(null);

  const markSignInComplete = useCallback((): void => {
    setStatus("idle");
    setSession(null);
    setError(null);
    setCompletedAt(Date.now());
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
          setStatus("idle");
          setSession(null);
          return;
        }

        setSession(nextSession);

        if (nextSession.status === "complete") {
          await githubAdapter.invalidate();
          if (active) {
            markSignInComplete();
          }
          return;
        }

        if (nextSession.status === "error") {
          setStatus("error");
          setError(nextSession.error ?? "GitHub sign-in failed.");
          return;
        }

        if (nextSession.status === "cancelled") {
          setStatus("idle");
          setSession(null);
          setError(null);
          return;
        }

        pollHandle = window.setTimeout(() => {
          void poll();
        }, 300);
      } catch (pollError) {
        if (!active) {
          return;
        }
        setStatus("error");
        setError(pollError instanceof Error ? pollError.message : "GitHub sign-in failed.");
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
        setStatus("waiting");
        setSession(null);
        setError(null);

        try {
          const nextSession = await githubAdapter.start();
          setSession(nextSession);

          if (nextSession.status === "complete") {
            await completeSignIn();
            return;
          }

          if (nextSession.status === "error") {
            setStatus("error");
            setError(nextSession.error ?? "GitHub sign-in failed.");
            return;
          }

          if (nextSession.status === "cancelled") {
            setStatus("idle");
            setSession(null);
          }
        } catch (signInError) {
          setStatus("error");
          setError(signInError instanceof Error ? signInError.message : "GitHub sign-in failed.");
        }
      },
      cancelSignIn: async () => {
        await githubAdapter.cancel();
        setStatus("idle");
        setSession(null);
        setError(null);
      },
      clearToken: async () => {
        await githubAdapter.clearToken();
        await githubAdapter.invalidate();
        setStatus("idle");
        setSession(null);
        setError(null);
      },
      clearError: () => {
        setError(null);
        if (status === "error") {
          setStatus("idle");
        }
      }
    }),
    [completeSignIn, completedAt, githubAdapter, error, session, status]
  );

  const value = useMemo<ProviderAuthContextValue>(() => ({ github }), [github]);

  return <ProviderAuthContext.Provider value={value}>{children}</ProviderAuthContext.Provider>;
}

export function useProviderAuth(): ProviderAuthContextValue {
  const value = useContext(ProviderAuthContext);
  if (!value) {
    throw new Error("useProviderAuth must be used inside AuthProvider.");
  }
  return value;
}
