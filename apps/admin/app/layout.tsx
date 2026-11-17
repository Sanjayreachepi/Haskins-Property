import { connection } from "next/server";
import "../../web/app/theme.css";
import "./fonts.css";
import "./styles.css";
import "./motion.css";
export const metadata = {
  title: "Haskins | Administration",
  robots: { index: false, follow: false },
};
export default async function Layout({ children }: { children: React.ReactNode }) {
  // Rendered per request so the CSP nonce from proxy.ts can be applied to scripts.
  await connection();
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
