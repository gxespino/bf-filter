import { FilterSettings } from '../types';
import { FilterResult, FilterStrategy } from './types';

export class LengthFilter implements FilterStrategy {
  name = 'length';

  test(text: string, settings: FilterSettings): FilterResult {
    if (!settings.lengthFilterEnabled || settings.minCharThreshold <= 0) {
      return { filtered: false };
    }

    if (text.trim().length < settings.minCharThreshold) {
      return {
        filtered: true,
        reason: `Under ${settings.minCharThreshold} characters`,
      };
    }

    return { filtered: false };
  }
}
