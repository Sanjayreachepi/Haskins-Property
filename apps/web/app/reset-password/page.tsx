import type { Metadata } from "next";
import PageShell from "../../components/page-shell";
import PageHero from "../../components/page-hero";
import PasswordReset from "../../components/password-reset";

export const metadata: Metadata = {
  title: "Reset password",
  robots: { index: false, follow: false },
  referrer: "no-referrer", // the reset token is in the address: never pass it on to other sites
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; invite?: string; account?: string }>;
}) {
  const q = await searchParams;
  const token = /^[a-f0-9]{64}$/.test(q.token || "") ? q.token! : "";
  const invite = !!token && q.invite === "1";
  const account = q.account === "1";
  return (
    <PageShell crumb={[{ name: account ? "My account" : "Tenant portal", path: account ? "/account" : "/tenant-portal" }, { name: "Password", path: "/reset-password" }]}>
      <PageHero
        kicker={account ? "Account access" : "Tenant resources"}
        title={invite ? "Welcome" : "Account"}
        accent={invite ? "aboard." : "access."}
        text={invite ? "Choose a password to finish setting up your account." : "Reset the password for your account."}
      />
      <section className="hk-light hk-blueprint-l">
        <div className="hk-wrap">
          <PasswordReset token={token} invite={invite} account={account} />
        </div>
      </section>
    </PageShell>
  );
}
