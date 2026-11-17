import nodemailer, { type Transporter } from "nodemailer";
import { rows } from "./db";

/**
 * Email notification for new website inquiries.
 *
 * Configure with environment variables (apps/api/.env):
 *   SMTP_HOST, SMTP_PORT (default 587), SMTP_USER, SMTP_PASS, SMTP_SECURE=true for port 465
 *   MAIL_FROM           sender address, e.g. "Haskins Website <no-reply@yourdomain.com>"
 *   INQUIRY_NOTIFY_TO   recipients (comma separated). If empty, the management email
 *                       from the admin's published "Site settings" is used.
 * With no SMTP_HOST nothing is sent (a line is logged); the inquiry itself is always saved.
 */

export type NewInquiry = {
  name: string;
  email: string;
  category: string;
  message: string;
  propertyId: number | null;
};

const mailConfigured = () => !!process.env.SMTP_HOST;

let transport: Transporter | null = null;
function getTransport() {
  transport ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  return transport;
}

const oneLine = (s: string) => s.replace(/[\r\n]+/g, " ").trim();
const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export const isMailConfigured = mailConfigured;

/**
 * Sends a password-reset or invitation email with one button link.
 * Returns true when the message was handed to the SMTP server; false when SMTP is not configured
 * or sending failed (the error is logged, never thrown).
 */
export async function sendLinkEmail(opts: {
  to: string;
  name: string;
  subject: string;
  intro: string;
  button: string;
  link: string;
  footer: string;
}): Promise<boolean> {
  if (!mailConfigured()) return false;
  try {
    const greeting = `Hello ${oneLine(opts.name) || "there"},`;
    const text = [greeting, "", opts.intro, "", opts.link, "", opts.footer].join("\n");
    const html =
      `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.55;color:#121211;max-width:560px">` +
      `<p>${esc(greeting)}</p><p>${esc(opts.intro)}</p>` +
      `<p><a href="${esc(opts.link)}" style="display:inline-block;background:#f2a900;color:#121211;font-weight:bold;text-decoration:none;padding:12px 22px">${esc(opts.button)}</a></p>` +
      `<p style="color:#555;font-size:13px">If the button does not work, copy this address into your browser:<br>${esc(opts.link)}</p>` +
      `<p style="color:#555;font-size:13px">${esc(opts.footer)}</p></div>`;
    await getTransport().sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER || "no-reply@localhost",
      to: opts.to,
      subject: oneLine(opts.subject).slice(0, 200),
      text,
      html,
    });
    console.log(`[mail] "${oneLine(opts.subject)}" sent`);
    return true;
  } catch (e: any) {
    console.error("[mail] could not send email:", e?.message || e);
    return false;
  }
}

async function recipients(): Promise<string[]> {
  const fromEnv = (process.env.INQUIRY_NOTIFY_TO || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (fromEnv.length) return fromEnv;
  const [r] = await rows(
    "SELECT published_payload AS p FROM cms_records WHERE kind='settings' AND published_payload IS NOT NULL ORDER BY id LIMIT 1",
  );
  if (!r) return [];
  const p = typeof r.p === "string" ? JSON.parse(r.p) : r.p;
  const email = String(p?.contactEmail || "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? [email] : [];
}

/** Sends the notification. Never throws to the caller's request: errors are logged. */
export async function notifyInquiry(i: NewInquiry): Promise<void> {
  try {
    if (!mailConfigured()) {
      console.log("[mail] SMTP not configured — inquiry saved, no email sent");
      return;
    }
    const to = await recipients();
    if (!to.length) {
      console.log(
        "[mail] no recipient (set INQUIRY_NOTIFY_TO or publish Site settings with a management email) — no email sent",
      );
      return;
    }
    let property = "";
    if (i.propertyId) {
      const [p] = await rows(
        "SELECT r.title AS name, e.title AS owner FROM cms_records r LEFT JOIN cms_records e ON e.id=r.entity_id WHERE r.id=?",
        [i.propertyId],
      );
      if (p)
        property = `${p.name}${p.owner ? " (owner: " + p.owner + ")" : ""}`;
    }
    const adminUrl =
      (process.env.ADMIN_ORIGIN || "http://localhost:3001") + "/";
    const lines = [
      `A new inquiry was sent through the Haskins website.`,
      ``,
      `Type:     ${i.category}`,
      `From:     ${oneLine(i.name)} <${i.email}>`,
      property ? `Property: ${property}` : `Property: (none selected)`,
      ``,
      `Message:`,
      i.message,
      ``,
      `Reply to this email to answer ${oneLine(i.name)} directly.`,
      `All inquiries are also in the admin Inquiry inbox: ${adminUrl}`,
    ];
    const text = lines.join("\n");
    const html =
      `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.55;color:#121211">` +
      `<p><strong>A new inquiry was sent through the Haskins website.</strong></p>` +
      `<table cellpadding="6" style="border-collapse:collapse">` +
      `<tr><td><b>Type</b></td><td>${esc(i.category)}</td></tr>` +
      `<tr><td><b>From</b></td><td>${esc(oneLine(i.name))} &lt;${esc(i.email)}&gt;</td></tr>` +
      `<tr><td><b>Property</b></td><td>${esc(property || "(none selected)")}</td></tr>` +
      `</table>` +
      `<p style="white-space:pre-wrap;border-left:4px solid #f2a900;padding:8px 14px;background:#f6f4ee">${esc(i.message)}</p>` +
      `<p style="color:#555">Reply to this email to answer the sender directly. All inquiries are also in the <a href="${esc(adminUrl)}">admin Inquiry inbox</a>.</p>` +
      `</div>`;
    await getTransport().sendMail({
      from:
        process.env.MAIL_FROM || process.env.SMTP_USER || "no-reply@localhost",
      to,
      replyTo: { name: oneLine(i.name).slice(0, 120), address: i.email },
      subject: oneLine(`New website inquiry: ${i.category} — ${i.name}`).slice(
        0,
        200,
      ),
      text,
      html,
    });
    console.log(`[mail] inquiry notification sent to ${to.join(", ")}`);
  } catch (e: any) {
    console.error(
      "[mail] could not send inquiry notification:",
      e?.message || e,
    );
  }
}

/** Account security links are never logged or returned by the API. Delivery must succeed. */
export async function sendAccountEmail(
  to: string,
  purpose: "invite" | "reset",
  url: string,
  hours: number,
) {
  if (!mailConfigured())
    throw Object.assign(
      new Error(
        "Account email is not configured. Set SMTP_HOST and MAIL_FROM before sending invitations.",
      ),
      { status: 503 },
    );
  await getTransport().sendMail({
    from:
      process.env.MAIL_FROM || process.env.SMTP_USER || "no-reply@localhost",
    to,
    subject:
      purpose === "invite"
        ? "Activate your Haskins account"
        : "Reset your Haskins password",
    text: `${purpose === "invite" ? "Management has invited you to activate your Haskins account." : "A password reset was requested for your Haskins account."}\n\nOpen this link to set your password:\n${url}\n\nThis single-use link expires in ${hours} hour(s). If you did not expect this email, contact management. Never share this link.`,
  });
}

export async function sendLoginOtp(to: string, code: string) {
  if (!mailConfigured())
    throw Object.assign(
      new Error(
        "Email login is not configured. Ask management to configure SMTP before signing in.",
      ),
      { status: 503 },
    );
  await getTransport().sendMail({
    from:
      process.env.MAIL_FROM || process.env.SMTP_USER || "no-reply@localhost",
    to,
    subject: "Your Haskins sign-in code",
    text: `Your Haskins account sign-in code is:\n\n${code}\n\nThis code expires in 5 minutes and can be used once. Never share it. If you did not request it, do not approve the sign-in and contact management.`,
  });
}
