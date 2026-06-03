import { fileExtension, fileNameFromPath } from "@shared/filePreviewPolicy";

export type CodeLanguage =
  | "bash"
  | "css"
  | "go"
  | "html"
  | "javascript"
  | "json"
  | "jsonc"
  | "markdown"
  | "python"
  | "rust"
  | "toml"
  | "typescript"
  | "tsx"
  | "yaml";

const fileNameLanguages = new Map<string, CodeLanguage | null>([
  ["dockerfile", null],
  ["containerfile", null],
  ["makefile", null],
  ["cmakelists.txt", null],
  [".gitignore", null],
  [".gitattributes", null],
  [".gitmodules", null],
  ["package.json", "json"],
  ["tsconfig.json", "jsonc"],
  ["composer.json", "json"],
  ["package-lock.json", null],
  ["bun.lock", null],
  ["bun.lockb", null],
  ["pnpm-lock.yaml", null],
  ["yarn.lock", null]
]);

const extensionLanguages = new Map<string, CodeLanguage>([
  ["ts", "typescript"],
  ["tsx", "tsx"],
  ["js", "javascript"],
  ["jsx", "javascript"],
  ["mjs", "javascript"],
  ["cjs", "javascript"],
  ["json", "json"],
  ["jsonc", "jsonc"],
  ["css", "css"],
  ["html", "html"],
  ["md", "markdown"],
  ["markdown", "markdown"],
  ["mdown", "markdown"],
  ["mkd", "markdown"],
  ["mkdn", "markdown"],
  ["mdx", "markdown"],
  ["yml", "yaml"],
  ["yaml", "yaml"],
  ["toml", "toml"],
  ["sh", "bash"],
  ["bash", "bash"],
  ["zsh", "bash"],
  ["py", "python"],
  ["go", "go"],
  ["rs", "rust"]
]);

export function languageForCodePath(path: string): CodeLanguage | null {
  const lowerName = fileNameFromPath(path).toLowerCase();
  if (fileNameLanguages.has(lowerName)) {
    return fileNameLanguages.get(lowerName) ?? null;
  }

  const extension = fileExtension(path);
  return extension ? (extensionLanguages.get(extension) ?? null) : null;
}
