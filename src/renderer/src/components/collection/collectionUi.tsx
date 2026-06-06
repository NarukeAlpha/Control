interface CollectionRowClassOptions {
  selected?: boolean;
  unread?: boolean;
  withActions?: boolean;
}

export function collectionRowClassName(
  rowClassName: string,
  { selected = false, unread = false, withActions = false }: CollectionRowClassOptions = {}
): string {
  return [
    "issue-row",
    "collection-row",
    rowClassName,
    withActions ? "repository-row-with-actions" : null,
    selected ? "selected-action" : null,
    unread ? "unread-row" : null
  ]
    .filter((className): className is string => Boolean(className))
    .join(" ");
}

export function matchesCollectionFilter(values: Array<string | null | undefined>, query: string): boolean {
  if (!query) {
    return true;
  }
  return values.some((value) => (value ?? "").toLowerCase().includes(query));
}
