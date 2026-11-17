"use client";
import { useState } from "react";
import { api } from "../lib/api";

/** Admin "forgot password" (no token) and "set / choose a new password" (token from the email). */
export default function ResetForm({ token, invite }: { token: string; invite: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  return (
    <form
      className="login-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setBusy(true);
        setError("");
        try {
          if (token) {
            const password = String(f.get("password") || "");
            if (password !== String(f.get("confirm") || ""))
              throw Error("The two passwords do not match.");
            await api("auth/reset", "POST", { token, password });
            setDone("Your password is saved. You can sign in now.");
          } else {
            const r = await api("auth/forgot", "POST", { email: f.get("email") });
            setDone(r.message);
          }
        } catch (err: any) {
          setError(err.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="eyebrow">{token ? (invite ? "WELCOME" : "NEW PASSWORD") : "STAFF ACCESS"}</p>
      <h2>{token ? (invite ? "Set your password." : "Choose a new password.") : "Reset your password."}</h2>
      <p>
        {token
          ? "Use at least 12 characters. Any other signed-in sessions will end."
          : "Enter your administrator email and we will send a reset link (valid for 1 hour)."}
      </p>
      {done ? (
        <p role="status" className="success">{done}</p>
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
          <input name="email" type="email" autoComplete="username" required />
        </label>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {!done && <button disabled={busy}>{busy ? "Please wait…" : token ? "Save password →" : "Send reset link →"}</button>}
      <small>
        <a href="/">← Back to sign in</a>
      </small>
    </form>
  );
}
