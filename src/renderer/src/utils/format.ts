const compactWholeNumberFormatter = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 0
});

const compactDecimalNumberFormatter = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1
});

const currentYearDateFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric"
});

const previousYearDateFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric"
});

export function formatCompactNumber(value: number): string {
  if (value < 1000) {
    return `${value}`;
  }

  return (value >= 10_000 ? compactWholeNumberFormatter : compactDecimalNumberFormatter).format(value);
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

  const date = new Date(timestamp);
  const formatter =
    new Date().getFullYear() === date.getFullYear() ? currentYearDateFormatter : previousYearDateFormatter;
  return formatter.format(date);
}

export function firstMarkdownHeading(markdown: string | null): string {
  if (!markdown) {
    return "README";
  }

  let inFence = false;
  let previousContentLine: string | null = null;
  let lineStart = 0;

  for (let index = 0; index <= markdown.length; index += 1) {
    if (index < markdown.length && markdown[index] !== "\n") {
      continue;
    }

    const line = markdown.slice(lineStart, index).replace(/\r$/, "");
    const trimmed = line.trim();

    if (/^```/.test(trimmed) || /^~~~/.test(trimmed)) {
      inFence = !inFence;
      previousContentLine = null;
      lineStart = index + 1;
      continue;
    }

    if (!inFence) {
      const heading = line.match(/^\s*#\s+(.+)$/);
      if (heading) {
        return heading[1].trim() || "README";
      }

      if (/^\s*=+\s*$/.test(line) && previousContentLine) {
        return previousContentLine;
      }

      previousContentLine = trimmed ? trimmed : null;
    }

    lineStart = index + 1;
  }

  return "README";
}
