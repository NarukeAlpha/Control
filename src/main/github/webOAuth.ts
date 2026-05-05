const deviceCodeUrl = "https://github.com/login/device/code";
const accessTokenUrl = "https://github.com/login/oauth/access_token";

export const defaultGitHubOAuthScopes = "repo read:org workflow gist user:email";

export interface GitHubOAuthToken {
  accessToken: string;
  tokenType: string;
  scope: string;
}

export interface GitHubDeviceAuthorizationRequest {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresAt: string;
  intervalSeconds: number;
}

interface GitHubDeviceCodeResponse {
  device_code?: unknown;
  user_code?: unknown;
  verification_uri?: unknown;
  expires_in?: unknown;
  interval?: unknown;
  error?: unknown;
  error_description?: unknown;
}

interface GitHubOAuthTokenResponse {
  access_token?: unknown;
  token_type?: unknown;
  scope?: unknown;
  error?: unknown;
  error_description?: unknown;
  interval?: unknown;
}

export type GitHubDeviceTokenResult =
  | { status: "pending"; intervalSeconds: number }
  | { status: "success"; token: GitHubOAuthToken };

export async function requestGitHubDeviceAuthorization(
  clientId: string,
  scope = defaultGitHubOAuthScopes
): Promise<GitHubDeviceAuthorizationRequest> {
  const response = await fetch(deviceCodeUrl, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: clientId,
      scope
    })
  });
  const payload = (await response.json()) as GitHubDeviceCodeResponse;

  if (!response.ok || typeof payload.error === "string") {
    throw new Error(githubOAuthErrorMessage(payload));
  }

  if (
    typeof payload.device_code !== "string" ||
    typeof payload.user_code !== "string" ||
    typeof payload.verification_uri !== "string" ||
    typeof payload.expires_in !== "number" ||
    typeof payload.interval !== "number"
  ) {
    throw new Error("GitHub did not return a valid device authorization response.");
  }

  return {
    deviceCode: payload.device_code,
    userCode: payload.user_code,
    verificationUri: payload.verification_uri,
    expiresAt: new Date(Date.now() + payload.expires_in * 1000).toISOString(),
    intervalSeconds: payload.interval
  };
}

export async function pollGitHubDeviceAuthorization(input: {
  clientId: string;
  deviceCode: string;
}): Promise<GitHubDeviceTokenResult> {
  const response = await fetch(accessTokenUrl, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: input.clientId,
      device_code: input.deviceCode,
      grant_type: "urn:ietf:params:oauth:grant-type:device_code"
    })
  });
  const payload = (await response.json()) as GitHubOAuthTokenResponse;

  if (typeof payload.access_token === "string") {
    return {
      status: "success",
      token: {
        accessToken: payload.access_token,
        tokenType: typeof payload.token_type === "string" ? payload.token_type : "bearer",
        scope: typeof payload.scope === "string" ? payload.scope : ""
      }
    };
  }

  if (typeof payload.error === "string") {
    if (payload.error === "authorization_pending") {
      return {
        status: "pending",
        intervalSeconds: typeof payload.interval === "number" ? payload.interval : 5
      };
    }

    if (payload.error === "slow_down") {
      return {
        status: "pending",
        intervalSeconds: typeof payload.interval === "number" ? payload.interval : 10
      };
    }
  }

  if (!response.ok || typeof payload.error === "string") {
    throw new Error(githubOAuthErrorMessage(payload));
  }

  throw new Error("GitHub did not return an access token.");
}

function githubOAuthErrorMessage(payload: {
  error?: unknown;
  error_description?: unknown;
}): string {
  if (typeof payload.error_description === "string" && payload.error_description.trim()) {
    return payload.error_description;
  }

  if (typeof payload.error === "string" && payload.error.trim()) {
    switch (payload.error) {
      case "access_denied":
        return "GitHub sign-in was cancelled.";
      case "bad_verification_code":
      case "incorrect_device_code":
        return "GitHub rejected the device authorization code.";
      case "incorrect_client_credentials":
        return "GitHub sign-in is misconfigured for this build.";
      case "expired_token":
        return "GitHub sign-in expired. Start it again.";
      case "device_flow_disabled":
        return "GitHub device flow is disabled for this app registration.";
      default:
        return `GitHub sign-in failed: ${payload.error}.`;
    }
  }

  return "GitHub sign-in failed.";
}
