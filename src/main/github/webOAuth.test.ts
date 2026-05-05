import { afterEach, describe, expect, it, vi } from "vitest";

import {
  defaultGitHubOAuthScopes,
  pollGitHubDeviceAuthorization,
  requestGitHubDeviceAuthorization
} from "./webOAuth";

const fetchMock = vi.fn<typeof fetch>();

describe("GitHub OAuth device flow helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("requests a GitHub device authorization", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          device_code: "device-code",
          user_code: "WDJB-MJHT",
          verification_uri: "https://github.com/login/device",
          expires_in: 900,
          interval: 5
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    const authorization = await requestGitHubDeviceAuthorization("client-id");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://github.com/login/device/code");
    expect(authorization.deviceCode).toBe("device-code");
    expect(authorization.userCode).toBe("WDJB-MJHT");
    expect(authorization.verificationUri).toBe("https://github.com/login/device");
    expect(authorization.intervalSeconds).toBe(5);
    expect(new Date(authorization.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it("uses the default device-flow scopes", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          device_code: "device-code",
          user_code: "WDJB-MJHT",
          verification_uri: "https://github.com/login/device",
          expires_in: 900,
          interval: 5
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    await requestGitHubDeviceAuthorization("client-id");

    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe("POST");
    const body = new URLSearchParams(String(init?.body));
    expect(body.get("scope")).toBe(defaultGitHubOAuthScopes);
  });

  it("returns pending when GitHub is waiting for user authorization", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "authorization_pending",
          interval: 5
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    await expect(
      pollGitHubDeviceAuthorization({ clientId: "client-id", deviceCode: "device-code" })
    ).resolves.toEqual({
      status: "pending",
      intervalSeconds: 5
    });
  });

  it("returns an access token when GitHub authorizes the device", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "gho_123",
          token_type: "bearer",
          scope: "repo read:org"
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    await expect(
      pollGitHubDeviceAuthorization({ clientId: "client-id", deviceCode: "device-code" })
    ).resolves.toEqual({
      status: "success",
      token: {
        accessToken: "gho_123",
        tokenType: "bearer",
        scope: "repo read:org"
      }
    });
  });
});
