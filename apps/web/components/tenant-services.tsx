"use client";
import { useEffect, useState } from "react";
type Tenancy = { id: number; reference: string; property_name: string };
async function api(path: string, method = "GET", body?: unknown) {
  const r = await fetch("/api/tenant/" + path, {
    method,
    credentials: "same-origin",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok)
    throw Error(
      data.message || "Unable to load tenant services. Please sign in again.",
    );
  return data;
}
export default function TenantServices({
  tenancies,
}: {
  tenancies: Tenancy[];
}) {
  const [documents, setDocuments] = useState<any[]>([]),
    [notices, setNotices] = useState<any[]>([]),
    [tickets, setTickets] = useState<any[]>([]),
    [selected, setSelected] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  async function load() {
    const [d, n, k] = await Promise.all([
      api("documents"),
      api("notices"),
      api("maintenance-tickets"),
    ]);
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
  const label = (id: number) => {
    const t = tenancies.find((t) => t.id === id);
    return t ? `${t.property_name} — ${t.reference}` : "Your tenancy";
  };
  return (
    <div className="tenant-services">
      {error && (
        <p className="notice hk-form-bad" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="notice hk-form-ok" role="status">
          {message}
        </p>
      )}
      <section className="hk-tn">
        <h3>Notices</h3>
        {!notices.length && (
          <p>No notices have been shared with your tenancy.</p>
        )}
        {notices.map((n) => (
          <article key={n.id}>
            <h4>{n.title}</h4>
            <small>
              {label(n.tenancy_id)} ·{" "}
              {new Date(n.created_at).toLocaleDateString()}
            </small>
            <p style={{ whiteSpace: "pre-wrap" }}>{n.content}</p>
          </article>
        ))}
      </section>
      <section className="hk-tn">
        <h3>Private documents</h3>
        {!documents.length && (
          <p>No private documents have been shared with your tenancy.</p>
        )}
        <ul>
          {documents.map((d) => (
            <li key={d.id}>
              <a href={`/api/tenant/documents/${d.id}/download`}>
                {d.title} — Download PDF
              </a>
              <small> · {label(d.tenancy_id)}</small>
            </li>
          ))}
        </ul>
      </section>
      <section className="hk-tn" id="maintenance-requests">
        <h3>Maintenance &amp; service requests</h3>
        <p>
          For emergencies, contact management or the appropriate emergency
          service directly. This portal is not monitored continuously.
        </p>
        {!!tenancies.length && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget,
                f = new FormData(form);
              task(async () => {
                const result = await api(
                  "maintenance-tickets",
                  "POST",
                  Object.fromEntries(f),
                );
                form.reset();
                await load();
                setMessage(`Request #${result.id} submitted.`);
              });
            }}
          >
            <label>
              Property / unit
              <select name="tenancy_id" required>
                {tenancies.map((t) => (
                  <option key={t.id} value={t.id}>
                    {label(t.id)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Subject
              <input name="subject" maxLength={200} required />
            </label>
            <label>
              Describe the issue
              <textarea name="description" maxLength={10000} required />
            </label>
            <p className="hk-portal-sub"><a href="/privacy">Privacy &amp; cookies</a></p>
            <button className="button dark hk-btn hk-btn-ink" disabled={busy}>
              Submit request
            </button>
          </form>
        )}
        <h4>Your requests</h4>
        {!tickets.length && <p>No requests yet.</p>}
        {tickets.map((k) => (
          <article key={k.id}>
            <button
              className="text-link"
              disabled={busy}
              onClick={() =>
                task(async () =>
                  setSelected(await api(`maintenance-tickets/${k.id}`)),
                )
              }
            >
              #{k.id} — {k.subject}
            </button>
            <p>
              {label(k.tenancy_id)} · {k.status}
            </p>
          </article>
        ))}
        {selected && (
          <section>
            <h4>
              Request #{selected.id}: {selected.subject}
            </h4>
            <p>Status: {selected.status}</p>
            <p style={{ whiteSpace: "pre-wrap" }}>{selected.description}</p>
            {selected.messages.map((m: any) => (
              <article key={m.id}>
                <strong>{m.author}</strong>
                <small> · {new Date(m.created_at).toLocaleString()}</small>
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
                    `maintenance-tickets/${selected.id}/messages`,
                    "POST",
                    { message: f.get("message") },
                  );
                  form.reset();
                  setSelected(await api(`maintenance-tickets/${selected.id}`));
                  await load();
                });
              }}
            >
              <label>
                Add a message
                <textarea name="message" maxLength={10000} required />
              </label>
              <button className="button dark hk-btn hk-btn-ink" disabled={busy}>
                Send message
              </button>
            </form>
          </section>
        )}
      </section>
    </div>
  );
}
