const DEFAULT_BASE = "https://api.example.com/v1";

export type ApiConfig = {
  baseUrl?: string;
  timeoutMs?: number;
};

export class ApiClient {
  constructor(private readonly config: ApiConfig = {}) {}

  get baseUrl(): string {
    return this.config.baseUrl ?? DEFAULT_BASE;
  }

  async fetchJson<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.config.timeoutMs ?? 10_000
    );
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} for ${path}`);
      }
      return (await res.json()) as T;
    } finally {
      clearTimeout(timeout);
    }
  }
}
