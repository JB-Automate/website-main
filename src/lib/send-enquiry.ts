import type { ProductionContactConfig } from "./contact-config.ts";
import type { Enquiry } from "./contact-validation.ts";

export const ENQUIRY_PROVIDER_TIMEOUT_MS = 8_000;

export type DeliveryFailureReason = "rejected" | "timeout" | "transport" | "invalid_response";

export class EnquiryDeliveryError extends Error {
  readonly reason: DeliveryFailureReason;
  readonly providerStatus: number | undefined;

  constructor(reason: DeliveryFailureReason, providerStatus?: number) {
    super(`Enquiry delivery failed: ${reason}`);
    this.name = "EnquiryDeliveryError";
    this.reason = reason;
    this.providerStatus = providerStatus;
  }
}

export interface SendEnquiryOptions {
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
}

function isTransportError(error: unknown): boolean {
  return error instanceof TypeError ||
    (error instanceof DOMException && (error.name === "AbortError" || error.name === "TimeoutError"));
}

export async function sendEnquiry(
  enquiry: Enquiry,
  config: ProductionContactConfig,
  options: SendEnquiryOptions = {},
): Promise<{ id: string }> {
  const fetcher = options.fetch ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? ENQUIRY_PROVIDER_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError("The enquiry provider timeout must be positive.");
  }

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const error = new EnquiryDeliveryError("timeout");
      reject(error);
      controller.abort(error);
    }, timeoutMs);
  });

  async function deliver(): Promise<{ id: string }> {
    let response: Response;
    try {
      response = await fetcher("https://api.resend.com/emails", {
        method: "POST",
        redirect: "error",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${config.resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: config.fromEmail,
          to: [config.toEmail],
          reply_to: enquiry.email,
          subject: "New website enquiry",
          text: [
            `Name: ${enquiry.name}`,
            `Email: ${enquiry.email}`,
            `Business: ${enquiry.company || "Not provided"}`,
            "",
            "What would you like to make easier or build?",
            "",
            enquiry.message,
          ].join("\n"),
        }),
      });
    } catch (error) {
      if (isTransportError(error)) {
        throw new EnquiryDeliveryError(controller.signal.aborted ? "timeout" : "transport");
      }
      throw error;
    }

    if (response.status !== 200 && response.status !== 201) {
      throw new EnquiryDeliveryError(response.ok ? "invalid_response" : "rejected", response.status);
    }
    if (!/^application\/json(?:\s*;|$)/i.test(response.headers.get("content-type") ?? "")) {
      throw new EnquiryDeliveryError("invalid_response", response.status);
    }

    let receipt: unknown;
    try {
      receipt = await response.json();
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new EnquiryDeliveryError("invalid_response", response.status);
      }
      if (isTransportError(error)) {
        throw new EnquiryDeliveryError(controller.signal.aborted ? "timeout" : "transport");
      }
      throw error;
    }

    if (
      !receipt ||
      typeof receipt !== "object" ||
      Array.isArray(receipt) ||
      !("id" in receipt) ||
      typeof receipt.id !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(receipt.id) ||
      "error" in receipt
    ) {
      throw new EnquiryDeliveryError("invalid_response", response.status);
    }
    return { id: receipt.id };
  }

  try {
    // Keep the whole operation bounded, including a stalled response body.
    return await Promise.race([deliver(), deadline]);
  } finally {
    clearTimeout(timer);
  }
}
