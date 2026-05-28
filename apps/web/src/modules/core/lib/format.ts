const numberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
});

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

const percentFormatter = new Intl.NumberFormat('en-US', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export const formatNumber = (value: number): string => numberFormatter.format(value);

export const formatCurrency = (value: number): string => currencyFormatter.format(value);

/** Accepts a ratio (0..1) and renders as a percentage. */
export const formatPercent = (ratio: number): string => percentFormatter.format(ratio);

/** Renders a 0..100 percentage value already expressed in points. */
export const formatPercentPoints = (points: number): string => `${numberFormatter.format(points)}%`;

export const formatDateTime = (iso: string): string => {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return dateTimeFormatter.format(parsed);
};

export const formatRelativeTime = (iso: string): string => {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  const diffMs = parsed.getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / 60_000);
  const absMinutes = Math.abs(diffMinutes);
  const rtf = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' });
  if (absMinutes < 60) return rtf.format(diffMinutes, 'minute');
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return rtf.format(diffHours, 'hour');
  return rtf.format(Math.round(diffHours / 24), 'day');
};

/** Shorten a run/day uuid to a stable, legible token for dense tables. */
export const shortId = (id: string): string => id.slice(0, 8);
