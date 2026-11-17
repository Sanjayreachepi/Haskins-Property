"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";

async function post(path: string, body: unknown) {
  const r = await fetch("/api/auth/" + path, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.message || "Something went wrong. Please try again.");
  return data;
}

/**
 * Without a token: "forgot password" form (emails a reset link).
 * With a token (from a reset or invitation email): choose a new password.
 */
export default function PasswordReset({ token, invite, account = false }: { token: string; invite: boolean; account?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [accountLink, setAccountLink] = useState(account);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      if (token) {
        const password = String(f.get("password") || "");
        if (password !== String(f.get("confirm") || ""))
          throw new Error("The two passwords do not match.");
        const result = await post("reset", { token, password });
        setAccountLink(result.role === "user");
        setDone(invite ? "Your password is set. You can sign in now." : "Your password has been changed. You can sign in now.");
      } else {
        const r = await post("forgot", { email: f.get("email") });
        setDone(r.message);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="form hk-portal-form">
      <form onSubmit={submit}>
        <span className="mono hk-portal-eyebrow">
          {token ? (invite ? "Welcome" : "New password") : "Forgot your password?"}
        </span>
        <h2>{token ? (invite ? "Set your password." : "Choose a new password.") : "Reset your password."}</h2>
        <p className="hk-portal-sub">
          {token
            ? "Use at least 12 characters. Signing in elsewhere will end, for your security."
            : "Enter the email address of your account and we will send you a link to choose a new password."}
        </p>
        {error && (
          <div role="alert" className="notice hk-form-bad">
            {error}
          </div>
        )}
        {done ? (
          <div role="status" className="notice hk-form-ok">
            {done}
          </div>
        ) : token ? (
          <>
            <label>
              New password
              <input name="password" type="password" autoComplete="new-password" minLength={12} required />
            </label>
            <label>
              Repeat the new password
              <input name="confirm" type="password" autoComplete="new-password" minLength={12} required />
            </label>
          </>
        ) : (
          <label>
            Email address
            <input name="email" type="email" autoComplete="username" required placeholder="tenant@example.com" />
          </label>
        )}
        {!done && (
          <button className="button dark full hk-btn hk-btn-ink hk-btn-full" type="submit" disabled={busy}>
            {busy ? "Please wait…" : token ? "Save password ↗" : "Send reset link ↗"}
          </button>
        )}
        <Link className="text-link" href={accountLink ? "/account" : "/tenant-portal"}>
          Back to sign in ↗
        </Link>
      </form>
    </div>
  );
}
