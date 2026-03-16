import { FilterSettings } from './types';
import { FilterResult } from './filters/types';
import { KeywordFilter } from './filters/keyword-filter';
import { LengthFilter } from './filters/length-filter';
import { classifyBatch, classifySingle } from './filters/ai-filter';
import { DomManipulator } from './dom/manipulator';
import { PostObserver } from './dom/observer';
import { loadSettings, onSettingsChanged } from './storage/settings';

// BF comments are <div id="comment-XXXXX"> inside <li> elements.
// We filter against the comment div but hide/reveal the parent <li>.
const COMMENT_SELECTOR = 'div[id^="comment-"]';

// AI filter skips comments longer than this — they're almost certainly substantive
const AI_MAX_CHAR_LENGTH = 500;

const lengthFilter = new LengthFilter();
const keywordFilter = new KeywordFilter();

function extractPostText(el: HTMLElement): string {
  const prose = el.querySelector('.prose');
  return prose?.textContent?.trim() || '';
}

function getFilterTarget(el: HTMLElement): HTMLElement {
  return el.closest('li') || el;
}

// YC staff have an orange badge div with text "YC" using the .rounded-xs class
function isYCStaff(el: HTMLElement): boolean {
  const badges = el.querySelectorAll('.rounded-xs');
  for (let i = 0; i < badges.length; i++) {
    if (badges[i].textContent?.trim() === 'YC') return true;
  }
  return false;
}

// A comment has valuable replies if any descendant comment is non-filtered or from YC staff.
// Uses `:scope > ol` to only check direct child reply lists (not sibling threads).
function hasValuableReplies(
  commentEl: HTMLElement,
  evaluations: Map<HTMLElement, FilterResult>
): boolean {
  const li = getFilterTarget(commentEl);
  const descendants = li.querySelectorAll<HTMLElement>(`:scope > ol ${COMMENT_SELECTOR}`);
  for (let i = 0; i < descendants.length; i++) {
    const child = descendants[i];
    if (isYCStaff(child)) return true;
    const result = evaluations.get(child);
    if (!result || !result.filtered) return true;
  }
  return false;
}

function runCheapFilters(text: string, settings: FilterSettings): FilterResult | null {
  const lenResult = lengthFilter.test(text, settings);
  if (lenResult.filtered) return lenResult;
  const kwResult = keywordFilter.test(text, settings);
  if (kwResult.filtered) return kwResult;
  return null;
}

let currentSettings: FilterSettings;
let manipulator: DomManipulator;
let observer: PostObserver;

/**
 * 3-phase pipeline for batch processing all comments on the page:
 *   Phase 1 — Cheap sync filters (keyword + length), results applied immediately
 *   Phase 2 — Batch AI classification for survivors (single API call)
 *   Phase 3 — Apply AI results with valuable-reply protection
 */
async function processAllComments(): Promise<void> {
  const commentEls = Array.from(
    document.querySelectorAll<HTMLElement>(COMMENT_SELECTOR)
  );

  const evaluations = new Map<HTMLElement, FilterResult>();
  const needsAi: Array<{ el: HTMLElement; text: string }> = [];
  const notFiltered: FilterResult = { filtered: false };

  for (const el of commentEls) {
    if (isYCStaff(el)) {
      evaluations.set(el, notFiltered);
      continue;
    }
    const text = extractPostText(el);
    if (!text) {
      evaluations.set(el, notFiltered);
      continue;
    }
    const cheapResult = runCheapFilters(text, currentSettings);
    if (cheapResult) {
      evaluations.set(el, cheapResult);
    } else if (currentSettings.aiFilterEnabled && text.length <= AI_MAX_CHAR_LENGTH) {
      needsAi.push({ el, text });
    } else {
      evaluations.set(el, notFiltered);
    }
  }

  // Apply cheap results without waiting for AI
  for (const el of commentEls) {
    const result = evaluations.get(el);
    if (result?.filtered && !hasValuableReplies(el, evaluations)) {
      manipulator.applyFilter(getFilterTarget(el), result.reason);
    }
  }

  if (needsAi.length > 0) {
    const aiResults = await classifyBatch(
      needsAi.map((item) => item.text),
      currentSettings
    );

    for (const { el, text } of needsAi) {
      evaluations.set(el, aiResults.get(text) || notFiltered);
    }

    for (const { el } of needsAi) {
      const result = evaluations.get(el);
      if (result?.filtered && !hasValuableReplies(el, evaluations)) {
        manipulator.applyFilter(getFilterTarget(el), result.reason);
      }
    }
  }
}

async function processSingleComment(el: HTMLElement): Promise<void> {
  if (isYCStaff(el)) return;

  const text = extractPostText(el);
  if (!text) return;

  const cheapResult = runCheapFilters(text, currentSettings);
  let result: FilterResult;

  if (cheapResult) {
    result = cheapResult;
  } else if (currentSettings.aiFilterEnabled && text.length <= AI_MAX_CHAR_LENGTH) {
    result = await classifySingle(text, currentSettings);
  } else {
    return;
  }

  if (!result.filtered) return;

  // Check descendants before filtering — preserve threads with valuable replies
  const li = getFilterTarget(el);
  const descendants = li.querySelectorAll<HTMLElement>(`:scope > ol ${COMMENT_SELECTOR}`);
  for (let i = 0; i < descendants.length; i++) {
    const child = descendants[i];
    if (isYCStaff(child)) return;
    const childText = extractPostText(child);
    if (!childText) continue;
    if (!runCheapFilters(childText, currentSettings)?.filtered) return;
  }

  manipulator.applyFilter(getFilterTarget(el), result.reason);
}

// Re-process on SPA navigation. BF uses client-side routing so the content
// script only loads once — we detect URL changes to catch thread navigations.
function watchForSpaNavigation(): void {
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      manipulator.removeAllFilters();
      // Short delay lets the SPA finish rendering the new page's comments
      setTimeout(() => processAllComments(), 300);
    }
  }).observe(document.body, { childList: true, subtree: true });
}

async function init(): Promise<void> {
  currentSettings = await loadSettings();
  if (!currentSettings.enabled) return;

  manipulator = new DomManipulator();

  await processAllComments();

  observer = new PostObserver((newPosts) => {
    newPosts.forEach((el) => processSingleComment(el));
  });
  observer.start(COMMENT_SELECTOR);

  watchForSpaNavigation();

  onSettingsChanged(async (newSettings) => {
    currentSettings = newSettings;
    manipulator.removeAllFilters();
    if (currentSettings.enabled) {
      await processAllComments();
    }
  });

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'getFilteredCount') {
      sendResponse({ count: manipulator.getFilteredCount() });
    }
  });
}

init();
