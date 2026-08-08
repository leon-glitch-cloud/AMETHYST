export function ProductSearchButton({
  url,
  shop,
}: {
  url: string | null;
  shop?: string | null;
}) {
  if (!url) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
    >
      {shop ? `Bei ${shop} ansehen` : "Produktsuche öffnen"}
    </a>
  );
}
