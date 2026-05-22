import type { AppState, GitHubSignInSession } from "@shared/github";

import { mockViewer } from "./repository";

export const mockAppState: AppState = {
  platform: "darwin",
  isMac: true,
  settings: {
    credentialProvider: "github-oauth",
    glassMode: "glass-shell"
  },
  github: {
    available: true,
    authenticated: true,
    signInConfigured: true,
    user: mockViewer.login,
    error: null
  },
  viewer: mockViewer
};

export const mockGitHubSignInSession: GitHubSignInSession = {
  status: "pending",
  userCode: "WDJB-MJHT",
  verificationUri: "https://github.com/login/device",
  expiresAt: new Date(Date.now() + 900_000).toISOString(),
  error: null
};
