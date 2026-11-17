"use client";
import { useState } from "react";
import Link from "next/link";
import type { SiteProperty } from "../lib/content";
import { inquiryTypes } from "./inquiry-types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:4000";

export function ContactForm({
  defaultType,
  defaultProperty,
  properties,
}: {
  defaultType?: string;
  defaultProperty?: string;
  properties: SiteProperty[];
}) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [problem, setProblem] = useState("");
  const [slug, setSlug] = useState(
    properties.some((p) => p.slug === defaultProperty) ? (defaultProperty as string) : "",
  );
  const property = properties.find((p) => p.slug === slug);
  const type = inquiryTypes.includes(defaultType ?? "")
    ? (defaultType as string)
    : inquiryTypes[0];
  return (
    <form
      id="inquiry"
      className="form"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const data = new FormData(form);
        setState("sending");
        setProblem("");
        try {
          const r = await fetch(API_URL + "/api/public/inquiries", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: data.get("name"),
              email: data.get("email"),
              category: data.get("type"),
              property: slug || undefined,
              message: data.get("message"),
              website: data.get("website"), // honeypot: real people leave it empty
            }),
          });
          if (!r.ok) {
            const body = await r.json().catch(() => ({}));
            throw new Error(body.message || "Something went wrong. Please try again.");
          }
          form.reset();
          setSlug("");
          setState("sent");
        } catch (err: any) {
          setProblem(
            err instanceof TypeError
              ? "We couldn’t reach the server. Please try again in a moment."
              : err.message,
          );
          setState("error");
        }
      }}
    >
      <span className="mono hk-form-eyebrow">Inquiry form</span>
      <h2>Let’s start a conversation.</h2>
      <div className="form-row">
        <label>
          Full name
          <input
            name="name"
            autoComplete="name"
            required
            placeholder="Your name"
          />
        </label>
        <label>
          Email address
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
          />
        </label>
      </div>
      <div className="form-row">
        <label>
          Inquiry type
          <select name="type" key={type} defaultValue={type}>
            {inquiryTypes.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label>
          Property
          <select
            name="property"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
          >
            <option value="">Select a property (optional)</option>
            {properties.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {property && (
        <div className="hk-owner-note" role="status">
          <span className="mono">Property Owner</span>
          <strong>{property.owner}</strong>
          <span className="mono">Property Management</span>
          <strong>Buzz Haskins Equipment Co., Inc.</strong>
          {property.landOnly && <em>{property.landNote}</em>}
        </div>
      )}
      <input
        className="hk-hp"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
      />
      <label>
        Message
        <textarea
          name="message"
          required
          minLength={10}
          rows={5}
          placeholder="How can we help?"
        />
      </label>
      <p className="muted">
        Please do not include sensitive payment information. Read our{" "}
        <Link href="/privacy">privacy information</Link>.
      </p>
      <button
        className="button dark hk-btn hk-btn-ink"
        type="submit"
        disabled={state === "sending"}
      >
        {state === "sending" ? "Sending…" : "Send inquiry ↗"}
      </button>
      {state === "sent" && (
        <div role="status" className="notice hk-form-ok">
          <strong>Thank you — your inquiry has been received.</strong> Our
          management team will follow up by email.
        </div>
      )}
      {state === "error" && (
        <div role="alert" className="notice hk-form-bad">
          {problem}
        </div>
      )}
    </form>
  );
}
export function PaymentDemo({ properties }: { properties: SiteProperty[] }) {
  const [slug, setSlug] = useState("");
  const property = properties.find((p) => p.slug === slug);
  return (
    <div className="hk-pay">
      <div className="hk-pay-main">
        <ol className="hk-steps">
          <li className={"hk-step" + (slug ? " done" : " on")}>
            <span className="disp">01</span>
            <span className="mono">Choose your property</span>
          </li>
          <li className={"hk-step" + (slug ? " on" : "")}>
            <span className="disp">02</span>
            <span className="mono">See the payee</span>
          </li>
          <li className="hk-step">
            <span className="disp">03</span>
            <span className="mono">Confirm your instructions</span>
          </li>
        </ol>
        <div className="form hk-pay-form">
          <h2>Start with your property.</h2>
          <p className="hk-portal-sub">
            Payment instructions are specific to your tenancy and the legal
            entity that owns your property.
          </p>
          <label>
            Your property
            <select value={slug} onChange={(e) => setSlug(e.target.value)}>
              <option value="">Choose your property</option>
              {properties.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <div className="notice">
            Payment details are never shown publicly and no payments are made on
            this site. Tenants can{" "}
            <Link href="/tenant-portal">sign in to the tenant portal</Link> to see
            the payment instructions for their own tenancy.
          </div>
        </div>
      </div>
      <aside className="hk-pay-result" aria-live="polite">
        <span className="mono hk-amber">
          {property ? "Property identified" : "Payment guidance"}
        </span>
        <h3 className="disp">
          {property?.name || "The correct property. The correct payee."}
        </h3>
        {property ? (
          <>
            <dl className="hk-pay-dl">
              <div>
                <dt className="mono">Property owner</dt>
                <dd>{property.owner}</dd>
              </div>
              <div>
                <dt className="mono">Property management</dt>
                <dd>Buzz Haskins Equipment Co., Inc.</dd>
              </div>
            </dl>
            <p>
              {slug === "114-s-maple"
                ? "Zelle may be offered to eligible parking tenants after their tenancy and payee details are verified."
                : "Your payment method and remittance instructions must be confirmed through your authenticated tenancy."}
            </p>
          </>
        ) : (
          <p>
            Select a property to identify its owner. Owner information alone is
            not a verified payment instruction.
          </p>
        )}
        <Link className="hk-btn hk-btn-amber" href="/contact">
          Request payment guidance ↗
        </Link>
      </aside>
    </div>
  );
}
