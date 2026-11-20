import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ACCESS_COOKIE,
  ACCESS_MAX_AGE,
  ACCESS_PATH,
  accessToken,
  gateEnabled,
  passwordMatches,
  safeNext,
} from "../../lib/site-access";
import "./site-access.css";

export const metadata: Metadata = {
  title: "Private preview",
  robots: { index: false, follow: false },
};

async function unlock(formData: FormData) {
  "use server";
  const next = safeNext(String(formData.get("next") || "/"));
  // small fixed delay slows down password guessing
  await new Promise((r) => setTimeout(r, 600));
  if (!(await passwordMatches(String(formData.get("password") || "")))) {
    redirect(`${ACCESS_PATH}?error=1&next=${encodeURIComponent(next)}`);
  }
  (await cookies()).set(ACCESS_COOKIE, await accessToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ACCESS_MAX_AGE,
  });
  redirect(next);
}

export default async function SiteAccess({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  if (!gateEnabled()) redirect(safeNext(next));
  return (
    <div className="gate">
      <div className="gate-card">
        <img className="gate-logo" src="/images/logo.svg" alt="Haskins Industrial Complex" width={612} height={264} />
        <p className="gate-kicker">
          <i aria-hidden="true" />
          Private preview
        </p>
        <h1 className="gate-title">This site is password protected</h1>
        <p className="gate-text">Enter the password you were given to view the website.</p>
        <form action={unlock} className="gate-form">
          <input type="hidden" name="next" value={safeNext(next)} />
          <label htmlFor="gate-password">Password</label>
          <input
            id="gate-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            autoFocus
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "gate-error" : undefined}
          />
          {error && (
            <p id="gate-error" className="gate-error" role="alert">
              That password is not correct. Please try again.
            </p>
          )}
          <button type="submit">View the site</button>
        </form>
      </div>
    </div>
  );
}
