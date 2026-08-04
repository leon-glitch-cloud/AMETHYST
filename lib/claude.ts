import Anthropic from "@anthropic-ai/sdk";

export function createClaudeClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY ist nicht gesetzt");
  }

  return new Anthropic({ apiKey });
}
