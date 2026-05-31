import { describe, expect, it } from "vitest";

import { languageForCodePath } from "./codeLanguage";

describe("languageForCodePath", () => {
  it("maps explicit filenames case-insensitively", () => {
    expect(languageForCodePath("Dockerfile")).toBe("dockerfile");
    expect(languageForCodePath("build/Containerfile")).toBe("dockerfile");
    expect(languageForCodePath("Makefile")).toBe("make");
    expect(languageForCodePath("CMakeLists.txt")).toBe("cmake");
    expect(languageForCodePath(".gitignore")).toBe("git-commit");
  });

  it("keeps lockfiles plain text unless explicitly supported", () => {
    expect(languageForCodePath("bun.lock")).toBeNull();
    expect(languageForCodePath("package-lock.json")).toBeNull();
  });

  it("maps common code and markdown extensions", () => {
    expect(languageForCodePath("src/App.tsx")).toBe("tsx");
    expect(languageForCodePath("scripts/release.zsh")).toBe("zsh");
    expect(languageForCodePath("docs/plan.mkdn")).toBe("markdown");
    expect(languageForCodePath("src/main.rs")).toBe("rust");
  });

  it("returns null for unsupported files", () => {
    expect(languageForCodePath("assets/logo.png")).toBeNull();
    expect(languageForCodePath("LICENSE")).toBeNull();
  });
});
