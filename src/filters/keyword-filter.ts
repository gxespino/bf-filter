import { FilterSettings } from '../types';
import { FilterResult, FilterStrategy } from './types';

// Normalized exact matches (case-insensitive, trailing punctuation stripped)
const EXACT_FLUFF = new Set([
  'nice', 'thanks', 'thank you', 'thx', 'ty',
  '+1', '++', 'bump', 'this', 'same', 'agreed',
  'love this', 'love it', 'awesome', 'amazing',
  'congrats', 'congratulations', 'well done',
  'great', 'great work', 'great job',
  'cool', 'neat', 'sweet', 'wow', 'yep', 'yes',
  'so cool', 'so good', 'incredible', 'brilliant',
  'huge', 'massive', 'legendary', 'fire',
  'lfg', 'lets go', "let's go", 'lgtm',
  'following', 'subscribed', 'interested',
  'me too', 'same here', 'ditto',
  'good luck', 'best of luck', 'rooting for you',
  'welcome', 'welcome aboard',
  'ha', 'haha', 'hahaha', 'lol', 'lmao',
  'woohoo', 'yay', 'woot',
  'bravo', 'kudos', 'props',
  'super', 'solid', 'tight',
  'w', 'w post', 'w take', 'l', 'big w', 'huge w',
  'king', 'queen', 'goat', 'beast', 'legend',
  'inspirational', 'inspiring',
  'needed this', 'needed to hear this',
  'so true', 'facts', 'real talk', 'real',
  'based', 'hard agree',
]);

// Regex patterns applied to trimmed (but not lowercased) text
const FLUFF_PATTERNS: RegExp[] = [
  /^congrat(s|ulations)[!.\s]*$/i,
  /^(well done|bravo|kudos|props)[!.\s]*$/i,
  /^congrat(s|ulations)\s+(on\s+)?[\w\s]{1,40}[!.]*$/i,
  /^[\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F\u200D\s]+$/u,
  /^(amazing|awesome|incredible|fantastic|brilliant|wonderful|beautiful|stunning|insane|wild|sick|dope|fire|lit|goat|beast|legend|king|queen)[!.\s]*$/i,
  /^this is (so )?(amazing|awesome|cool|great|incredible|fantastic|fire|sick|dope|wild|insane|beautiful|wonderful)[!.\s]*$/i,
  /^\+1\s/i,
  /^bump\s/i,
  /^(\w)\1{4,}[!.\s]*$/i,
  /^[wl]\s+\w+[!.\s]*$/i,
  /^holy\s+\w+[!.\s]*$/i,
];

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/[!?.,:;]+$/g, '').trim();
}

export class KeywordFilter implements FilterStrategy {
  name = 'keyword';

  test(text: string, settings: FilterSettings): FilterResult {
    if (!settings.keywordFilterEnabled) return { filtered: false };

    const normalized = normalize(text);
    if (EXACT_FLUFF.has(normalized)) {
      return { filtered: true, reason: `Low-value: "${normalized}"` };
    }

    const trimmed = text.trim();
    for (const pattern of FLUFF_PATTERNS) {
      if (pattern.test(trimmed)) {
        return { filtered: true, reason: 'Low-value pattern match' };
      }
    }

    return { filtered: false };
  }
}
