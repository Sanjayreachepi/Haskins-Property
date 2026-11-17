"use client";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
type Account = {
  id: number;
  name: string;
  email: string;
  role: "admin" | "user" | "tenant";
  active: boolean | number;
  mfa_enabled?: boolean | number;
};
const blank = {
  id: 0,
  name: "",
  email: "",
  role: "user" as Account["role"],
  active: true,
  password: "",
  invite: true, // new accounts: email an invitation so the person chooses their own password
};
export default function AccountManager({
  currentUserId,
  records,
  onUnauthorized,
}: {
  currentUserId: number;
  records: any[];
  onUnauthorized: () => void;
}) {
  const [users, setUsers] = useState<Account[]>([]),
    [tenancies, setTenancies] = useState<any[]>([]),
    [edit, setEdit] = useState({ ...blank }),
    [assignment, setAssignment] = useState({
      user_id: "",
      property_id: "",
      payment_record_id: "",
      reference: "",
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [manualLink, setManualLink] = useState("");
  /** Shows what happened to an emailed link; when email is not set up, the link is shown to copy by hand. */
  function linkResult(r: { emailed?: boolean; link?: string }, what: string, email: string) {
    setManualLink(r.emailed ? "" : r.link || "");
    setMessage(
      r.emailed
        ? `${what} emailed to ${email}.`
        : `${what} created, but email is not set up (SMTP). Copy the link below and send it to ${email} yourself.`,
    );
  }
  function sendLink(u: Account, purpose: "invite" | "reset") {
    task(async () => {
      const r = await api(`admin/users/${u.id}/link`, "POST", { purpose });
      linkResult(r, purpose === "invite" ? "Invitation" : "Password reset link", u.email);
    });
  }
  async function load() {
    const [u, t] = await Promise.all([
      api("admin/users"),
      api("admin/tenancies"),
    ]);
    setUsers(u);
    setTenancies(t);
  }
  useEffect(() => {
    load().catch((e) => {
      setError(e.message);
      if (e.status === 401 || e.status === 403) onUnauthorized();
    });
  }, []);
  async function task(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
    } catch (e: any) {
      setError(e.message);
      if (e.status === 401 || e.status === 403) onUnauthorized();
    } finally {
      setBusy(false);
    }
  }
  const properties = records.filter(
    (r) => r.kind === "property" && r.published_payload,
  );
  const payments = records.filter(
    (r) =>
      r.kind === "payment" &&
      r.published_payload &&
      r.published_property_id === Number(assignment.property_id),
  );
  return (
    <>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="success" role="status">
          {message}
          {manualLink && (
            <input
              readOnly
              value={manualLink}
              aria-label="Link to send"
              onFocus={(e) => e.currentTarget.select()}
              style={{ display: "block", width: "100%", marginTop: 8 }}
            />
          )}
        </div>
      )}
      <section className="panel">
        <h2>Role permissions</h2>
        <p>
          <strong>Admin:</strong> CMS, accounts and tenancy assignments.{" "}
          <strong>User:</strong> own account/profile. <strong>Tenant:</strong>{" "}
          own account and explicitly assigned tenancies/payment instructions.
        </p>
      </section>
      <div className="editor">
        <section className="panel table-scroll">
          <h2>Accounts</h2>
          <table>
            <thead>
              <tr>
                <th>Name / email</th>
                <th>Role</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <strong>{u.name || "Administrator"}</strong>
                    <small>{u.email}</small>
                  </td>
                  <td>
                    <span className="badge">{u.role}</span>
                  </td>
                  <td>
                    {u.active ? "Active" : "Disabled"}
                    {u.role === "admin" && (
                      <small>{u.mfa_enabled ? "Two-step: on" : "Two-step: off"}</small>
                    )}
                  </td>
                  <td>
                    <button
                      className="text-button"
                      onClick={() =>
                        setEdit({ ...u, active: !!u.active, password: "", invite: false })
                      }
                    >
                      Edit →
                    </button>
                    {!!u.active && (
                      <>
                        <button
                          className="text-button"
                          disabled={busy}
                          title="Email a link to choose a new password (valid 1 hour)"
                          onClick={() => sendLink(u, "reset")}
                        >
                          Send reset link
                        </button>
                        <button
                          className="text-button"
                          disabled={busy}
                          title="Email a new invitation link (valid 72 hours)"
                          onClick={() => sendLink(u, "invite")}
                        >
                          Resend invite
                        </button>
                        {!!u.mfa_enabled && u.id !== currentUserId && (
                          <button
                            className="text-button"
                            disabled={busy}
                            title="For a colleague who lost their phone and recovery codes: turns two-step sign-in off and signs them out"
                            onClick={() => {
                              if (!confirm(`Turn off two-step sign-in for ${u.email}? They will be signed out and can set it up again.`)) return;
                              task(async () => {
                                await api(`admin/users/${u.id}/mfa-reset`, "POST", {});
                                await load();
                                setManualLink("");
                                setMessage(`Two-step sign-in was reset for ${u.email}.`);
                              });
                            }}
                          >
                            Reset two-step
                          </button>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <form
          className="panel"
          onSubmit={(e) => {
            e.preventDefault();
            task(async () => {
              const creatingInvite = !edit.id && edit.invite;
              const r = await api(
                edit.id ? "admin/users/" + edit.id : "admin/users",
                edit.id ? "PATCH" : "POST",
                creatingInvite ? { ...edit, password: "" } : edit,
              );
              await load();
              setEdit({ ...blank });
              if (creatingInvite) return linkResult(r, "Account created. Invitation", edit.email);
              setManualLink("");
              setMessage(
                "Account saved. Changed roles, passwords or disabled status revoke existing sessions.",
              );
            });
          }}
        >
          <h2>{edit.id ? "Edit account" : "Create account"}</h2>
          <label>
            Name
            <input
              required
              maxLength={120}
              value={edit.name}
              onChange={(e) => setEdit({ ...edit, name: e.target.value })}
            />
          </label>
          <label>
            Email
            <input
              type="email"
              required
              disabled={!!edit.id}
              value={edit.email}
              onChange={(e) => setEdit({ ...edit, email: e.target.value })}
            />
          </label>
          <label>
            Role
            <select
              disabled={edit.id === currentUserId}
              value={edit.role}
              onChange={(e) =>
                setEdit({ ...edit, role: e.target.value as Account["role"] })
              }
            >
              {["user", "tenant", "admin"].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          {!edit.id && (
            <label className="checkbox">
              <input
                type="checkbox"
                checked={edit.invite}
                onChange={(e) => setEdit({ ...edit, invite: e.target.checked })}
              />{" "}
              Email an invitation — the person chooses their own password (link valid 72 hours)
            </label>
          )}
          {(edit.id || !edit.invite) && (
          <label>
            {edit.id
              ? "New password (leave blank to keep current)"
              : "Password"}
            <input
              type="password"
              minLength={12}
              maxLength={256}
              required={!edit.id}
              autoComplete="new-password"
              value={edit.password}
              onChange={(e) => setEdit({ ...edit, password: e.target.value })}
            />
          </label>
          )}
          {!!edit.id && (
            <label className="checkbox">
              <input
                type="checkbox"
                disabled={edit.id === currentUserId}
                checked={!!edit.active}
                onChange={(e) => setEdit({ ...edit, active: e.target.checked })}
              />{" "}
              Active account
            </label>
          )}
          <button disabled={busy}>Save account</button>
          {!!edit.id && (
            <button
              type="button"
              className="text-button"
              style={{ marginLeft: 15 }}
              onClick={() => setEdit({ ...blank })}
            >
              Cancel
            </button>
          )}
        </form>
      </div>
      <section className="panel">
        <h2>Assign a tenancy</h2>
        <p>
          Assign each tenant to a published property. Payment instructions are
          visible only when explicitly assigned to that tenancy.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            task(async () => {
              await api("admin/tenancies", "POST", assignment);
              await load();
              setAssignment({
                user_id: "",
                property_id: "",
                payment_record_id: "",
                reference: "",
              });
              setMessage("Tenancy assigned");
            });
          }}
        >
          <div className="account-fields">
            <label>
              Tenant
              <select
                required
                value={assignment.user_id}
                onChange={(e) =>
                  setAssignment({ ...assignment, user_id: e.target.value })
                }
              >
                <option value="">Select tenant</option>
                {users
                  .filter((u) => u.role === "tenant" && u.active)
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} — {u.email}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Property
              <select
                required
                value={assignment.property_id}
                onChange={(e) =>
                  setAssignment({
                    ...assignment,
                    property_id: e.target.value,
                    payment_record_id: "",
                  })
                }
              >
                <option value="">Select property</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.published_title || p.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Unit / tenancy reference
              <input
                required
                maxLength={120}
                value={assignment.reference}
                onChange={(e) =>
                  setAssignment({ ...assignment, reference: e.target.value })
                }
              />
            </label>
            <label>
              Payment instructions
              <select
                value={assignment.payment_record_id}
                onChange={(e) =>
                  setAssignment({
                    ...assignment,
                    payment_record_id: e.target.value,
                  })
                }
              >
                <option value="">No payment instructions assigned</option>
                {payments.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.published_title || p.title}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button disabled={busy}>Assign tenancy</button>
        </form>
      </section>
      <section className="panel table-scroll">
        <h2>Tenant assignments</h2>
        <table>
          <thead>
            <tr>
              <th>Tenant</th>
              <th>Property / owner</th>
              <th>Reference</th>
              <th>Payment</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {tenancies.map((t) => (
              <tr key={t.id}>
                <td>
                  {t.name}
                  <small>{t.email}</small>
                </td>
                <td>
                  {t.property_name}
                  <small>{t.owner}</small>
                </td>
                <td>{t.reference}</td>
                <td>{t.payment_name || "Not assigned"}</td>
                <td>{t.active ? "Active" : "Inactive"}</td>
                <td>
                  <button
                    disabled={busy}
                    className="text-button"
                    onClick={() =>
                      task(async () => {
                        await api("admin/tenancies/" + t.id, "PATCH", {
                          active: !t.active,
                        });
                        await load();
                        setMessage("Tenancy status updated");
                      })
                    }
                  >
                    {t.active ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!tenancies.length && (
          <p className="empty">No tenancies assigned yet.</p>
        )}
      </section>
    </>
  );
}
