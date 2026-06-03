import { describe, expect, it } from "vitest";

import { languageForCodePath } from "./codeLanguage";

describe("languageForCodePath", () => {
  it("keeps unsupported explicit filenames as plain text", () => {
    expect(languageForCodePath("Dockerfile")).toBeNull();
    expect(languageForCodePath("build/Containerfile")).toBeNull();
    expect(languageForCodePath("Makefile")).toBeNull();
    expect(languageForCodePath("CMakeLists.txt")).toBeNull();
    expect(languageForCodePath(".gitignore")).toBeNull();
  });

  it("keeps lockfiles plain text unless explicitly supported", () => {
    expect(languageForCodePath("bun.lock")).toBeNull();
    expect(languageForCodePath("package-lock.json")).toBeNull();
  });

  it("maps common code and markdown extensions", () => {
    expect(languageForCodePath("src/App.tsx")).toBe("tsx");
    expect(languageForCodePath("scripts/release.zsh")).toBe("bash");
    expect(languageForCodePath("docs/plan.mkdn")).toBe("markdown");
    expect(languageForCodePath("src/main.rs")).toBe("rust");
  });

  it("returns null for unsupported files", () => {
    expect(languageForCodePath("assets/logo.png")).toBeNull();
    expect(languageForCodePath("LICENSE")).toBeNull();
    expect(languageForCodePath("src/native.cpp")).toBeNull();
  });
});
