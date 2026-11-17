"use client";
import Link from "next/link";
import TenantServices from "./tenant-services";
import { useCallback, useEffect, useState } from "react";

type Tenancy = {
  id: number;
  reference: string;
  property_name: string;
  property_slug: string;
  owner: string;
  property: { location?: string; type?: string } | null;
  payment: { payee?: string; method?: string; instructions?: string } | null;
};
type User = { id: number; name: string; email: string; role: string };

/** Calls the API through the website's own /api proxy (same origin, so the session cookie is sent). */
async function api<T = any>(path: string, method = "GET", body?: unknown): Promise<T> {
  const r = await fetch("/api/" + path, {
    method,
    credentials: "same-origin",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok)
    throw Object.assign(new Error(data.message || "Something went wrong."), {
      status: r.status,
    });
  return data as T;
}

const MANAGEMENT = "Buzz Haskins Equipment Co., Inc.";

/**
 * Real tenant sign-in: shows only the signed-in tenant's own property, owning legal entity and
 * payment instructions (the API enforces this). Staff / non-tenant accounts are refused here.
 */
export default function TenantPortal() {
  const [state, setState] = useState<"loading" | "out" | "in">("loading");
  const [user, setUser] = useState<User | null>(null);
  const [tenancies, setTenancies] = useState<Tenancy[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pw, setPw] = useState(false);
  const [done, setDone] = useState("");

  const load = useCallback(async (u: User) => {
    setTenancies(await api<Tenancy[]>("tenant/tenancies"));
    setUser(u);
    setState("in");
  }, []);

  useEffect(() => {
    api<User>("auth/me")
      .then((u) => (u.role === "tenant" ? load(u) : setState("out")))
      .catch(() => setState("out"));
  }, [load]);

  async function signIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      const u = await api<User>("auth/login", "POST", {
        email: f.get("email"),
        password: f.get("password"),
      });
      if (u.role !== "tenant") {
        await api("auth/logout", "POST", {}).catch(() => {});
        throw new Error(
          "This sign-in is for tenant accounts. Staff sign in through the admin panel.",
        );
      }
      await load(u);
    } catch (err: any) {
      setError(
        err instanceof TypeError
          ? "We couldn’t reach the server. Please try again in a moment."
          : err.message,
      );
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await api("auth/logout", "POST", {}).catch(() => {});
    setUser(null);
    setTenancies([]);
    setPw(false);
    setDone("");
    setState("out");
  }

  async function changePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setBusy(true);
    setError("");
    setDone("");
    try {
      await api("account/password", "POST", {
        currentPassword: f.get("current"),
        newPassword: f.get("next"),
      });
      form.reset();
      setDone("Password changed.");
      setPw(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="hk-portal">
      <div className="hk-portal-media">
        <img
          src="/images/114-s-maple-ave-warehouse.webp"
          alt="114 South Maple Avenue warehouse"
        />
        <div className="hk-portal-cap">
          <span className="mono">Tenant resources</span>
          <h2 className="disp">
            A little less admin.
            <br />
            <span className="hk-amber">More room for business.</span>
          </h2>
        </div>
      </div>

      <div className="form hk-portal-form">
        {state === "loading" && (
          <p className="hk-portal-sub" role="status">
            Checking your session…
          </p>
        )}

        {state === "out" && (
          <form onSubmit={signIn}>
            <span className="mono hk-portal-eyebrow">Welcome back</span>
            <h2>Your tenant portal.</h2>
            <p className="hk-portal-sub">
              Sign in to see your property, its legal owner and your payment
              instructions.
            </p>
            {error && (
              <div role="alert" className="notice hk-form-bad">
                {error}
              </div>
            )}
            <label>
              Email address
              <input
                name="email"
                type="email"
                autoComplete="username"
                required
                placeholder="tenant@example.com"
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="••••••••"
              />
            </label>
            <button
              className="button dark full hk-btn hk-btn-ink hk-btn-full"
              type="submit"
              disabled={busy}
            >
              {busy ? "Signing in…" : "Sign in ↗"}
            </button>
            <Link className="text-link" href="/reset-password">
              Forgot your password? ↗
            </Link>
            <Link className="text-link" href="/contact?type=Tenant%20support#inquiry">
              Need account access? Contact management ↗
            </Link>
          </form>
        )}

        {state === "in" && user && (
          <>
            <span className="mono hk-portal-eyebrow">Signed in</span>
            <h2>Welcome, {user.name.split(" ")[0]}.</h2>
            <p className="hk-portal-sub">
              You see only the information for your own tenancy.
            </p>
            {done && (
              <div role="status" className="notice hk-form-ok">
                {done}
              </div>
            )}

            {tenancies.length === 0 && (
              <div className="notice">
                No tenancy is assigned to your account yet. Please{" "}
                <Link href="/contact?type=Tenant%20support#inquiry">
                  contact management
                </Link>
                .
              </div>
            )}

            {tenancies.map((t) => (
              <section key={t.id} className="hk-tn">
                <div className="demo-property">
                  <span className="mono hk-amber">{t.reference}</span>
                  <h3 className="disp">{t.property_name}</h3>
                  <p>
                    <b>Property Owner:</b> {t.owner}
                  </p>
                  <p>
                    <b>Property Management:</b> {MANAGEMENT}
                  </p>
                  {t.property?.location && <p>{t.property.location}</p>}
                </div>
                {t.payment ? (
                  <div className="hk-tn-pay">
                    <span className="mono">Payment instructions</span>
                    <dl>
                      {t.payment.payee && (
                        <div>
                          <dt className="mono">Pay to</dt>
                          <dd>{t.payment.payee}</dd>
                        </div>
                      )}
                      {t.payment.method && (
                        <div>
                          <dt className="mono">Method</dt>
                          <dd>{t.payment.method}</dd>
                        </div>
                      )}
                    </dl>
                    {t.payment.instructions && (
                      <p className="hk-tn-ins">{t.payment.instructions}</p>
                    )}
                    <p className="hk-tn-warn">
                      Always confirm the payee name above matches the legal owner
                      of your property before you pay.
                    </p>
                  </div>
                ) : (
                  <div className="notice">
                    Payment instructions have not been assigned to your tenancy
                    yet. Please contact management.
                  </div>
                )}
                <div className="resource-list">
                  <Link
                    href="#maintenance-requests"
                  >
                    Maintenance &amp; service request <span>↗</span>
                  </Link>
                  <Link href={`/properties/${t.property_slug}`}>
                    Property page <span>↗</span>
                  </Link>
                </div>
              </section>
            ))}

            <TenantServices tenancies={tenancies} />
            {pw ? (
              <form onSubmit={changePassword} className="hk-tn-pw">
                {error && (
                  <div role="alert" className="notice hk-form-bad">
                    {error}
                  </div>
                )}
                <label>
                  Current password
                  <input name="current" type="password" autoComplete="current-password" required />
                </label>
                <label>
                  New password (at least 12 characters)
                  <input name="next" type="password" autoComplete="new-password" minLength={12} required />
                </label>
                <button className="button dark hk-btn hk-btn-ink" type="submit" disabled={busy}>
                  {busy ? "Saving…" : "Change password"}
                </button>
              </form>
            ) : (
              <div className="hk-tn-actions">
                <button className="text-link" type="button" onClick={() => { setPw(true); setError(""); setDone(""); }}>
                  Change password
                </button>
                <button className="text-link" type="button" onClick={signOut}>
                  Sign out
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
