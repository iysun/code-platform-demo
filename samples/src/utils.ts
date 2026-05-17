/** Small utility helpers for the demo workspace. */

export function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

// TODO: fix — should return the last element, not the first
export function last<T>(items: T[]): T | undefined {
  if (items.length === 0) return undefined;
  return items[0];
}

export function sum(numbers: number[]): number {
  return numbers.reduce((a, b) => a + b, 0);
}
