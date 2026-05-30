const numberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
});

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export const formatNumber = (value: number): string => numberFormatter.format(value);

export const formatCurrency = (value: number): string => currencyFormatter.format(value);

/** Renders a 0..100 percentage value already expressed in points. */
export const formatPercentPoints = (points: number): string => `${numberFormatter.format(points)}%`;

export const formatDateTime = (iso: string): string => {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return dateTimeFormatter.format(parsed);
};

/** Shorten a run/day uuid to a stable, legible token for dense tables. */
export const shortId = (id: string): string => id.slice(0, 8);
