export interface FilterSettings {
  enabled: boolean;
  minCharThreshold: number;
  keywordFilterEnabled: boolean;
  lengthFilterEnabled: boolean;
  aiFilterEnabled: boolean;
  aiApiKey: string;
}

export const DEFAULT_SETTINGS: FilterSettings = {
  enabled: true,
  minCharThreshold: 50,
  keywordFilterEnabled: true,
  lengthFilterEnabled: true,
  aiFilterEnabled: false,
  aiApiKey: '',
};
