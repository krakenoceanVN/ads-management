import { menu } from './data';

export const FEATURE_FLAGS = {
  settlement: true,
} as const;

export const FALLBACK_PAGE = 'pAdvertiserList';

const settlementKeys = new Set(['mSettlement', 'pAdvSettlement', 'pMediaSettlement']);

export const visibleMenu = menu.filter(group => FEATURE_FLAGS.settlement || group.key !== 'mSettlement');

export function isPageEnabled(pageKey: string) {
  if (!FEATURE_FLAGS.settlement && settlementKeys.has(pageKey)) return false;
  return true;
}
