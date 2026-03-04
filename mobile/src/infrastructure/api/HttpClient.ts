import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { ITokenStorage } from "../../domain/ports/ITokenStorage";
import { IHttpClient } from "../../domain/ports/IHttpClient";

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  message?: string;
}

/**
 * HTTP client that uses CapacitorHttp on native platforms to bypass
 * the WebView's local server interception (hostname: "deamap.es").
 * Falls back to standard fetch on web/dev.
 */
export class HttpClient implements IHttpClient {
  private onUnauthorized?: () => void;
  private readonly isNative: boolean;

  constructor(
    private readonly baseUrl: string,
    private readonly tokenStorage: ITokenStorage
  ) {
    this.isNative = Capacitor.isNativePlatform();
  }

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
    return this.request<T>(url, "GET");
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(`${this.baseUrl}${path}`, "POST", body);
  }

  async patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(`${this.baseUrl}${path}`, "PATCH", body);
  }

  private async request<T>(url: string, method: string, body?: unknown): Promise<T> {
    const token = await this.tokenStorage.getToken();
    const headers: Record<string, string> = {};

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    if (this.isNative) {
      return this.nativeRequest<T>(url, method, headers, body);
    }
    return this.webRequest<T>(url, method, headers, body);
  }

  /**
   * Native: uses CapacitorHttp.request() which goes through the native HTTP
   * engine, completely bypassing the WebView's local server.
   */
  private async nativeRequest<T>(
    url: string,
    method: string,
    headers: Record<string, string>,
    body?: unknown
  ): Promise<T> {
    const response = await CapacitorHttp.request({
      url,
      method,
      headers,
      data: body ?? undefined,
    });

    if (response.status === 401) {
      const errorData = typeof response.data === "object" ? response.data : {};
      await this.tokenStorage.removeToken();
      this.onUnauthorized?.();
      throw new ApiError(errorData?.error || errorData?.message || "Sesión expirada", 401);
    }

    if (response.status < 200 || response.status >= 300) {
      const errorData = typeof response.data === "object" ? response.data : {};
      throw new ApiError(
        errorData?.error || errorData?.message || `Error ${response.status}`,
        response.status
      );
    }

    // CapacitorHttp auto-parses JSON when Content-Type is application/json
    return response.data as T;
  }

  /**
   * Web/dev: uses standard fetch (routed through Vite proxy in development).
   */
  private async webRequest<T>(
    url: string,
    method: string,
    headers: Record<string, string>,
    body?: unknown
  ): Promise<T> {
    const response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (response.status === 401) {
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
