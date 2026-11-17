import type { Metadata } from "next";
import PageShell from "../../components/page-shell";
import PageHero from "../../components/page-hero";
import AccountPortal from "../../components/account-portal";

export const metadata: Metadata = {
  title: "My account",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <PageShell crumb={[{ name: "My account", path: "/account" }]}>
      <PageHero
        kicker="Account access"
        title="Your account."
        accent="Your details."
        text="Sign in to manage your name and password."
      />
      <section className="hk-light hk-blueprint-l">
        <div className="hk-wrap">
          <AccountPortal />
        </div>
      </section>
    </PageShell>
  );
}
