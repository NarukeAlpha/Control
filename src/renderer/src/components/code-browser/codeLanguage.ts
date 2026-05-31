import { fileExtension, fileNameFromPath } from "@shared/filePreviewPolicy";

export type CodeLanguage =
  | "bash"
  | "c"
  | "cmake"
  | "cpp"
  | "css"
  | "dockerfile"
  | "git-commit"
  | "go"
  | "html"
  | "java"
  | "javascript"
  | "json"
  | "jsonc"
  | "kotlin"
  | "make"
  | "markdown"
  | "php"
  | "python"
  | "ruby"
  | "rust"
  | "scss"
  | "sql"
  | "swift"
  | "toml"
  | "typescript"
  | "tsx"
  | "xml"
  | "yaml"
  | "zsh";

const fileNameLanguages = new Map<string, CodeLanguage | null>([
  ["dockerfile", "dockerfile"],
  ["containerfile", "dockerfile"],
  ["makefile", "make"],
  ["cmakelists.txt", "cmake"],
  [".gitignore", "git-commit"],
  [".gitattributes", "git-commit"],
  [".gitmodules", "git-commit"],
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
  ["scss", "scss"],
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
  ["xml", "xml"],
  ["sh", "bash"],
  ["bash", "bash"],
  ["zsh", "zsh"],
  ["py", "python"],
  ["rb", "ruby"],
  ["go", "go"],
  ["rs", "rust"],
  ["swift", "swift"],
  ["c", "c"],
  ["h", "c"],
  ["cpp", "cpp"],
  ["hpp", "cpp"],
  ["java", "java"],
  ["kt", "kotlin"],
  ["php", "php"],
  ["sql", "sql"]
]);

export function languageForCodePath(path: string): CodeLanguage | null {
  const lowerName = fileNameFromPath(path).toLowerCase();
  if (fileNameLanguages.has(lowerName)) {
    return fileNameLanguages.get(lowerName) ?? null;
  }

  const extension = fileExtension(path);
  return extension ? (extensionLanguages.get(extension) ?? null) : null;
}
