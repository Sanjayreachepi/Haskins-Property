import { getPage, pageMeta } from "../../lib/seo";
import { PaymentDemo } from "../../components/forms";
import { getProperties } from "../../lib/content";
import PageShell from "../../components/page-shell";
import PageHero from "../../components/page-hero";

export const generateMetadata = () =>
  pageMeta("pay-rent", {
    noindex: true, // login / tenant-only page: kept out of search results
    title: "Payment information",
    description: "Identify your property and see the correct payee before requesting payment guidance.",
  });

export default async function Page() {
  const page = await getPage("pay-rent");
  const properties = await getProperties();
  return (
    <PageShell crumb={[{ name: "Payment information", path: "/pay-rent" }]}>
      <PageHero
        kicker="Tenant payment resources"
        title="Every property."
        accent="The right payee."
        text={page?.content || "Identify your property before requesting payment guidance. All remittance details must be verified for your individual tenancy."}
      />
      <section className="hk-light hk-blueprint-l">
        <div className="hk-wrap">
          <PaymentDemo properties={properties} />
        </div>
      </section>
    </PageShell>
  );
}
