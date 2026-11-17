"use client";
import { useEffect, useState } from "react";
import { api } from "../lib/api";

type Status = { enabled: boolean; required: boolean; recoveryCodesLeft: number };

/** "Two-step sign-in" panel in My account (also the forced set-up screen when MFA is required). */
export default function MfaPanel({ onEnabled }: { onEnabled?: () => void }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [setup, setSetup] = useState<{ qr: string; secret: string } | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [mode, setMode] = useState<"" | "disable" | "renew">("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = () => api("admin/mfa").then(setStatus).catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function download() {
    const blob = new Blob(
      ["Haskins admin — two-step sign-in recovery codes\nEach code works once. Keep them somewhere safe.\n\n" + codes.join("\n") + "\n"],
      { type: "text/plain" },
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "haskins-admin-recovery-codes.txt";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (!status) return <section className="panel"><h2>Two-step sign-in</h2><p>{error || "Loading…"}</p></section>;

  return (
    <section className="panel mfa-panel">
      <h2>Two-step sign-in</h2>
      {error && <p role="alert" className="error">{error}</p>}

      {codes.length > 0 && (
        <div className="mfa-codes">
          <p className="notice">
            <strong>Save these recovery codes now — they are shown only once.</strong> Each one lets you sign in
            once if you lose your phone.
          </p>
          <ol>
            {codes.map((c) => (
              <li key={c}><code>{c}</code></li>
            ))}
          </ol>
          <button type="button" onClick={download}>Download as a text file</button>{" "}
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setCodes([]);
              onEnabled?.();
            }}
          >
            I have saved them →
          </button>
        </div>
      )}

      {!status.enabled && !setup && codes.length === 0 && (
        <>
          <p>
            <span className="badge">Off</span> Add a second step to your sign-in: after your password, enter a 6-digit
            code from an authenticator app on your phone (Google Authenticator, Microsoft Authenticator, 1Password…).
          </p>
          {status.required && <p className="notice">Two-step sign-in is required for administrators on this site.</p>}
          <button
            disabled={busy}
            onClick={() => run(async () => setSetup(await api("admin/mfa/setup", "POST", {})))}
          >
            Set up two-step sign-in
          </button>
        </>
      )}

      {setup && codes.length === 0 && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const code = String(new FormData(e.currentTarget).get("code") || "");
            run(async () => {
              const r = await api("admin/mfa/enable", "POST", { code });
              setSetup(null);
              setCodes(r.recoveryCodes);
              await load();
            });
          }}
        >
          <ol className="mfa-steps">
            <li>Open your authenticator app and add an account by scanning this QR code.</li>
          </ol>
          <img src={setup.qr} alt="QR code for your authenticator app" width={220} height={220} className="mfa-qr" />
          <p>
            Can’t scan? Enter this key instead: <code className="mfa-secret">{setup.secret}</code>
          </p>
          <ol className="mfa-steps" start={2}>
            <li>Type the 6-digit code the app shows.</li>
          </ol>
          <label>
            6-digit code
            <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required />
          </label>
          <button disabled={busy}>Turn on two-step sign-in</button>{" "}
          <button type="button" className="text-button" onClick={() => setSetup(null)}>
            Cancel
          </button>
        </form>
      )}

      {status.enabled && codes.length === 0 && (
        <>
          <p>
            <span className="badge">On</span> You enter a code from your authenticator app each time you sign in.{" "}
            {status.recoveryCodesLeft} recovery code{status.recoveryCodesLeft === 1 ? "" : "s"} left.
          </p>
          {status.recoveryCodesLeft < 3 && (
            <p className="notice">You are running out of recovery codes — create new ones.</p>
          )}
          {!mode && (
            <p>
              <button className="text-button" onClick={() => setMode("renew")}>Create new recovery codes</button>
              {!status.required && (
                <>
                  {" · "}
                  <button className="text-button" onClick={() => setMode("disable")}>Turn off</button>
                </>
              )}
            </p>
          )}
          {mode && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const body = { password: f.get("password"), code: f.get("code") };
                run(async () => {
                  if (mode === "renew") {
                    const r = await api("admin/mfa/recovery-codes", "POST", body);
                    setCodes(r.recoveryCodes);
                  } else await api("admin/mfa/disable", "POST", body);
                  setMode("");
                  await load();
                });
              }}
            >
              <p>{mode === "renew" ? "Your old recovery codes will stop working." : "Your account will be protected by your password only."}</p>
              <label>
                Your password
                <input name="password" type="password" autoComplete="current-password" required />
              </label>
              <label>
                Code from your app (or a recovery code)
                <input name="code" autoComplete="one-time-code" required />
              </label>
              <button disabled={busy}>{mode === "renew" ? "Create new codes" : "Turn off two-step sign-in"}</button>{" "}
              <button type="button" className="text-button" onClick={() => setMode("")}>Cancel</button>
            </form>
          )}
        </>
      )}
    </section>
  );
}
