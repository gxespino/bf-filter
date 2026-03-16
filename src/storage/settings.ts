import { DEFAULT_SETTINGS, FilterSettings } from '../types';

export async function loadSettings(): Promise<FilterSettings> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['filterSettings'], (result) => {
      const stored = (result.filterSettings || {}) as Partial<FilterSettings>;
      resolve({ ...DEFAULT_SETTINGS, ...stored });
    });
  });
}

export async function saveSettings(settings: FilterSettings): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ filterSettings: settings }, resolve);
  });
}

export function onSettingsChanged(
  callback: (settings: FilterSettings) => void
): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.filterSettings) {
      const updated = (changes.filterSettings.newValue || {}) as Partial<FilterSettings>;
      callback({ ...DEFAULT_SETTINGS, ...updated });
    }
  });
}
