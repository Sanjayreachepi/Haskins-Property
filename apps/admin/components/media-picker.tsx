"use client";
type Media = {
  id: number;
  filename: string;
  original_name: string;
  mime: string;
  alt: string;
};
type Item = { url: string; alt?: string; title?: string };
export default function MediaPicker({
  media,
  data,
  onChange,
}: {
  media: Media[];
  data: Record<string, any>;
  onChange: (key: string, value: any) => void;
}) {
  const images = media.filter((m) => m.mime.startsWith("image/"));
  const documents = media.filter((m) => m.mime === "application/pdf");
  function toggle(key: string, m: Media) {
    const url = "/api/media/" + m.filename;
    const current: Item[] = data[key] || [];
    onChange(
      key,
      current.some((i) => i.url === url)
        ? current.filter((i) => i.url !== url)
        : [...current, { url, alt: m.alt, title: m.original_name }],
    );
  }
  return (
    <>
      <label>
        Choose uploaded cover image
        <select
          value={data.image?.startsWith("/api/media/") ? data.image : ""}
          onChange={(e) => {
            onChange("image", e.target.value);
            const image = images.find(
              (m) => "/api/media/" + m.filename === e.target.value,
            );
            if (image) onChange("imageAlt", image.alt);
          }}
        >
          <option value="">Select from the media library</option>
          {images.map((m) => (
            <option key={m.id} value={"/api/media/" + m.filename}>
              {m.original_name}
            </option>
          ))}
        </select>
      </label>
      {images.length > 0 && (
        <fieldset className="media-options">
          <legend>Additional gallery images</legend>
          {images.map((m) => (
            <label className="checkbox" key={m.id}>
              <input
                type="checkbox"
                checked={(data.gallery || []).some(
                  (i: Item) => i.url === "/api/media/" + m.filename,
                )}
                onChange={() => toggle("gallery", m)}
              />
              {m.original_name}
            </label>
          ))}
        </fieldset>
      )}
      {documents.length > 0 && (
        <fieldset className="media-options">
          <legend>Public downloadable documents</legend>
          {documents.map((m) => (
            <label className="checkbox" key={m.id}>
              <input
                type="checkbox"
                checked={(data.documents || []).some(
                  (i: Item) => i.url === "/api/media/" + m.filename,
                )}
                onChange={() => toggle("documents", m)}
              />
              {m.original_name}
            </label>
          ))}
        </fieldset>
      )}
      <small>
        Upload files in Media library first. These images and documents are
        public assets.
      </small>
    </>
  );
}
