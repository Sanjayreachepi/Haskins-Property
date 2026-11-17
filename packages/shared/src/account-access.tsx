"use client";
import { useEffect, useState } from "react";

type Request = (path: string, method?: string, body?: unknown) => Promise<any>;
/** Token stays in memory: remove the email-link fragment from browser history immediately. */
export default function AccountAccess({ request }: { request: Request }) {
  const [token, setToken] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const value = fragment.get("account-token");
    if (value) {
      setToken(value);
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
    }
  }, []);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (token && f.get("password") !== f.get("confirm"))
        throw Error("Passwords do not match.");
      const result = await request(
        token ? "auth/set-password" : "auth/request-reset",
        "POST",
        token
          ? { token, password: f.get("password") }
          : { email: f.get("email") },
      );
      setMessage(result.message);
      if (token) setToken("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details open={token ? true : undefined} className="account-access">
      <summary>
        {token ? "Activate account / set password" : "Forgot your password?"}
      </summary>
      <form onSubmit={submit}>
        <p>
          {token
            ? "Choose a unique password to complete your invitation or password reset. This link can be used once."
            : "Enter your account email to request a secure password reset link."}
        </p>
        {token ? (
          <>
            <label>
              New password
              <input
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={256}
                required
              />
            </label>
            <label>
              Confirm password
              <input
                name="confirm"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={256}
                required
              />
            </label>
          </>
        ) : (
          <label>
            Email address
            <input name="email" type="email" autoComplete="username" required />
          </label>
        )}
        {error && <p role="alert">{error}</p>}
        {message && <p role="status">{message}</p>}
        <button type="submit" disabled={busy}>
          {busy ? "Please wait…" : token ? "Save password" : "Email reset link"}
        </button>
      </form>
    </details>
  );
}
