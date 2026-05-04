export function formatCompactNumber(value: number): string {
  if (value < 1000) {
    return `${value}`;
  }

  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: value >= 10_000 ? 0 : 1
  }).format(value);
}

export function formatRelativeDate(value: string | null): string {
  if (!value) {
    return "Unknown";
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return "Unknown";
  }

  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.max(1, Math.round(diffMs / 60_000));
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 30) {
    return `${diffDays}d ago`;
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: new Date().getFullYear() === new Date(timestamp).getFullYear() ? undefined : "numeric"
  }).format(timestamp);
}

export function firstMarkdownHeading(markdown: string | null): string {
  if (!markdown) {
    return "README";
  }

  const heading = markdown
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.startsWith("# "));

  return heading?.replace(/^#\s+/, "").trim() || "README";
}

