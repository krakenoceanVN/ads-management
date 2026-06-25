import type { AdType } from './bffTypes';

/**
 * Resolve a single AdType display label to its name.
 * Falls back to the label itself when no map/array is provided or no match is found.
 *
 * Note: `label` is the DTO's `adTypeCode` field, which is now sourced from
 * AdType.name (since the old AdType.code column was dropped).
 */
export function formatAdTypeDisplay(
  label: string | null | undefined,
  map?: Map<string, string> | AdType[]
): string {
  if (!label) return '';
  if (map instanceof Map) return map.get(label) ?? label;
  if (Array.isArray(map)) {
    const hit = map.find(at => at.name === label);
    return hit?.name ?? label;
  }
  return label;
}

/**
 * Join multiple AdType labels into a comma-separated name list, preserving order.
 */
export function formatAdTypeLabels(
  labels: Array<string | null | undefined>,
  map?: Map<string, string> | AdType[]
): string {
  return labels
    .filter((c): c is string => !!c)
    .map(c => formatAdTypeDisplay(c, map))
    .join(', ');
}
