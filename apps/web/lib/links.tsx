import Link from "next/link";
import type { ComponentProps } from "react";

/** Internal links use next/link; https:, mailto: and tel: addresses are plain anchors. */
export function SmartLink({ href, ...rest }: ComponentProps<"a"> & { href: string }) {
  if (href.startsWith("/")) return <Link href={href} {...(rest as object)} />;
  const external = href.startsWith("https://");
  return <a href={href} {...(external ? { rel: "noopener noreferrer" } : {})} {...rest} />;
}
