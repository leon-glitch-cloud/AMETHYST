export function productSearchUrl(
  articleNumber: string,
  shop?: string | null
): string {
  const query = shop ? `${shop} "${articleNumber}"` : `"${articleNumber}"`;
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}
