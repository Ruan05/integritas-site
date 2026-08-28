import { NextResponse } from "next/server";

const CANONICAL_HOST = "integritass.com";

/**
 * Keep the public address canonical even when a visitor types the common
 * `www` hostname. A 308 preserves the request method and body, which also
 * makes the redirect safe for form and analytics requests.
 */
export function proxy(request: Request) {
  const destination = new URL(request.url);

  if (destination.hostname.toLowerCase() !== `www.${CANONICAL_HOST}`) {
    return NextResponse.next();
  }

  destination.protocol = "https:";
  destination.hostname = CANONICAL_HOST;
  destination.port = "";

  return NextResponse.redirect(destination, 308);
}
