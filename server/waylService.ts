import "./loadEnv.ts";
import axios, { AxiosError, AxiosInstance } from "axios";

const WAYL_AUTH_HEADER = "X-WAYL-AUTHENTICATION";
const WAYL_DEFAULT_CURRENCY = "IQD";

function envTrim(key: string): string {
  return process.env[key]?.trim() ?? "";
}

function getWaylBaseUrl(): string {
  return envTrim("WAYL_BASE_URL") || "https://api.thewayl.com";
}

function getWaylApiKey(): string {
  return envTrim("WAYL_API_KEY");
}

function getWaylCheckoutPath(): string {
  return envTrim("WAYL_CHECKOUT_PATH");
}

/**
 * Wayl must receive a non-localhost webhook URL in the link payload.
 * If WAYL_WEBHOOK_URL is empty or uses localhost, substitute LAN host from env.
 * For production use a public HTTPS URL (e.g. ngrok or your domain).
 */
export function resolveWaylWebhookUrl(): string {
  let url = envTrim("WAYL_WEBHOOK_URL");
  const lan =
    envTrim("WAYL_PUBLIC_HOST") ||
    envTrim("DEV_LAN_HOST") ||
    envTrim("EXPO_PUBLIC_DEV_LAN_HOST");
  const port = envTrim("PORT") || "4001";

  if (!url && lan) {
    return `http://${lan}:${port}/api/payments/wayl/webhook`;
  }

  if (url && (/localhost|127\.0\.0\.1/i.test(url) || /:\/\/localhost/i.test(url)) && lan) {
    try {
      const normalized = /^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? url : `http://${url}`;
      const u = new URL(normalized);
      u.hostname = lan;
      if (!u.port) u.port = port;
      return u.toString().replace(/\/$/, "");
    } catch {
      /* keep url */
    }
  }

  return url;
}

function getWebhookSecret(): string {
  return envTrim("WAYL_WEBHOOK_SECRET");
}

type WaylApiErrorBody = {
  message?: string;
  error?: string;
};

export class WaylHttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "WaylHttpError";
  }
}

export type WaylCustomerDetails = {
  name: string;
  email?: string;
  phone?: string;
  [key: string]: unknown;
};

export type CreateCheckoutSessionParams = {
  amount: number;
  description: string;
  customer_details: WaylCustomerDetails;
  currency?: string;
  success_url?: string;
  failure_url?: string;
  cancel_url?: string;
  metadata?: Record<string, unknown>;
};

type LinkCreatePayload = {
  referenceId: string;
  total: number;
  currency: string;
  customParameter?: string;
  lineItem: Array<{ label: string; amount: number; type: "increase" }>;
  webhookUrl: string;
  webhookSecret: string;
  success_url: string;
  failure_url: string;
  redirectionUrl?: string;
};

export class WaylService {
  private readonly http: AxiosInstance;

  constructor(apiKey: string = getWaylApiKey(), baseUrl: string = getWaylBaseUrl()) {
    const cleanKey = apiKey.trim();
    if (!cleanKey) {
      throw new WaylHttpError(500, "WAYL_API_KEY is missing in environment variables");
    }

    this.http = axios.create({
      baseURL: baseUrl,
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
        [WAYL_AUTH_HEADER]: cleanKey,
      },
      validateStatus: () => true,
    });
  }

  async verifyKey(): Promise<{ valid: boolean; message: string }> {
    const response = await this.http.get("/api/v1/verify-auth-key");
    if (response.status >= 200 && response.status < 300) {
      return { valid: true, message: "Wayl API key is valid" };
    }
    throw this.toWaylError(response.status, response.data);
  }

  async createCheckoutSession(
    params: CreateCheckoutSessionParams,
  ): Promise<{ checkoutUrl: string; raw: unknown }> {
    const amount = Number(params.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new WaylHttpError(400, "amount must be a positive number");
    }
    const amountForGateway = Math.round(amount);
    console.log("[Wayl] FINAL amount (IQD, whole units):", amountForGateway);
    if (!Number.isInteger(amountForGateway) || amountForGateway <= 0) {
      throw new WaylHttpError(400, "amount must be a positive integer for the payment gateway");
    }
    if (!params.description?.trim()) {
      throw new WaylHttpError(400, "description is required");
    }
    if (!params.customer_details || !params.customer_details.name) {
      throw new WaylHttpError(400, "customer_details.name is required");
    }

    const payload = {
      amount: amountForGateway,
      currency: params.currency || WAYL_DEFAULT_CURRENCY,
      description: params.description.trim(),
      customer_details: params.customer_details,
      ...(params.success_url ? { success_url: params.success_url } : {}),
      ...(params.failure_url ? { failure_url: params.failure_url } : {}),
      ...(params.cancel_url ? { cancel_url: params.cancel_url } : {}),
      ...(params.metadata ? { metadata: params.metadata } : {}),
    };

    const buildLinkPayload = (): LinkCreatePayload => {
      const bookingId = String(params.metadata?.bookingId ?? "").trim();
      const referenceIdRaw = String(params.metadata?.referenceId ?? "").trim();
      const referenceId = referenceIdRaw || bookingId || `shootha-${Date.now()}`;
      const successUrl = String(params.success_url ?? "").trim();
      const failureUrl = String(params.failure_url ?? params.cancel_url ?? "").trim();
      const webhookUrl = resolveWaylWebhookUrl().trim();
      if (!successUrl) {
        throw new WaylHttpError(400, "success_url is required for Wayl link creation");
      }
      if (!failureUrl) {
        throw new WaylHttpError(400, "failure_url is required for Wayl link creation");
      }
      if (!webhookUrl) {
        throw new WaylHttpError(
          500,
          "WAYL_WEBHOOK_URL is missing. Set WAYL_WEBHOOK_URL or WAYL_PUBLIC_HOST / DEV_LAN_HOST / EXPO_PUBLIC_DEV_LAN_HOST with PORT.",
        );
      }

      const customParameter = JSON.stringify({
        bookingId: bookingId || undefined,
        referenceId,
      });

      const secret = getWebhookSecret() || "shootha-dev-webhook-secret";

      return {
        referenceId,
        total: amountForGateway,
        currency: params.currency || WAYL_DEFAULT_CURRENCY,
        customParameter,
        lineItem: [
          {
            label: params.description.trim(),
            amount: amountForGateway,
            type: "increase",
          },
        ],
        webhookUrl,
        webhookSecret: secret,
        success_url: successUrl,
        failure_url: failureUrl,
        redirectionUrl: successUrl,
      };
    };

    const candidateEndpoints = [
      ...(getWaylCheckoutPath() ? [getWaylCheckoutPath()] : []),
      "/api/v1/create-checkout-session",
      "/api/v1/checkout-session",
      "/api/v1/checkout/create-session",
      "/api/v1/checkout",
      "/api/v1/links",
    ].filter((x, i, arr) => arr.indexOf(x) === i);

    let response:
      | {
          status: number;
          data: unknown;
          endpoint: string;
        }
      | undefined;

    for (const endpoint of candidateEndpoints) {
      const isLinksEndpoint =
        endpoint === "/api/v1/links" || /\/v\d+\/links\/?$/i.test(endpoint);
      const requestPayload = isLinksEndpoint ? buildLinkPayload() : payload;
      console.log("[Wayl] POST", endpoint, {
        payloadKeys:
          requestPayload && typeof requestPayload === "object"
            ? Object.keys(requestPayload as object)
            : [],
      });
      const r = await this.http.post(endpoint, requestPayload);
      console.log("[Wayl] response", {
        status: r.status,
        endpoint,
        data: r.data,
      });
      response = { status: r.status, data: r.data, endpoint };
      if (r.status >= 200 && r.status < 300) break;
      if (r.status === 400 || r.status === 401) {
        throw this.toWaylError(r.status, r.data);
      }
      if (r.status !== 404) {
        throw this.toWaylError(r.status, r.data);
      }
    }

    if (!response) {
      throw new WaylHttpError(502, "Wayl API did not return a response");
    }
    if (response.status < 200 || response.status >= 300) {
      const details = {
        message:
          "Wayl checkout endpoint not found. Verify the exact create-session path in your Wayl docs.",
        triedEndpoints: candidateEndpoints,
        lastTried: response.endpoint,
        upstreamStatus: response.status,
        upstreamBody: response.data,
      };
      throw new WaylHttpError(404, "Wayl checkout endpoint not found", details);
    }

    const data = (response.data ?? {}) as Record<string, unknown>;
    const checkoutUrl =
      (typeof data.checkout_url === "string" && data.checkout_url) ||
      (typeof data.checkoutUrl === "string" && data.checkoutUrl) ||
      (typeof data.url === "string" && data.url) ||
      (typeof data.data === "object" &&
      data.data &&
      typeof (data.data as Record<string, unknown>).url === "string"
        ? ((data.data as Record<string, unknown>).url as string)
        : "") ||
      "";

    if (!checkoutUrl) {
      throw new WaylHttpError(
        502,
        "Wayl response did not include a checkout URL",
        response.data,
      );
    }

    return { checkoutUrl, raw: response.data };
  }

  async validateTransaction(
    transactionId: string,
  ): Promise<{ paid: boolean; status: string; raw: unknown }> {
    const txId = String(transactionId ?? "").trim();
    if (!txId) {
      throw new WaylHttpError(400, "transactionId is required");
    }

    const candidates: Array<() => Promise<{ status: number; data: unknown }>> = [
      async () => {
        const r = await this.http.get(`/api/v1/transactions/${encodeURIComponent(txId)}`);
        return { status: r.status, data: r.data };
      },
      async () => {
        const r = await this.http.get(`/api/v1/transaction/${encodeURIComponent(txId)}`);
        return { status: r.status, data: r.data };
      },
      async () => {
        const r = await this.http.post("/api/v1/validate-transaction", {
          transaction_id: txId,
        });
        return { status: r.status, data: r.data };
      },
    ];

    let lastStatus = 0;
    let lastData: unknown = undefined;

    for (const run of candidates) {
      const response = await run();
      lastStatus = response.status;
      lastData = response.data;
      if (response.status >= 200 && response.status < 300) {
        const normalized = this.normalizePaymentStatus(response.data);
        return {
          paid: normalized === "PAID",
          status: normalized,
          raw: response.data,
        };
      }
      if (response.status === 401 || response.status === 400) {
        throw this.toWaylError(response.status, response.data);
      }
    }

    throw this.toWaylError(lastStatus || 502, lastData);
  }

  static isWaylHttpError(error: unknown): error is WaylHttpError {
    return error instanceof WaylHttpError;
  }

  private toWaylError(status: number, data: unknown): WaylHttpError {
    const body = (data ?? {}) as WaylApiErrorBody;
    if (status === 401) {
      return new WaylHttpError(
        401,
        "Unauthorized: invalid Wayl API key (X-WAYL-AUTHENTICATION)",
        data,
      );
    }
    if (status === 400) {
      return new WaylHttpError(
        400,
        body.message || body.error || "Bad Request: invalid Wayl checkout payload",
        data,
      );
    }
    return new WaylHttpError(
      status || 502,
      body.message || body.error || "Wayl API request failed",
      data,
    );
  }

  private normalizePaymentStatus(data: unknown): string {
    const obj = (data ?? {}) as Record<string, unknown>;
    const nestedData =
      obj.data && typeof obj.data === "object" && !Array.isArray(obj.data)
        ? (obj.data as Record<string, unknown>)
        : undefined;
    const statusRaw =
      obj.payment_status ??
      obj.paymentStatus ??
      obj.status ??
      nestedData?.payment_status ??
      nestedData?.paymentStatus ??
      nestedData?.status ??
      "";
    return String(statusRaw).trim().toUpperCase();
  }
}

export function mapWaylException(error: unknown): WaylHttpError {
  if (error instanceof WaylHttpError) return error;
  if (axios.isAxiosError(error)) {
    const e = error as AxiosError<WaylApiErrorBody>;
    return new WaylHttpError(
      e.response?.status || 502,
      e.response?.data?.message || e.response?.data?.error || e.message || "Wayl API error",
      e.response?.data,
    );
  }
  if (error instanceof Error) {
    return new WaylHttpError(500, error.message);
  }
  return new WaylHttpError(500, "Unexpected Wayl integration error");
}
