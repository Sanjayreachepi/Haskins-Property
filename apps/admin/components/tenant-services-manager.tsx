"use client";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
export default function TenantServicesManager() {
  const [tenancies, setTenancies] = useState<any[]>([]),
    [documents, setDocuments] = useState<any[]>([]),
    [notices, setNotices] = useState<any[]>([]),
    [tickets, setTickets] = useState<any[]>([]),
    [selected, setSelected] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  async function load() {
    const [t, d, n, k] = await Promise.all([
      api("admin/tenancies"),
      api("admin/tenant-documents"),
      api("admin/tenant-notices"),
      api("admin/maintenance-tickets"),
    ]);
    setTenancies(t);
    setDocuments(d);
    setNotices(n);
    setTickets(k);
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);
  async function task(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const name = (id: number) => {
    const t = tenancies.find((t) => t.id === id);
    return t
      ? `${t.name} — ${t.property_name} — ${t.reference}`
      : `Tenancy #${id}`;
  };
  const audience = (
    <label>
      Share with this tenancy
      <select name="tenancy_id" required>
        <option value="">Select tenant / property / unit</option>
        {tenancies
          .filter((t) => t.active)
          .map((t) => (
            <option key={t.id} value={t.id}>
              {name(t.id)}
            </option>
          ))}
      </select>
    </label>
  );
  return (
    <>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="success" role="status">
          {message}
        </p>
      )}
      <section className="panel">
        <h2>Private tenant documents</h2>
        <p>
          Only the assigned tenancy can download these PDFs. Use this area for
          private documents.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget,
              f = new FormData(form);
            task(async () => {
              await api("admin/tenant-documents", "POST", f);
              form.reset();
              await load();
              setMessage("Private document shared with the selected tenancy.");
            });
          }}
        >
          {audience}
          <label>
            Document title
            <input name="title" maxLength={200} required />
          </label>
          <label>
            PDF (maximum 10 MB)
            <input
              name="file"
              type="file"
              accept="application/pdf,.pdf"
              required
            />
          </label>
          <button disabled={busy}>Upload and share PDF</button>
        </form>
        <ul>
          {documents.map((d) => (
            <li key={d.id}>
              <strong>{d.title}</strong> — {name(d.tenancy_id)} —{" "}
              {d.active ? "Shared" : "Revoked"}
              {!!d.active && (
                <>
                  {" "}
                  ·{" "}
                  <a href={`/api/admin/tenant-documents/${d.id}/download`}>
                    Download
                  </a>
                </>
              )}{" "}
              ·{" "}
              <button
                className="text-button"
                disabled={busy}
                onClick={() =>
                  task(async () => {
                    await api(`admin/tenant-documents/${d.id}`, "PATCH", {
                      active: !d.active,
                    });
                    await load();
                  })
                }
              >
                {d.active ? "Revoke access" : "Restore access"}
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section className="panel">
        <h2>Tenant notices</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget,
              f = new FormData(form);
            task(async () => {
              await api("admin/tenant-notices", "POST", Object.fromEntries(f));
              form.reset();
              await load();
              setMessage("Notice shared with the selected tenancy.");
            });
          }}
        >
          {audience}
          <label>
            Title
            <input name="title" maxLength={200} required />
          </label>
          <label>
            Notice
            <textarea name="content" maxLength={10000} required />
          </label>
          <button disabled={busy}>Share notice</button>
        </form>
        {notices.map((n) => (
          <article key={n.id}>
            <h3>{n.title}</h3>
            <p>
              {name(n.tenancy_id)} · {n.active ? "Shared" : "Withdrawn"}
            </p>
            <p style={{ whiteSpace: "pre-wrap" }}>{n.content}</p>
            <button
              className="text-button"
              disabled={busy}
              onClick={() =>
                task(async () => {
                  await api(`admin/tenant-notices/${n.id}`, "PATCH", {
                    active: !n.active,
                  });
                  await load();
                })
              }
            >
              {n.active ? "Withdraw notice" : "Share again"}
            </button>
          </article>
        ))}
      </section>
      <section className="panel">
        <h2>Maintenance requests</h2>
        <p>
          Replies here are visible to the tenant. Do not enter internal staff
          notes.
        </p>
        {!tickets.length && <p>No maintenance requests yet.</p>}
        {tickets.map((k) => (
          <article key={k.id}>
            <button
              className="text-button"
              disabled={busy}
              onClick={() =>
                task(async () =>
                  setSelected(await api(`admin/maintenance-tickets/${k.id}`)),
                )
              }
            >
              #{k.id} — {k.subject}
            </button>
            <p>
              {name(k.tenancy_id)} · {k.status}
            </p>
          </article>
        ))}
        {selected && (
          <section>
            <h3>
              Request #{selected.id}: {selected.subject}
            </h3>
            <p style={{ whiteSpace: "pre-wrap" }}>{selected.description}</p>
            <label>
              Status
              <select
                value={selected.status}
                disabled={busy}
                onChange={(e) => {
                  const status = e.target.value;
                  task(async () => {
                    await api(
                      `admin/maintenance-tickets/${selected.id}`,
                      "PATCH",
                      { status },
                    );
                    setSelected(
                      await api(`admin/maintenance-tickets/${selected.id}`),
                    );
                    await load();
                  });
                }}
              >
                {["new", "in-progress", "resolved"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            {selected.messages.map((m: any) => (
              <article key={m.id}>
                <strong>{m.author}</strong>
                <small> {new Date(m.created_at).toLocaleString()}</small>
                <p style={{ whiteSpace: "pre-wrap" }}>{m.message}</p>
              </article>
            ))}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget,
                  f = new FormData(form);
                task(async () => {
                  await api(
                    `admin/maintenance-tickets/${selected.id}/messages`,
                    "POST",
                    { message: f.get("message") },
                  );
                  form.reset();
                  setSelected(
                    await api(`admin/maintenance-tickets/${selected.id}`),
                  );
                  await load();
                });
              }}
            >
              <label>
                Reply to tenant
                <textarea name="message" maxLength={10000} required />
              </label>
              <button disabled={busy}>Send reply</button>
            </form>
          </section>
        )}
      </section>
    </>
  );
}
