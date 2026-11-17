import type { Metadata } from "next";
import ResetForm from "../../components/reset-form";

export const metadata: Metadata = {
  title: "Haskins | Reset password",
  robots: { index: false, follow: false },
  referrer: "no-referrer", // the token is in the address
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; invite?: string }>;
}) {
  const q = await searchParams;
  const token = /^[a-f0-9]{64}$/.test(q.token || "") ? q.token! : "";
  return (
    <main className="login">
      <div className="login-brand">
        <img className="brand-logo" src="/images/logo-light.svg" alt="Haskins Industrial Complex" width="220" height="95" />
        <p className="eyebrow">SOUTH SAN FRANCISCO · STAFF WORKSPACE</p>
        <h1>
          Account
          <br />
          access.<span className="login-accent">safe and simple.</span>
        </h1>
        <p className="login-description">Reset links work once and expire. Signing in again is required afterwards.</p>
      </div>
      <ResetForm token={token} invite={!!token && q.invite === "1"} />
    </main>
  );
}
