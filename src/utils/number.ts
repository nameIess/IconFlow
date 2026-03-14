export function toPositiveInt(value: unknown, fallback: number): number {
  const num = Number(value);
  return Number.isInteger(num) && num > 0 ? num : fallback;
}