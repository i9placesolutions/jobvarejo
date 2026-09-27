/**
 * Parses a price string into a number without importing editor-only helpers.
 * Accepts formats such as "19,90", "R$ 19.90", and "1.299,99".
 */
export const parsePriceValue = (value: string | number | undefined | null): number => {
  if (value === undefined || value === null) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;

  const cleaned = value.toString()
    .replace(/R\$\s*/gi, '')
    .replace(/[^\d.,-]/g, '')
    .replace(/\s/g, '')
    .trim();

  if (!cleaned) return 0;

  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');

  let decimalSeparator: ',' | '.' | null = null;
  if (lastComma !== -1 && lastDot !== -1) {
    decimalSeparator = lastComma > lastDot ? ',' : '.';
  } else if (lastComma !== -1 || lastDot !== -1) {
    const separator = lastComma !== -1 ? ',' : '.';
    const parts = cleaned.split(separator);
    const fraction = parts[1] ?? '';
    if (parts.length === 2 && fraction.length > 0 && fraction.length <= 2) {
      decimalSeparator = separator;
    }
  }

  let normalized: string;
  if (!decimalSeparator) {
    normalized = cleaned.replace(/[.,]/g, '');
  } else {
    const decimalIndex = cleaned.lastIndexOf(decimalSeparator);
    const integerPart = cleaned.slice(0, decimalIndex).replace(/[.,]/g, '');
    const fractionPart = cleaned.slice(decimalIndex + 1).replace(/[.,]/g, '');
    normalized = `${integerPart}.${fractionPart}`;
  }

  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? 0 : parsed;
};
