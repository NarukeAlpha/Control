export function matchesCollectionFilter(values: Array<string | null | undefined>, query: string): boolean {
  if (!query) {
    return true;
  }
  return values.some((value) => (value ?? "").toLowerCase().includes(query));
}
