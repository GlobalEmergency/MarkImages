import { ITokenStorage } from "../../domain/ports/ITokenStorage";
import { IHttpClient } from "../../domain/ports/IHttpClient";

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  message?: string;
}

export class HttpClient implements IHttpClient {
  private onUnauthorized?: () => void;

  constructor(
    private readonly baseUrl: string,
    private readonly tokenStorage: ITokenStorage
  ) {}

  setOnUnauthorized(callback: () => void): void {
    this.onUnauthorized = callback;
  }

  async get<T>(path: string, params?: Record<string, string | number>): Promise<T> {
    let url = `${this.baseUrl}${path}`;
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        searchParams.set(key, String(value));
      });
      url += `?${searchParams.toString()}`;
    }
    return this.request<T>(url, { method: "GET" });
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(`${this.baseUrl}${path}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  private async request<T>(url: string, init: RequestInit): Promise<T> {
    const token = await this.tokenStorage.getToken();
    const headers = new Headers(init.headers);

    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const response = await fetch(url, { ...init, headers });

    if (response.status === 401) {
      // Read the actual server error before clearing auth state
      const errorBody = await response.json().catch(() => ({}));
      await this.tokenStorage.removeToken();
      this.onUnauthorized?.();
      throw new ApiError(errorBody.error || errorBody.message || "Sesión expirada", 401);
    }

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new ApiError(
        errorBody.error || errorBody.message || `Error ${response.status}`,
        response.status
      );
    }

    return response.json();
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}
