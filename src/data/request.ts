export interface RequestOptions {
  url: string;
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  headers?: Record<string, string>;
  body?: Record<string, unknown> | string | unknown;
  timeout?: number;
}

export interface RequestResult<T = unknown> {
  data: T | null;
  error: Error | null;
  status: number;
  ok: boolean;
}

async function doRequest<T = any>(options: RequestOptions): Promise<RequestResult<T>> {
  try {
    const controller = new AbortController();
    const timeoutId = options.timeout
      ? setTimeout(() => controller.abort(), options.timeout)
      : null;

    const fetchOptions: RequestInit = {
      method: options.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      signal: controller.signal,
    };

    if (options.body && options.method !== "GET") {
      fetchOptions.body = typeof options.body === "string"
        ? options.body
        : JSON.stringify(options.body);
    }

    const response = await fetch(options.url, fetchOptions);
    if (timeoutId) clearTimeout(timeoutId);

    let data: T | null = null;
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      data = await response.json() as T;
    } else {
      data = await response.text() as any;
    }

    if (!response.ok) {
      return {
        data,
        error: new Error(`HTTP ${response.status}: ${response.statusText}`),
        status: response.status,
        ok: false,
      };
    }

    return { data, error: null, status: response.status, ok: true };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error(String(err)),
      status: 0,
      ok: false,
    };
  }
}

// Main request function
export async function request<T = any>(options: RequestOptions): Promise<RequestResult<T>> {
  return doRequest<T>(options);
}

// Shorthand methods
request.get = <T = any>(url: string, headers?: Record<string, string>) =>
  doRequest<T>({ url, method: "GET", headers });

request.post = <T = any>(url: string, body?: any, headers?: Record<string, string>) =>
  doRequest<T>({ url, method: "POST", body, headers });

request.put = <T = any>(url: string, body?: any, headers?: Record<string, string>) =>
  doRequest<T>({ url, method: "PUT", body, headers });

request.delete = <T = any>(url: string, headers?: Record<string, string>) =>
  doRequest<T>({ url, method: "DELETE", headers });

request.patch = <T = any>(url: string, body?: any, headers?: Record<string, string>) =>
  doRequest<T>({ url, method: "PATCH", body, headers });
