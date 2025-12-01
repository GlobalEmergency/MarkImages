/**
 * Adapter para descarga de imágenes desde SharePoint
 * Capa de Infraestructura - Implementa IImageDownloader
 */

import axios, { AxiosRequestConfig } from "axios";

import {
  IImageDownloader,
  ImageDownloadOptions,
  ImageDownloadResult,
} from "@/domain/storage/ports/IImageDownloader";

export class SharePointImageDownloader implements IImageDownloader {
  private readonly SHAREPOINT_DOMAINS = [
    "sharepoint.com",
    "sharepoint-df.com",
    "microsoft.sharepoint.com",
  ];

  canHandle(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return this.SHAREPOINT_DOMAINS.some((domain) =>
        urlObj.hostname.toLowerCase().includes(domain)
      );
    } catch {
      return false;
    }
  }

  async download(options: ImageDownloadOptions): Promise<ImageDownloadResult> {
    const { url, auth, timeout = 30000, maxRetries = 2 } = options;

    if (!this.canHandle(url)) {
      throw new Error(`URL no es de SharePoint: ${url}`);
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const config = this.buildRequestConfig(auth, timeout);
        const response = await axios.get(url, {
          ...config,
          responseType: "arraybuffer",
        });

        const buffer = Buffer.from(response.data);
        const contentType = response.headers["content-type"] || "image/jpeg";

        return {
          buffer,
          contentType,
          size: buffer.length,
          originalUrl: url,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < maxRetries) {
          // Esperar antes de reintentar (exponential backoff)
          await this.sleep(1000 * Math.pow(2, attempt));
          continue;
        }
      }
    }

    throw new Error(
      `Failed to download image from SharePoint after ${maxRetries + 1} attempts: ${lastError?.message}`
    );
  }

  private buildRequestConfig(
    auth?: ImageDownloadOptions["auth"],
    timeout?: number
  ): AxiosRequestConfig {
    const config: AxiosRequestConfig = {
      timeout,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    };

    if (!auth || auth.type === "none") {
      return config;
    }

    if (auth.type === "cookies" && auth.cookies) {
      const cookieString = Object.entries(auth.cookies)
        .map(([key, value]) => `${key}=${value}`)
        .join("; ");

      config.headers = {
        ...config.headers,
        Cookie: cookieString,
      };
    } else if (auth.type === "bearer" && auth.token) {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${auth.token}`,
      };
    } else if (auth.type === "basic" && auth.username && auth.password) {
      config.auth = {
        username: auth.username,
        password: auth.password,
      };
    }

    return config;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
