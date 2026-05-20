export class GitHubRequestDedupe {
  private readonly inFlight = new Map<string, Promise<unknown>>();

  run<T>(key: string, load: () => Promise<T>): Promise<T> {
    const existing = this.inFlight.get(key) as Promise<T> | undefined;
    if (existing) {
      return existing;
    }

    const promise = load().finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, promise);
    return promise;
  }

  invalidatePrefix(prefix: string): void {
    for (const key of this.inFlight.keys()) {
      if (key.startsWith(prefix) || key.startsWith(`force:${prefix}`)) {
        this.inFlight.delete(key);
      }
    }
  }

  clear(): void {
    this.inFlight.clear();
  }
}
