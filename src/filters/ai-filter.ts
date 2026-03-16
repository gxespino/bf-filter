import { FilterSettings } from '../types';
import { FilterResult } from './types';

const BATCH_PROMPT = `You are a forum comment quality classifier for a startup community. Classify each numbered comment as LOW or HIGH value.

LOW-VALUE: congratulatory fluff, one-word reactions, emoji-only, generic encouragement, memes/jokes with no info, repetitive agreement
HIGH-VALUE: substantive feedback/advice/critique, questions that drive discussion, personal experience/data, counterarguments, specific suggestions, links/resources

Return ONLY a JSON array of objects, one per comment, in order:
[{"id": 1, "low": true, "reason": "brief reason"}, ...]

Comments:`;

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const AI_MODEL = 'claude-haiku-4-5-20251001';
const MAX_PROMPT_TEXT_LENGTH = 300;
const MAX_CACHE_ENTRIES = 500;

// Persists across SPA navigations within the same tab, clears on tab close
const SESSION_CACHE_KEY = 'bf-filter-ai-cache';
const NOT_FILTERED: FilterResult = { filtered: false };

function loadCache(): Map<string, FilterResult> {
  try {
    const raw = sessionStorage.getItem(SESSION_CACHE_KEY);
    if (!raw) return new Map();
    return new Map(JSON.parse(raw) as [string, FilterResult][]);
  } catch {
    return new Map();
  }
}

function saveCache(c: Map<string, FilterResult>): void {
  try {
    sessionStorage.setItem(
      SESSION_CACHE_KEY,
      JSON.stringify(Array.from(c.entries()).slice(-MAX_CACHE_ENTRIES))
    );
  } catch { /* sessionStorage full or unavailable */ }
}

const cache = loadCache();

function toCacheKey(text: string): string {
  return text.trim().toLowerCase();
}

function truncate(text: string): string {
  return text.length > MAX_PROMPT_TEXT_LENGTH
    ? text.slice(0, MAX_PROMPT_TEXT_LENGTH) + '...'
    : text;
}

/**
 * Classify multiple comments in a single API call.
 * Deduplicates and caches results. Returns a Map from original text to FilterResult.
 */
export async function classifyBatch(
  texts: string[],
  settings: FilterSettings
): Promise<Map<string, FilterResult>> {
  const results = new Map<string, FilterResult>();

  if (!settings.aiFilterEnabled || !settings.aiApiKey || texts.length === 0) {
    return results;
  }

  // Split into cached hits and unique uncached texts
  const uncachedMap = new Map<string, string>();
  for (const text of texts) {
    const key = toCacheKey(text);
    const cached = cache.get(key);
    if (cached) {
      results.set(text, cached);
    } else if (!uncachedMap.has(key)) {
      uncachedMap.set(key, text);
    }
  }

  const uncachedTexts = Array.from(uncachedMap.values());
  if (uncachedTexts.length === 0) return results;

  const numbered = uncachedTexts
    .map((t, i) => `${i + 1}. "${truncate(t)}"`)
    .join('\n');

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': settings.aiApiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: AI_MODEL,
        max_tokens: 1024,
        messages: [
          { role: 'user', content: `${BATCH_PROMPT}\n\n${numbered}` },
        ],
      }),
    });

    if (!response.ok) {
      console.warn('[BF Filter] AI API error:', response.status);
      return results;
    }

    const data = await response.json();
    const content = data.content?.[0]?.text || '';

    // Response may include markdown code fences; extract the JSON array
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.warn('[BF Filter] AI response missing JSON array');
      return results;
    }

    const classifications: Array<{ id: number; low: boolean; reason?: string }> =
      JSON.parse(jsonMatch[0]);

    for (const item of classifications) {
      const idx = item.id - 1;
      if (idx < 0 || idx >= uncachedTexts.length) continue;

      const text = uncachedTexts[idx];
      const result: FilterResult = item.low
        ? { filtered: true, reason: `AI: ${item.reason || 'low-value'}` }
        : NOT_FILTERED;

      cache.set(toCacheKey(text), result);
      results.set(text, result);
    }

    // Default unclassified comments to not-filtered
    for (const text of uncachedTexts) {
      if (!results.has(text)) {
        cache.set(toCacheKey(text), NOT_FILTERED);
        results.set(text, NOT_FILTERED);
      }
    }

    saveCache(cache);
  } catch (err) {
    console.warn('[BF Filter] AI batch failed:', err);
  }

  return results;
}

/** Classify a single comment. Used for dynamically loaded comments. */
export async function classifySingle(
  text: string,
  settings: FilterSettings
): Promise<FilterResult> {
  const cached = cache.get(toCacheKey(text));
  if (cached) return cached;

  const batch = await classifyBatch([text], settings);
  return batch.get(text) || NOT_FILTERED;
}
