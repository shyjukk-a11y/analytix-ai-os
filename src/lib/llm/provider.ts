// Thin LLM provider layer.
//
// Every model call in the app goes through here. Today it targets OpenRouter (one API key,
// many models — the model is chosen with OPENROUTER_MODEL, e.g. a cheap "google/gemini-2.5-flash").
// OpenRouter speaks the OpenAI chat-completions shape, so swapping to a direct provider later is
// a change confined to this file.
//
// Nothing else in the codebase imports `fetch`-to-a-model directly — callers use `chatJSON()`.

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

/** True only when the AI path is switched on AND a key is present — safe to leave LLM_MODE="on" without a key. */
export function isLlmEnabled(): boolean {
  return process.env.LLM_MODE === 'on' && !!process.env.OPENROUTER_API_KEY;
}

export function llmModelName(): string {
  return process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash';
}

class LlmError extends Error {}

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new LlmError('Model did not return a JSON object.');
  }
  return JSON.parse(trimmed.slice(start, end + 1));
}

async function rawCompletion(messages: ChatMessage[], opts: { temperature: number; maxTokens: number }): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new LlmError('OPENROUTER_API_KEY is not set.');

  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json'
  };
  if (process.env.OPENROUTER_APP_URL) headers['HTTP-Referer'] = process.env.OPENROUTER_APP_URL;
  if (process.env.OPENROUTER_APP_NAME) headers['X-Title'] = process.env.OPENROUTER_APP_NAME;

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: llmModelName(),
      messages,
      response_format: { type: 'json_object' },
      temperature: opts.temperature,
      max_tokens: opts.maxTokens
    }),
    // Interview turns should feel responsive; give up rather than hang the chat.
    signal: AbortSignal.timeout(30_000)
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new LlmError(`OpenRouter ${res.status}: ${body.slice(0, 500)}`);
  }

  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new LlmError('OpenRouter returned an empty completion.');
  return content;
}

/**
 * Send a chat and get back a JSON object validated against `schema`. Retries once with a
 * stricter nudge if the first reply doesn't parse/validate. Throws on hard failure — callers
 * are expected to catch and fall back to non-AI behaviour.
 */
export async function chatJSON<T>(params: {
  system: string;
  messages: ChatMessage[];
  /** Anything with a `.parse` that throws on invalid input — a Zod schema fits directly. */
  schema: { parse: (data: unknown) => T };
  temperature?: number;
  maxTokens?: number;
}): Promise<T> {
  const base: ChatMessage[] = [{ role: 'system', content: params.system }, ...params.messages];
  const opts = { temperature: params.temperature ?? 0.4, maxTokens: params.maxTokens ?? 1400 };

  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const messages =
      attempt === 0
        ? base
        : [...base, { role: 'user' as const, content: 'Your previous reply was not valid JSON matching the required shape. Reply again with ONLY the JSON object.' }];
    try {
      const parsed = extractJsonObject(await rawCompletion(messages, opts));
      return params.schema.parse(parsed);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new LlmError('LLM call failed.');
}
