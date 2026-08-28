export function productSearchUrl(
  articleNumber: string,
  shop?: string | null,
  name?: string | null
): string {
  const query = [shop, name, `"${articleNumber}"`].filter(Boolean).join(" ");
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}
