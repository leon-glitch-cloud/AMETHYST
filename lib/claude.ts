import Anthropic from "@anthropic-ai/sdk";

export function createClaudeClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY ist nicht gesetzt");
  }

  return new Anthropic({ apiKey });
}

// Loggt einen Claude-API-Fehler mit allen für die Fehlersuche relevanten
// Details (Status, Response-Body, Request-ID), statt nur "[object Object]".
export function logClaudeError(context: string, error: unknown): void {
  if (error instanceof Anthropic.APIError) {
    console.error(`[${context}] Anthropic API error`, {
      status: error.status,
      name: error.name,
      message: error.message,
      requestId: error.headers?.get("request-id"),
      body: error.error,
    });
    return;
  }

  console.error(`[${context}] Unerwarteter Fehler`, error);
}

export type ImageMediaType =
  | "image/jpeg"
  | "image/png"
  | "image/gif"
  | "image/webp";

export function toImageMediaType(mimeType: string): ImageMediaType {
  if (
    mimeType === "image/jpeg" ||
    mimeType === "image/png" ||
    mimeType === "image/gif" ||
    mimeType === "image/webp"
  ) {
    return mimeType;
  }
  return "image/jpeg";
}
