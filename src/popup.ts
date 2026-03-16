import { FilterSettings } from './types';
import { loadSettings, saveSettings } from './storage/settings';

const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;

const enabledEl = $<HTMLInputElement>('enabled');
const settingsBody = $<HTMLDivElement>('settings-body');
const minCharsEl = $<HTMLInputElement>('minChars');
const minCharsValueEl = $<HTMLSpanElement>('minCharsValue');
const keywordFilterEl = $<HTMLInputElement>('keywordFilter');
const lengthFilterEl = $<HTMLInputElement>('lengthFilter');
const aiFilterEl = $<HTMLInputElement>('aiFilter');
const aiSectionEl = $<HTMLDivElement>('aiSection');
const aiApiKeyEl = $<HTMLInputElement>('aiApiKey');
const countEl = $<HTMLSpanElement>('count');

async function render(): Promise<void> {
  const settings = await loadSettings();

  enabledEl.checked = settings.enabled;
  settingsBody.classList.toggle('disabled', !settings.enabled);

  minCharsEl.value = String(settings.minCharThreshold);
  minCharsValueEl.textContent = String(settings.minCharThreshold);

  keywordFilterEl.checked = settings.keywordFilterEnabled;
  lengthFilterEl.checked = settings.lengthFilterEnabled;
  aiFilterEl.checked = settings.aiFilterEnabled;
  aiSectionEl.classList.toggle('visible', settings.aiFilterEnabled);
  aiApiKeyEl.value = settings.aiApiKey || '';

  // Get filtered count from content script
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab?.id) {
      chrome.tabs.sendMessage(
        tab.id,
        { type: 'getFilteredCount' },
        (response) => {
          if (response?.count !== undefined) {
            countEl.textContent = String(response.count);
          }
        }
      );
    }
  } catch {
    // Tab not available
  }
}

async function save(partial: Partial<FilterSettings>): Promise<void> {
  const current = await loadSettings();
  await saveSettings({ ...current, ...partial });
}

enabledEl.addEventListener('change', () => {
  const enabled = enabledEl.checked;
  settingsBody.classList.toggle('disabled', !enabled);
  save({ enabled });
});

minCharsEl.addEventListener('input', () => {
  minCharsValueEl.textContent = minCharsEl.value;
  save({ minCharThreshold: Number(minCharsEl.value) });
});

keywordFilterEl.addEventListener('change', () => {
  save({ keywordFilterEnabled: keywordFilterEl.checked });
});

lengthFilterEl.addEventListener('change', () => {
  save({ lengthFilterEnabled: lengthFilterEl.checked });
});

aiFilterEl.addEventListener('change', () => {
  const checked = aiFilterEl.checked;
  aiSectionEl.classList.toggle('visible', checked);
  save({ aiFilterEnabled: checked });
});

// Debounce API key saves
let apiKeyTimeout: ReturnType<typeof setTimeout>;
aiApiKeyEl.addEventListener('input', () => {
  clearTimeout(apiKeyTimeout);
  apiKeyTimeout = setTimeout(() => {
    save({ aiApiKey: aiApiKeyEl.value.trim() });
  }, 500);
});

render();
