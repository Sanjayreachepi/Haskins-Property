import { SMTPServer } from "smtp-server";
import { createServer } from "node:http";

const smtpPort = Number(process.env.DEMO_SMTP_PORT || 1025);
const inboxPort = Number(process.env.DEMO_INBOX_PORT || 8025);
const messages = [];
const escape = (value) =>
  String(value).replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
const smtp = new SMTPServer({
  disabledCommands: ["AUTH", "STARTTLS"],
  size: 1024 * 1024,
  onData(stream, session, done) {
    let body = "";
    stream.on("data", (chunk) => {
      if (body.length <= 1024 * 1024) body += chunk.toString();
    });
    stream.once("error", done);
    stream.on("end", () => {
      if (stream.sizeExceeded)
        return done(new Error("Demo email is too large"));
      const decoded = body
        .replace(/=\r?\n/g, "")
        .replace(/=([0-9a-f]{2})/gi, (_, hex) =>
          String.fromCharCode(parseInt(hex, 16)),
        );
      messages.unshift({
        at: new Date().toISOString(),
        recipients: session.envelope.rcptTo.map(
          (recipient) => recipient.address,
        ),
        body: decoded,
      });
      messages.length = Math.min(messages.length, 50);
      done();
    });
  },
});
const inbox = createServer((request, response) => {
  if (
    ![`localhost:${inboxPort}`, `127.0.0.1:${inboxPort}`].includes(
      request.headers.host,
    )
  ) {
    response.writeHead(403);
    response.end();
    return;
  }
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader(
    "Content-Security-Policy",
    "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
  );
  if (request.method !== "GET" || request.url !== "/") {
    response.writeHead(404);
    response.end();
    return;
  }
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.end(
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Haskins demo inbox</title><style>body{font:16px system-ui;max-width:960px;margin:40px auto;padding:0 20px}article{border-top:1px solid #bbb;padding:20px 0}pre{white-space:pre-wrap;overflow-wrap:anywhere}a{overflow-wrap:anywhere}</style><h1>Haskins demo inbox</h1><p>Local demo only. Nothing is delivered to Gmail or any external mailbox. Refresh to see new emails. Restarting clears the inbox.</p>${
      messages.length
        ? messages
            .map(
              (message) =>
                `<article><h2>To: ${escape(message.recipients.join(", "))}</h2><p>${escape(message.at)}</p>${[
                  ...new Set(
                    message.body.match(
                      /https?:\/\/[^\s<>"']+\/reset-password\?token=[a-f0-9]{64}(?:&(?:amp;)?(?:invite|account)=1)*/g,
                    ) || [],
                  ),
                ]
                  .map((link) => {
                    const clean = link.replace(/&amp;/g, "&");
                    return `<p><a href="${escape(clean)}" rel="noreferrer">Open invitation / reset password</a></p>`;
                  })
                  .join(
                    "",
                  )}<details><summary>Email contents</summary><pre>${escape(message.body)}</pre></details></article>`,
            )
            .join("")
        : "<p>No emails yet. Create an invitation, request a password reset, or submit an inquiry.</p>"
    }</html>`,
  );
});
smtp.on("error", (error) => {
  console.error("Demo SMTP could not start:", error.code || error.message);
  process.exitCode = 1;
  inbox.close();
});
inbox.on("error", (error) => {
  console.error("Demo inbox could not start:", error.code || error.message);
  process.exitCode = 1;
  smtp.close();
});
smtp.listen(smtpPort, "127.0.0.1", () =>
  console.log(`Demo SMTP: 127.0.0.1:${smtpPort} (local capture only)`),
);
inbox.listen(inboxPort, "127.0.0.1", () =>
  console.log(`Demo inbox: http://localhost:${inboxPort}`),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    inbox.close();
    smtp.close();
  });
