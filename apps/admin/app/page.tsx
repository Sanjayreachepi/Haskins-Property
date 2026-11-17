"use client";
import { useEffect, useState } from "react";
import { pageBlocks } from "@haskins/shared";
import BlockEditor from "../components/block-editor";
import MfaPanel from "../components/mfa-panel";
import Loader from "../components/loader";
import CountUp from "../components/count-up";
import PointerGlow from "../components/pointer-glow";
import MediaPicker from "../components/media-picker";
import AccountManager from "../components/account-manager";
import TenantServicesManager from "../components/tenant-services-manager";
import { api } from "../lib/api";
type RecordRow = {
  id: number;
  kind: string;
  slug: string;
  title: string;
  entity_id: number | null;
  property_id: number | null;
  payload: Record<string, any>;
  published_payload: Record<string, any> | null;
  updated_at: string;
};
const sections = [
  ["dashboard", "Overview"],
  ["property", "Properties"],
  ["space", "Available spaces"],
  ["page", "Pages & SEO"],
  ["entity", "Legal entities"],
  ["settings", "Site settings"],
  ["payment", "Payment instructions"],
  ["media", "Media library"],
  ["inquiries", "Inquiry inbox"],
  ["audit", "Activity log"],
  ["users", "Accounts & roles"],
  ["tenant-services", "Tenant services"],
  ["account", "My account"],
];
const empty = (kind: string): RecordRow => ({
  id: 0,
  kind,
  slug: "",
  title: "",
  entity_id: null,
  property_id: null,
  payload: {},
  published_payload: null,
  updated_at: "",
});
/** Live SEO guidance for the record being edited: [passes, message]. */
function seoChecks(r: RecordRow): [boolean, string][] {
  const p = r.payload || {};
  const title = (p.seoTitle || "").trim();
  const desc = (p.seoDescription || "").trim();
  const out: [boolean, string][] = [];
  out.push([
    title.length >= 20 && title.length <= 60,
    title
      ? `SEO title is ${title.length} characters (best: 20–60)`
      : "No SEO title yet — the page title is used (best: write one of 20–60 characters)",
  ]);
  out.push([
    desc.length >= 100 && desc.length <= 160,
    desc
      ? `Meta description is ${desc.length} characters (best: 100–160)`
      : "No meta description yet — add one of 100–160 characters; it is the text shown in search results",
  ]);
  out.push([!!(p.targetPhrase || "").trim(), "A target key phrase is set"]);
  if (title && p.targetPhrase)
    out.push([
      title.toLowerCase().includes(String(p.targetPhrase).toLowerCase()),
      "The SEO title contains the target phrase",
    ]);
  if (r.kind !== "page") {
    out.push([!!p.image, "A photo is set"]);
    out.push([!!(p.imageAlt || "").trim(), "The photo has descriptive alt text"]);
    out.push([!!(p.location || "").trim(), "A location is set"]);
  }
  out.push([
    !p.canonical || /^https:\/\//.test(p.canonical),
    "Canonical URL is empty (automatic) or a full https:// address",
  ]);
  out.push([!p.noindex, "Visible to search engines (not marked no-index)"]);
  return out;
}

export default function Admin() {
  const [user, setUser] = useState<any>(null),
    [ready, setReady] = useState(false),
    [records, setRecords] = useState<RecordRow[]>([]),
    [section, setSection] = useState("dashboard"),
    [selected, setSelected] = useState<RecordRow | null>(null),
    [media, setMedia] = useState<any[]>([]),
    [activity, setActivity] = useState<any[]>([]),
    [inquiries, setInquiries] = useState<any[]>([]),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [query, setQuery] = useState(""),
    [confirmPayee, setConfirmPayee] = useState(false),
    [challenge, setChallenge] = useState("");
  // ADMIN_MFA_REQUIRED: an administrator without two-step sign-in sees only the set-up screen
  const mfaGate = !!user && user.mfaRequired && !user.mfaEnabled;
  async function refresh() {
    setRecords(await api("admin/records"));
  }
  useEffect(() => {
    api("admin/me")
      .then(async (u) => {
        setUser(u);
        if (!(u.mfaRequired && !u.mfaEnabled)) await refresh();
      })
      .catch((e) => {
        if (e.status !== 401) setError(e.message);
      })
      .finally(() => setReady(true));
  }, []);
  useEffect(() => {
    if (
      user &&
      selected &&
      ["property", "space", "page"].includes(selected.kind)
    ) {
      api("admin/media")
        .then(setMedia)
        .catch((e) => setError(e.message));
    }
  }, [user, selected?.id, selected?.kind]);
  async function task(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
    } catch (e: any) {
      setError(e.message);
      if (e.status === 401 || e.status === 403) setUser(null);
    } finally {
      setBusy(false);
    }
  }
  function navigate(key: string) {
    setSection(key);
    setSelected(null);
    setMessage("");
    setError("");
    setQuery("");
    if (key === "media") task(async () => setMedia(await api("admin/media")));
    if (key === "inquiries")
      task(async () => setInquiries(await api("admin/inquiries")));
    if (key === "audit")
      task(async () => setActivity(await api("admin/audit")));
  }
  function field(key: string, value: any) {
    setSelected((s) =>
      s ? { ...s, payload: { ...s.payload, [key]: value } } : s,
    );
    setConfirmPayee(false);
  }
  function top(key: string, value: any) {
    setSelected((s) => (s ? { ...s, [key]: value } : s));
    setConfirmPayee(false);
  }
  async function save(publish = false) {
    if (!selected) return;
    await task(async () => {
      const result = await api("admin/records", "POST", selected);
      setSelected({ ...selected, id: result.id });
      if (publish)
        await api(`admin/records/${result.id}/publish`, "POST", {
          confirmPayee,
        });
      const next = await api("admin/records");
      setRecords(next);
      setSelected(next.find((r: RecordRow) => r.id === result.id));
      setMessage(
        publish
          ? "Published successfully. Content is available through the CMS API."
          : "Draft saved. Published content stays live until you publish changes.",
      );
      setConfirmPayee(false);
    });
  }
  if (!ready) return <Loader />;
  if (!user)
    return (
      <main className="login">
        <div className="login-brand">
          <img
            className="brand-logo"
            src="/images/logo-light.svg"
            alt="Haskins Industrial Complex"
            width="220"
            height="95"
          />
          <p className="eyebrow">SOUTH SAN FRANCISCO · STAFF WORKSPACE</p>
          <h1>
            An industrial
            <br />
            legacy.<span className="login-accent">every detail in place.</span>
          </h1>
          <p className="login-description">
            A dedicated workspace for the properties, people and details behind
            the Haskins portfolio.
          </p>
          <figure className="login-archive">
            <img
              src="/images/buzz_haskins_yard_monitor_bg_1920_1080.webp"
              alt="Archival aerial photograph of the Haskins property in South San Francisco"
              width="720"
              height="405"
            />
            <figcaption>
              THE HASKINS ARCHIVE <span>SOUTH SAN FRANCISCO, CA ↗</span>
            </figcaption>
          </figure>
        </div>
        {challenge ? (
        <form
          key="mfa-step"
          className="login-form"
          onSubmit={(e) => {
            e.preventDefault();
            const code = String(new FormData(e.currentTarget).get("code") || "");
            task(async () => {
              try {
                await api("auth/mfa", "POST", { challenge, code });
              } catch (err: any) {
                if (err.status === 429 || /expired|again/i.test(err.message)) setChallenge("");
                throw err;
              }
              setChallenge("");
              const me = await api("admin/me");
              setUser(me);
              await refresh();
            });
          }}
        >
          <p className="eyebrow">TWO-STEP SIGN-IN</p>
          <h2>Enter your code.</h2>
          <p>Open your authenticator app and type the 6-digit code for Haskins Admin. Lost your phone? Use one of your recovery codes.</p>
          <label>
            Code
            <input name="code" autoComplete="one-time-code" inputMode="text" autoFocus required maxLength={20} />
          </label>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <button disabled={busy}>{busy ? "Checking…" : "Verify →"}</button>
          <small>
            <button type="button" className="text-button" onClick={() => { setChallenge(""); setError(""); }}>
              ← Use a different account
            </button>
          </small>
        </form>
        ) : (
        <form
          key="password-step"
          className="login-form"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            task(async () => {
              const account = await api("auth/login", "POST", {
                email: f.get("email"),
                password: f.get("password"),
              });
              if (account.mfaRequired) {
                setChallenge(account.challenge);
                return;
              }
              if (account.role !== "admin") {
                await api("auth/logout", "POST", {});
                throw Error(
                  "This workspace is for administrators. Your account role is " +
                    account.role +
                    ".",
                );
              }
              const me = await api("admin/me");
              setUser(me);
              if (!(me.mfaRequired && !me.mfaEnabled)) await refresh();
            });
          }}
        >
          <p className="eyebrow">STAFF ACCESS</p>
          <h2>Welcome back.</h2>
          <p>Sign in to manage your portfolio and website.</p>
          <label>
            Email address
            <input name="email" type="email" autoComplete="username" required />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <button disabled={busy}>{busy ? "Signing in…" : "Sign in →"}</button>
          <small>
            <a href="/reset-password">Forgot your password?</a> · Access is restricted to authorized Haskins staff.
          </small>
        </form>
        )}
      </main>
    );
  if (mfaGate)
    return (
      <main className="login mfa-gate">
        <div className="login-brand">
          <img className="brand-logo" src="/images/logo-light.svg" alt="Haskins Industrial Complex" width="220" height="95" />
          <p className="eyebrow">SOUTH SAN FRANCISCO · STAFF WORKSPACE</p>
          <h1>
            One more
            <br />
            step.<span className="login-accent">keep the keys safe.</span>
          </h1>
          <p className="login-description">
            Two-step sign-in is required for administrators. Set it up once with an authenticator app on your phone.
          </p>
        </div>
        <div className="login-form">
          <MfaPanel
            onEnabled={() =>
              task(async () => {
                const me = await api("admin/me");
                setUser(me);
                await refresh();
              })
            }
          />
          <button
            type="button"
            className="text-button"
            onClick={() => task(async () => { await api("auth/logout", "POST", {}); setUser(null); })}
          >
            Sign out
          </button>
        </div>
      </main>
    );
  const list = records.filter(
    (r) =>
      r.kind === section &&
      (r.title + " " + r.slug).toLowerCase().includes(query.toLowerCase()),
  );
  const entities = records.filter((r) => r.kind === "entity"),
    properties = records.filter((r) => r.kind === "property");
  const input = (key: string, label: string, multiline = false) => (
    <label key={key}>
      {label}
      {multiline ? (
        <textarea
          rows={key === "content" ? 10 : 4}
          value={selected?.payload[key] || ""}
          onChange={(e) => field(key, e.target.value)}
        />
      ) : (
        <input
          value={selected?.payload[key] || ""}
          onChange={(e) => field(key, e.target.value)}
        />
      )}
    </label>
  );
  return (
    <div className="admin-shell" data-busy={busy ? "" : undefined}>
      <PointerGlow />
      <aside className="sidebar">
        <a className="brand" href="/">
          <img
            className="brand-logo"
            src="/images/logo-light.svg"
            alt="Haskins Industrial Complex"
            width="190"
            height="82"
          />
          <small>ADMINISTRATION WORKSPACE</small>
        </a>
        <p className="nav-label">WORKSPACE</p>
        <nav>
          {sections.map(([key, label]) => (
            <button
              className={section === key ? "active" : ""}
              onClick={() => navigate(key)}
              key={key}
            >
              {label}
              <span>↗</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span className="status-dot" /> Connected to Haskins CMS
          <p>
            {user.email}
            <br />
            Role: {user.role}
          </p>
          <button
            onClick={() =>
              task(async () => {
                await api("auth/logout", "POST", {});
                setUser(null);
                setRecords([]);
                setSelected(null);
              })
            }
          >
            Sign out
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header>
          <span>
            HASKINS / <b>{sections.find(([k]) => k === section)?.[1]}</b>
          </span>
          <a
            href={process.env.NEXT_PUBLIC_WEB_URL || "http://localhost:3000"}
            target="_blank"
            rel="noreferrer"
          >
            View website ↗
          </a>
        </header>
        <main key={section + ":" + (selected ? (selected.id ?? "new") : "list")}>
          <div className="page-heading">
            <div>
              <p className="eyebrow">PROPERTY & CONTENT MANAGEMENT</p>
              <h1>
                {selected
                  ? selected.id
                    ? "Edit " + selected.title
                    : "Create " + section
                  : sections.find(([k]) => k === section)?.[1]}
              </h1>
              <p>Keep your portfolio accurate, organized and up to date.</p>
            </div>
            {!selected &&
              ![
                "dashboard",
                "media",
                "audit",
                "inquiries",
                "account",
                "users",
                "tenant-services",
              ].includes(section) && (
                <button
                  onClick={() => {
                    setSelected(empty(section));
                    setConfirmPayee(false);
                  }}
                >
                  + Add {section === "entity" ? "legal entity" : section}
                </button>
              )}
          </div>
          {error && (
            <div role="alert" className="error">
              {error}
            </div>
          )}
          {message && (
            <div role="status" className="success">
              {message}
            </div>
          )}
          {section === "dashboard" && (
            <>
              <div className="stats">
                {[
                  ["Properties", properties.length],
                  [
                    "Available spaces",
                    records.filter(
                      (r) => r.kind === "space" && r.published_payload,
                    ).length,
                  ],
                  [
                    "Managed pages",
                    records.filter((r) => r.kind === "page").length,
                  ],
                  ["Legal entities", entities.length],
                ].map(([title, n]) => (
                  <article key={title}>
                    <p>{title}</p>
                    <strong>
                      <CountUp to={Number(n)} />
                    </strong>
                  </article>
                ))}
              </div>
              <div className="panel welcome">
                <p className="eyebrow">YOUR WORKSPACE</p>
                <h2>
                  One portfolio.<em>Clear ownership.</em>
                </h2>
                <p>
                  Manage property details, publish available spaces and keep
                  every page discoverable. Save drafts while you work, then
                  publish when ready.
                </p>
                <button onClick={() => navigate("property")}>
                  Manage properties →
                </button>
              </div>
              <div className="panel">
                <h2>Recently updated</h2>
                {[...records]
                  .sort(
                    (a, b) =>
                      Date.parse(b.updated_at) - Date.parse(a.updated_at),
                  )
                  .slice(0, 6)
                  .map((r) => (
                    <button
                      className="recent"
                      key={r.id}
                      onClick={() => {
                        setSection(r.kind);
                        setSelected(r);
                      }}
                    >
                      <span>
                        {r.title}
                        <small>{r.kind}</small>
                      </span>
                      <span className="badge">
                        {r.published_payload ? "Published" : "Draft"}
                      </span>
                    </button>
                  ))}
              </div>
            </>
          )}
          {!selected &&
            ![
              "dashboard",
              "media",
              "audit",
              "inquiries",
              "account",
              "users",
              "tenant-services",
            ].includes(section) && (
              <div className="panel">
                <div className="list-tools">
                  <input
                    aria-label="Search records"
                    placeholder="Search by title or URL…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <span>{list.length} records</span>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th>URL slug</th>
                        <th>Status</th>
                        <th>Updated</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((r) => (
                        <tr key={r.id}>
                          <td>
                            <strong>{r.title}</strong>
                            {r.entity_id && (
                              <small>
                                {
                                  entities.find((e) => e.id === r.entity_id)
                                    ?.title
                                }
                              </small>
                            )}
                          </td>
                          <td>{r.slug}</td>
                          <td>
                            <span
                              className={
                                "badge " + (!r.published_payload ? "draft" : "")
                              }
                            >
                              {!r.published_payload
                                ? "Draft"
                                : JSON.stringify(r.payload) !==
                                      JSON.stringify(r.published_payload) ||
                                    r.slug !== (r as any).published_slug ||
                                    r.title !== (r as any).published_title
                                  ? "Unpublished changes"
                                  : "Published"}
                            </span>
                          </td>
                          <td>{new Date(r.updated_at).toLocaleDateString()}</td>
                          <td>
                            <button
                              className="text-button"
                              onClick={() => {
                                setSelected(r);
                                setConfirmPayee(false);
                              }}
                            >
                              Edit →
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!list.length && (
                  <p className="empty">
                    No records yet. Add your first {section} to get started.
                  </p>
                )}
              </div>
            )}
          {selected && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                save(false);
              }}
            >
              <button
                type="button"
                className="text-button"
                onClick={() => setSelected(null)}
              >
                ← Back to list
              </button>
              <div className="editor">
                <div>
                  <section className="panel">
                    <h2>Basic information</h2>
                    <label>
                      Title / name
                      <input
                        required
                        value={selected.title}
                        onChange={(e) => top("title", e.target.value)}
                      />
                    </label>
                    <label>
                      URL slug
                      <input
                        required
                        pattern="[a-z0-9]+(-[a-z0-9]+)*"
                        value={selected.slug}
                        onChange={(e) => top("slug", e.target.value)}
                      />
                      <small>
                        Use lowercase words separated by hyphens. Page slugs
                        match existing website routes.
                      </small>
                    </label>
                    {selected.kind === "property" && (
                      <label>
                        Property owner — required
                        <select
                          required
                          value={selected.entity_id || ""}
                          onChange={(e) =>
                            top("entity_id", Number(e.target.value))
                          }
                        >
                          <option value="">Choose owning legal entity</option>
                          {entities.map((e) => (
                            <option key={e.id} value={e.id}>
                              {e.title}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    {["space", "payment"].includes(selected.kind) && (
                      <label>
                        Related property
                        <select
                          required
                          value={selected.property_id || ""}
                          onChange={(e) =>
                            top("property_id", Number(e.target.value))
                          }
                        >
                          <option value="">Choose property</option>
                          {properties.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.title}
                            </option>
                          ))}
                        </select>
                        <small>
                          Owner:{" "}
                          {entities.find(
                            (e) =>
                              e.id ===
                              properties.find(
                                (p) => p.id === selected.property_id,
                              )?.entity_id,
                          )?.title || "Select a property"}
                        </small>
                      </label>
                    )}
                    {["property", "space"].includes(selected.kind) && (
                      <>
                        {input("type", "Property / space type")}
                        {input("location", "Address / location")}
                        {input("description", "Description", true)}
                        {input(
                          "ownershipNote",
                          "Ownership / land-interest notes",
                          true,
                        )}
                        {selected.kind === "property" && (
                          <>
                            <label className="checkbox">
                              <input
                                type="checkbox"
                                checked={!!selected.payload.landOnly}
                                onChange={(e) => field("landOnly", e.target.checked)}
                              />{" "}
                              Land interest only — this entity owns the land, not the
                              building (shows a "land only" notice everywhere this
                              property appears; the note above is the wording)
                            </label>
                            {input("ownershipShare", "Partial ownership share (e.g. 25%) — leave empty if it owns 100%")}
                          </>
                        )}
                      </>
                    )}
                    {selected.kind === "entity" &&
                      input("legalName", "Exact legal entity name")}
                    {["page", "settings"].includes(selected.kind) &&
                      input("content", "Page content (plain text)", true)}
                    {selected.kind === "page" &&
                      (pageBlocks[selected.slug] || []).length > 0 && (
                        <BlockEditor slug={selected.slug} blocks={selected.payload.blocks} media={media} onChange={(v) => field("blocks", v)} />
                      )}
                    {selected.kind === "settings" && (
                      <>
                        {input("contactEmail", "Management email")}
                        {input("contactPhone", "Management phone")}
                        {input("address", "Management address")}
                      </>
                    )}
                    {selected.kind === "payment" && (
                      <>
                        <p className="notice">
                          Payment instructions stay private to the API
                          administration. Tenant delivery requires authenticated
                          tenancy access.
                        </p>
                        {input("payee", "Exact legal payee")}
                        {input("method", "Payment method")}
                        {input("instructions", "Remittance instructions", true)}
                      </>
                    )}
                  </section>
                  {["property", "space", "page"].includes(selected.kind) && (
                    <section className="panel">
                      <h2>Photography & public documents</h2>
                      <MediaPicker
                        media={media}
                        data={selected.payload}
                        onChange={field}
                      />
                      {input("image", "Image path (from Media library)")}
                      {input("imageAlt", "Descriptive image alt text")}
                      {selected.payload.image && (
                        <img
                          className="image-preview"
                          src={
                            selected.payload.image.startsWith("/images/")
                              ? (process.env.NEXT_PUBLIC_WEB_URL ||
                                  "http://localhost:3000") +
                                selected.payload.image
                              : selected.payload.image
                          }
                          alt={selected.payload.imageAlt || "Selected image"}
                        />
                      )}
                    </section>
                  )}
                  {selected.kind === "settings" && (
                    <section className="panel">
                      <h2>Search engines &amp; business profile</h2>
                      <p>
                        Used on every page of the website: the site name, default
                        description and image for search results and social sharing,
                        and the business details search engines read (structured
                        data).
                      </p>
                      {input("seoSiteName", "Site / business name (default: Haskins Industrial Complex)")}
                      {input("seoDefaultDescription", "Default meta description (used when a page has none)", true)}
                      {input("seoDefaultImage", "Default social sharing image (path from the Media library, 1200×630 works best)")}
                      {input("orgLogo", "Logo image path (from the Media library)")}
                      {input("socialLinks", "Official social profiles — one full https:// address per line", true)}
                      {input("twitterHandle", "X / Twitter handle, e.g. @haskins")}
                      {input("googleVerification", "Google Search Console verification code (the content value of the meta tag)")}
                      {input("bingVerification", "Bing Webmaster verification code")}
                      {input("redirects", "Redirects — one per line:  /old-page -> /new-page   (add 302 at the end for a temporary redirect; lines starting with # are notes)", true)}
                    </section>
                  )}
                  {["page", "property", "space"].includes(selected.kind) && (
                    <section className="panel">
                      <h2>Search engine optimization</h2>
                      {input("targetPhrase", "Target key phrase")}
                      {input("seoTitle", "SEO title")}
                      {input("seoDescription", "Meta description", true)}
                      <ul className="seo-checks" aria-label="SEO checklist">
                        {seoChecks(selected).map(([ok, msg]) => (
                          <li key={msg} className={ok ? "ok" : "warn"}>
                            <span aria-hidden="true">{ok ? "✓" : "!"}</span> {msg}
                          </li>
                        ))}
                      </ul>
                      {input("canonical", "Canonical URL (optional HTTPS URL)")}
                      {input("ogImage", "Social sharing image path")}
                      <label className="checkbox">
                        <input
                          type="checkbox"
                          checked={!!selected.payload.noindex}
                          onChange={(e) => field("noindex", e.target.checked)}
                        />{" "}
                        Hide from search indexing
                      </label>
                      <div className="seo-preview">
                        <small>SEARCH PREVIEW</small>
                        <h3>{selected.payload.seoTitle || selected.title}</h3>
                        <p>
                          {selected.payload.seoDescription ||
                            selected.payload.description ||
                            "Add a description for this page."}
                        </p>
                      </div>
                    </section>
                  )}
                </div>
                <aside className="panel publish-panel">
                  <h2>Publishing</h2>
                  <span className="badge">
                    {selected.published_payload
                      ? "Published version exists"
                      : "Draft"}
                  </span>
                  <p>
                    Save a draft to review your changes. Publish to release this
                    version in the CMS.
                  </p>
                  {selected.kind === "payment" && (
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        checked={confirmPayee}
                        onChange={(e) => setConfirmPayee(e.target.checked)}
                      />{" "}
                      I have checked the property, owning entity and legal
                      payee.
                    </label>
                  )}
                  <button disabled={busy} type="submit">
                    Save draft
                  </button>
                  <button
                    className="secondary"
                    disabled={
                      busy || (selected.kind === "payment" && !confirmPayee)
                    }
                    type="button"
                    onClick={() => save(true)}
                  >
                    Save & publish ↗
                  </button>
                  {selected.published_payload && (
                    <button
                      className="text-button"
                      disabled={busy}
                      type="button"
                      onClick={() => {
                        if (
                          window.confirm(
                            "Remove this record from published CMS content?",
                          )
                        )
                          task(async () => {
                            await api(
                              `admin/records/${selected.id}/unpublish`,
                              "POST",
                              {},
                            );
                            await refresh();
                            setSelected(null);
                            setMessage("Record unpublished");
                          });
                      }}
                    >
                      Unpublish
                    </button>
                  )}
                  <small>
                    Payment instructions are never included in the public
                    content API.
                  </small>
                </aside>
              </div>
            </form>
          )}
          {section === "media" && (
            <>
              <form
                className="panel upload"
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const data = new FormData(form);
                  task(async () => {
                    await api("admin/media", "POST", data);
                    setMedia(await api("admin/media"));
                    form.reset();
                    setMessage("File uploaded");
                  });
                }}
              >
                <h2>Upload to media library</h2>
                <p>
                  Public website assets only. JPG, PNG, WebP or PDF · maximum 10
                  MB. Tenant documents must not be uploaded here.
                </p>
                <label>
                  File
                  <input
                    type="file"
                    name="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    required
                  />
                </label>
                <label>
                  Image description / alt text
                  <input name="alt" maxLength={500} />
                </label>
                <button disabled={busy}>Upload file ↑</button>
              </form>
              <div className="media-grid">
                {media.map((m) => (
                  <article className="panel" key={m.id}>
                    {m.mime.startsWith("image/") ? (
                      <img src={"/api/media/" + m.filename} alt={m.alt} />
                    ) : (
                      <div className="pdf">PDF</div>
                    )}
                    <h3>{m.original_name}</h3>
                    <label>
                      Alt text
                      <input
                        defaultValue={m.alt}
                        onBlur={(e) => {
                          if (e.target.value !== m.alt) {
                            const alt = e.target.value;
                            task(async () => {
                              await api("admin/media/" + m.id, "PATCH", {
                                alt,
                              });
                              setMedia(await api("admin/media"));
                              setMessage("Image description updated");
                            });
                          }
                        }}
                      />
                    </label>
                    <code>/api/media/{m.filename}</code>
                    <button
                      className="text-button"
                      onClick={() =>
                        task(async () => {
                          await navigator.clipboard.writeText(
                            "/api/media/" + m.filename,
                          );
                          setMessage("Media path copied");
                        })
                      }
                    >
                      Copy path
                    </button>
                  </article>
                ))}
              </div>
            </>
          )}
          {section === "tenant-services" && <TenantServicesManager />}
          {section === "users" && (
            <AccountManager
              currentUserId={user.id}
              records={records}
              onUnauthorized={() => setUser(null)}
            />
          )}
          {section === "account" && (
            <form
              className="panel"
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const f = new FormData(form);
                task(async () => {
                  await api("admin/password", "POST", {
                    currentPassword: f.get("current"),
                    newPassword: f.get("next"),
                  });
                  form.reset();
                  setMessage(
                    "Password updated. Other sessions have been signed out.",
                  );
                });
              }}
            >
              <h2>Change password</h2>
              <label>
                Current password
                <input
                  type="password"
                  name="current"
                  autoComplete="current-password"
                  required
                />
              </label>
              <label>
                New password
                <input
                  type="password"
                  name="next"
                  minLength={12}
                  maxLength={256}
                  autoComplete="new-password"
                  required
                />
              </label>
              <button disabled={busy}>Update password</button>
            </form>
          )}
          {section === "account" && <MfaPanel />}
          {section === "inquiries" && (
            <div className="panel table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Received</th>
                    <th>Contact</th>
                    <th>Inquiry</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {inquiries.map((i) => (
                    <tr key={i.id}>
                      <td>{new Date(i.created_at).toLocaleString()}</td>
                      <td>
                        <strong>{i.name}</strong>
                        <small>{i.email}</small>
                      </td>
                      <td>
                        <strong>{i.category}</strong>
                        <small>{i.property_name || "General"}</small>
                        <p style={{ whiteSpace: "pre-wrap", maxWidth: 460 }}>
                          {i.message}
                        </p>
                      </td>
                      <td>
                        <select
                          aria-label="Inquiry status"
                          value={i.status}
                          disabled={busy}
                          onChange={(e) => {
                            const status = e.target.value;
                            task(async () => {
                              await api("admin/inquiries/" + i.id, "PATCH", {
                                status,
                              });
                              setInquiries(await api("admin/inquiries"));
                            });
                          }}
                        >
                          {["new", "in-progress", "resolved"].map((v) => (
                            <option key={v}>{v}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!inquiries.length && <p className="empty">No inquiries yet.</p>}
            </div>
          )}
          {section === "audit" && (
            <div className="panel table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Record</th>
                    <th>Administrator</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {activity.map((a) => (
                    <tr key={a.id}>
                      <td>{a.action}</td>
                      <td>{a.record_id || "—"}</td>
                      <td>{a.email}</td>
                      <td>{new Date(a.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!activity.length && (
                <p className="empty">
                  Activity will appear here as you manage content.
                </p>
              )}
            </div>
          )}
        </main>
        <footer>
          HASKINS INDUSTRIAL COMPLEX <span>Administration workspace</span>
        </footer>
      </div>
    </div>
  );
}
