import type { AdType } from './bffTypes';

/**
 * Resolve a single AdType code to its display name.
 * Falls back to the code itself when no map/array is provided or no match is found.
 */
export function formatAdTypeDisplay(
  code: string | null | undefined,
  map?: Map<string, string> | AdType[]
): string {
  if (!code) return '';
  if (map instanceof Map) return map.get(code) ?? code;
  if (Array.isArray(map)) {
    const hit = map.find(at => at.code === code);
    return hit?.name ?? code;
  }
  return code;
}

/**
 * Join multiple AdType codes into a comma-separated name list, preserving order.
 */
export function formatAdTypeLabels(
  codes: Array<string | null | undefined>,
  map?: Map<string, string> | AdType[]
): string {
  return codes
    .filter((c): c is string => !!c)
    .map(c => formatAdTypeDisplay(c, map))
    .join(', ');
}
