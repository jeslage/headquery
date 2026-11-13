import { type NextRequest, NextResponse } from "next/server";
import { DEFAULT_SITE, siteFromPath } from "./lib/sites";

/**
 * Routes live under `app/[site]/`. URLs with a site prefix (`/de/…`) map onto that segment as they
 * are; everything else belongs to the default site and is rewritten to `/default/…`, so its public
 * URLs stay unprefixed like Statamic's. `/default/…` itself redirects to the unprefixed URL.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const url = request.nextUrl.clone();

  if (pathname === `/${DEFAULT_SITE}` || pathname.startsWith(`/${DEFAULT_SITE}/`)) {
    url.pathname = pathname.slice(DEFAULT_SITE.length + 1) || "/";
    return NextResponse.redirect(url);
  }

  if (siteFromPath(pathname)) return NextResponse.next();

  url.pathname = `/${DEFAULT_SITE}${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  // Skip Next internals and files (anything with an extension, e.g. favicon.ico).
  matcher: ["/((?!_next/|.*\\.).*)"],
};
