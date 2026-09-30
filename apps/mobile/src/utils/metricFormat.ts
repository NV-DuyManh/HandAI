/**
 * Universal metric formatting for HandAI research metrics.
 * Eliminates floating point inaccuracies like 16.700000000000003%.
 * Examples:
 * 16.700000000000003 => 16.7%
 * 7.777777777777 => 7.8%
 * 2 => 2%
 */
export function formatMetricPercent(
  value: number | string | undefined | null,
  options?: { withSign?: boolean }
): string {
  if (value === undefined || value === null || value === '') return '—';
  const cleanVal = typeof value === 'string' ? value.replace(/[+%]/g, '').trim() : value;
  const num = typeof cleanVal === 'string' ? parseFloat(cleanVal) : cleanVal;
  if (isNaN(num)) return String(value);

  // Round to at most 1 decimal place
  const rounded = Math.round(num * 10) / 10;
  // If whole number, format without decimals (e.g. 2, 80, 100)
  // If has fractional part, format with 1 decimal (e.g. 16.7, 7.8)
  const isWhole = rounded % 1 === 0;
  const formattedNum = isWhole ? rounded.toFixed(0) : rounded.toFixed(1);

  if (options?.withSign && rounded > 0) {
    return `+${formattedNum}%`;
  }
  return `${formattedNum}%`;
}

export function formatSeconds(
  value: number | string | undefined | null,
  defaultVal = '—'
): string {
  if (value === undefined || value === null || value === '') return defaultVal;
  const cleanVal = typeof value === 'string' ? String(value).replace(/s$/i, '').trim() : value;
  const num = typeof cleanVal === 'string' ? parseFloat(cleanVal) : cleanVal;
  if (isNaN(num)) return defaultVal;
  const rounded = Math.round(num * 10) / 10;
  const isWhole = rounded % 1 === 0;
  return `${isWhole ? rounded.toFixed(0) : rounded.toFixed(1)}s`;
}
