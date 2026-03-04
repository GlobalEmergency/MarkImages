export interface IHttpClient {
  get<T>(path: string, params?: Record<string, string | number>): Promise<T>;
  post<T>(path: string, body?: unknown): Promise<T>;
  patch<T>(path: string, body?: unknown): Promise<T>;
}
