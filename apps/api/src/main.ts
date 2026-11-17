import "reflect-metadata";
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import express from "express";
import { registerCms } from "./cms";
import { rows } from "./db";
import { passwordMatches } from "./security";
/** The migration seeds admin@gmail.com / admin@123. That must never survive into production. */
async function guardDefaultAdmin() {
  try {
    const [u] = await rows(
      "SELECT password_hash FROM users WHERE email='admin@gmail.com'",
    );
    if (!u || !passwordMatches("admin@123", u.password_hash)) return;
    const msg =
      "SECURITY: the default administrator (admin@gmail.com / admin@123) still has its default password. Change it in the admin panel (My account).";
    if (
      process.env.NODE_ENV === "production" &&
      process.env.ALLOW_DEFAULT_ADMIN !== "true"
    ) {
      console.error(msg + " Refusing to start in production.");
      process.exit(1);
    }
    console.warn("\n" + msg + "\n");
  } catch {
    /* database not ready: the normal start-up errors will explain */
  }
}
@Module({})
class AppModule {}
async function bootstrap() {
  if (process.env.NODE_ENV === "production" && process.env.SMTP_DEMO === "true")
    throw Error("SMTP_DEMO must be disabled and client SMTP configured before production.");
  if (
    process.env.NODE_ENV === "production" &&
    process.env.DEMO_LOGIN_OTP === "true"
  )
    throw Error(
      "DEMO_LOGIN_OTP must be disabled before starting in production.",
    );
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const server = app.getHttpAdapter().getInstance();
  server.disable("x-powered-by");
  // Behind the website proxy / a reverse proxy, req.ip must be the real visitor (rate limits depend on it).
  // Only forwarded headers from a trusted hop are believed. Set TRUST_PROXY to a hop count (e.g. 1)
  // or address list when running behind nginx/a load balancer.
  server.set(
    "trust proxy",
    process.env.TRUST_PROXY
      ? /^\d+$/.test(process.env.TRUST_PROXY)
        ? Number(process.env.TRUST_PROXY)
        : process.env.TRUST_PROXY
      : "loopback",
  );
  server.use(express.json({ limit: "150kb" }));
  app.enableCors({
    origin: [
      process.env.ADMIN_ORIGIN || "http://localhost:3001",
      process.env.WEB_ORIGIN || "http://localhost:3000",
    ],
    credentials: true,
  });
  await registerCms(server);
  await guardDefaultAdmin();
  await app.listen(
    Number(process.env.API_PORT || process.env.PORT) || 4000,
    process.env.API_HOST || "127.0.0.1",
  );
}
bootstrap().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
