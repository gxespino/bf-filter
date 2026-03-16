import { FilterSettings } from '../types';

export interface FilterResult {
  filtered: boolean;
  reason?: string;
}

export interface FilterStrategy {
  name: string;
  test(text: string, settings: FilterSettings): FilterResult;
}
