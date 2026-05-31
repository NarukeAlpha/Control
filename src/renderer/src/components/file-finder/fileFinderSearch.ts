import type { RepoTreeEntry } from "@shared/github";

function fuzzySubsequenceIndex(value: string, token: string): number | null {
  let tokenIndex = 0;
  let firstMatchIndex: number | null = null;

  for (let index = 0; index < value.length && tokenIndex < token.length; index += 1) {
    if (value[index] === token[tokenIndex]) {
      firstMatchIndex ??= index;
      tokenIndex += 1;
    }
  }

  return tokenIndex === token.length ? firstMatchIndex : null;
}

function fileFinderTokenScore(entry: RepoTreeEntry, token: string): number | null {
  const path = entry.path.toLowerCase();
  const name = (entry.path.split("/").pop() ?? entry.path).toLowerCase();
  const nameIndex = name.indexOf(token);
  if (nameIndex >= 0) {
    return nameIndex;
  }

  const pathIndex = path.indexOf(token);
  if (pathIndex >= 0) {
    return 100 + pathIndex;
  }

  const nameFuzzyIndex = fuzzySubsequenceIndex(name, token);
  if (nameFuzzyIndex !== null) {
    return 200 + nameFuzzyIndex;
  }

  const pathFuzzyIndex = fuzzySubsequenceIndex(path, token);
  return pathFuzzyIndex === null ? null : 400 + pathFuzzyIndex;
}

export function fileFinderMatchScore(entry: RepoTreeEntry, query: string): number | null {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return entry.type === "dir" ? 20 : 10;
  }

  const tokenScores = normalizedQuery
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => fileFinderTokenScore(entry, token));

  if (tokenScores.some((score) => score === null)) {
    return null;
  }

  const typeBias = entry.type === "file" ? 0 : 15;
  let total = typeBias;
  for (const score of tokenScores) {
    total += score ?? 0;
  }
  return total;
}
