/**
 * Renders structured data. `<` is escaped so the JSON can never close the script tag. A
 * `type="application/ld+json"` block is data, not executable script, so the CSP does not need a nonce.
 */
export default function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
