"use client";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

type Account = { id: number; name: string; email: string; role: string };
async function api(path: string, method = "GET", body?: unknown) {
  const response = await fetch("/api/" + path, {
    method,
    credentials: "same-origin",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw Object.assign(new Error(data.message || "Please try again."), {
      status: response.status,
    });
  return data;
}

export default function AccountPortal() {
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    api("account/me")
      .then(setAccount)
      .catch((err) => {
        if (err.status !== 401) setError(err.message);
      })
      .finally(() => setLoading(false));
  }, []);

  async function submit(
    event: FormEvent<HTMLFormElement>,
    action: "login" | "profile" | "password",
  ) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (action === "login") {
        const user = await api("auth/login", "POST", {
          email: fields.get("email"),
          password: fields.get("password"),
        });
        setAccount(user);
      } else if (action === "profile") {
        setAccount(
          await api("account/profile", "PATCH", { name: fields.get("name") }),
        );
        setMessage("Name updated.");
      } else {
        if (fields.get("next") !== fields.get("confirm"))
          throw new Error("The two passwords do not match.");
        await api("account/password", "POST", {
          currentPassword: fields.get("current"),
          newPassword: fields.get("next"),
        });
        form.reset();
        setMessage("Password updated. Other sessions have been signed out.");
      }
    } catch (err: any) {
      if (err.status === 401 && action !== "login") setAccount(null);
      setError(
        err instanceof TypeError
          ? "We couldn’t reach the server. Please try again."
          : err.message,
      );
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    setError("");
    try {
      await api("auth/logout", "POST", {});
      setAccount(null);
      setMessage("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="form hk-portal-form">
      {loading ? (
        <p role="status">Checking your session…</p>
      ) : (
        <>
          {error && (
            <div role="alert" className="notice hk-form-bad">
              {error}
            </div>
          )}
          {message && (
            <div role="status" className="notice hk-form-ok">
              {message}
            </div>
          )}
          {!account ? (
            <form onSubmit={(event) => submit(event, "login")}>
              <span className="mono hk-portal-eyebrow">Welcome back</span>
              <h2>Sign in.</h2>
              <label>
                Email address
                <input
                  name="email"
                  type="email"
                  autoComplete="username"
                  required
                />
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
              <button
                className="button dark full hk-btn hk-btn-ink hk-btn-full"
                disabled={busy}
              >
                {busy ? "Signing in…" : "Sign in ↗"}
              </button>
              <Link className="text-link" href="/reset-password?account=1">
                Forgot your password? ↗
              </Link>
              <Link className="text-link" href="/tenant-portal">
                Tenant portal ↗
              </Link>
            </form>
          ) : (
            <>
              <span className="mono hk-portal-eyebrow">My account</span>
              <h2>Welcome, {account.name || account.email}.</h2>
              <p className="hk-portal-sub">{account.email}</p>
              {account.role === "tenant" && (
                <Link className="text-link" href="/tenant-portal">
                  View your tenancy ↗
                </Link>
              )}
              <form onSubmit={(event) => submit(event, "profile")}>
                <label>
                  Name
                  <input
                    key={account.name}
                    name="name"
                    defaultValue={account.name}
                    autoComplete="name"
                    maxLength={120}
                    required
                  />
                </label>
                <button
                  className="button dark hk-btn hk-btn-ink"
                  disabled={busy}
                >
                  Save name
                </button>
              </form>
              <form
                className="hk-tn-pw"
                onSubmit={(event) => submit(event, "password")}
              >
                <h3>Change password</h3>
                <label>
                  Current password
                  <input
                    name="current"
                    type="password"
                    autoComplete="current-password"
                    required
                  />
                </label>
                <label>
                  New password (at least 12 characters)
                  <input
                    name="next"
                    type="password"
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={256}
                    required
                  />
                </label>
                <label>
                  Repeat new password
                  <input
                    name="confirm"
                    type="password"
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={256}
                    required
                  />
                </label>
                <button
                  className="button dark hk-btn hk-btn-ink"
                  disabled={busy}
                >
                  Change password
                </button>
              </form>
              <button
                type="button"
                className="text-link"
                disabled={busy}
                onClick={signOut}
              >
                Sign out
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}
