import { describe, expect, it } from "vitest";

import { parseGitHubRemoteUrl } from "./gitRemote";

describe("parseGitHubRemoteUrl", () => {
  it.each([
    ["https://github.com/NarukeAlpha/Control.git", "NarukeAlpha", "Control"],
    ["https://github.com/NarukeAlpha/Control", "NarukeAlpha", "Control"],
    ["git@github.com:NarukeAlpha/Control.git", "NarukeAlpha", "Control"],
    ["ssh://git@github.com/NarukeAlpha/Control.git", "NarukeAlpha", "Control"]
  ])("normalizes %s", (remoteUrl, owner, repo) => {
    expect(parseGitHubRemoteUrl(remoteUrl)).toEqual({
      owner,
      repo,
      url: `https://github.com/${owner}/${repo}`
    });
  });

  it("ignores non-GitHub remotes", () => {
    expect(parseGitHubRemoteUrl("git@example.com:owner/repo.git")).toBeNull();
  });
});
