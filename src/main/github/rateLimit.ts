type Sleep = (durationMs: number) => Promise<void>;

export interface GitHubRequestLimiterOptions {
  readonly maxConcurrency?: number;
  readonly maxRetries?: number;
  readonly sleep?: Sleep;
}

interface QueueItem {
  run(): void;
}

export class GitHubRequestLimiter {
  private readonly maxConcurrency: number;
  private readonly maxRetries: number;
  private readonly sleep: Sleep;
  private active = 0;
  private readonly queue: QueueItem[] = [];

  constructor(options: GitHubRequestLimiterOptions = {}) {
    this.maxConcurrency = Math.max(1, options.maxConcurrency ?? 6);
    this.maxRetries = Math.max(0, options.maxRetries ?? 1);
    this.sleep = options.sleep ?? ((durationMs) => new Promise((resolve) => setTimeout(resolve, durationMs)));
  }

  run<T>(request: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const queued = {
        run: () => {
          this.active += 1;
          void this.runWithRetry(request)
            .then(resolve, reject)
            .finally(() => {
              this.active -= 1;
              this.drain();
            });
        }
      };

      this.queue.push(queued);
      this.drain();
    });
  }

  private drain(): void {
    while (this.active < this.maxConcurrency) {
      const next = this.queue.shift();
      if (!next) {
        return;
      }
      next.run();
    }
  }

  private async runWithRetry<T>(request: () => Promise<T>): Promise<T> {
    let attempt = 0;

    for (;;) {
      try {
        return await request();
      } catch (error) {
        if (attempt >= this.maxRetries || !shouldRetryGitHubRequest(error)) {
          throw error;
        }

        attempt += 1;
        await this.sleep(retryDelayMs(error));
      }
    }
  }
}

export function shouldRetryGitHubRequest(error: unknown): boolean {
  const status = githubErrorStatus(error);
  if (status === 401 || status === 404) {
    return false;
  }
  if (status === 429) {
    return true;
  }
  if (status === 403) {
    return isRateLimited(error);
  }
  return false;
}

export function retryDelayMs(error: unknown): number {
  const retryAfter = headerNumber(error, "retry-after");
  if (retryAfter !== null) {
    return Math.max(0, retryAfter * 1000);
  }

  const resetSeconds = headerNumber(error, "x-ratelimit-reset");
  if (resetSeconds !== null) {
    return Math.max(0, resetSeconds * 1000 - Date.now());
  }

  return 0;
}

function isRateLimited(error: unknown): boolean {
  if (headerNumber(error, "retry-after") !== null) {
    return true;
  }
  if (headerNumber(error, "x-ratelimit-remaining") === 0) {
    return true;
  }

  const message = error instanceof Error ? error.message : "";
  return message.toLowerCase().includes("rate limit");
}

function githubErrorStatus(error: unknown): number | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : null;
}

function headerNumber(error: unknown, headerName: string): number | null {
  const value = headerValue(error, headerName);
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function headerValue(error: unknown, headerName: string): string | number | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  const directHeaders = (error as { headers?: unknown }).headers;
  const responseHeaders = (error as { response?: { headers?: unknown } }).response?.headers;
  const headers = [directHeaders, responseHeaders];
  const normalizedName = headerName.toLowerCase();

  for (const candidate of headers) {
    if (!candidate || typeof candidate !== "object") {
      continue;
    }

    for (const [key, value] of Object.entries(candidate)) {
      if (key.toLowerCase() === normalizedName && (typeof value === "string" || typeof value === "number")) {
        return value;
      }
    }
  }

  return null;
}
