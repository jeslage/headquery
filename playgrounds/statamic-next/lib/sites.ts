// The playground's Statamic sites (playgrounds/statamic/seed/resources/sites.yaml) and how this app
// serves them: the default site without a prefix, every other site under its Statamic URL prefix,
// so Statamic's `url` fields (`/blog/…`, `/de/blog/…`) are this app's routes as well.
// No "server-only": proxy.ts imports this too.
// Keyed by the generated site handles (SiteHandle, from lib/cms.ts), so adding or removing a site in
// Statamic and regenerating the types (`pnpm cms:types`) turns a missing entry here into a type error.

import type { SiteHandle } from "@headquery/statamic";

interface SiteConfig {
  prefix: string;
  lang: string;
  label: string;
  t: { allPosts: string; tags: string; related: string; alsoIn: string; notFound: string };
}

export const SITES = {
  en: {
    prefix: "",
    lang: "en",
    label: "English",
    t: { allPosts: "All posts", tags: "Tags", related: "Related", alsoIn: "Also in", notFound: "Not found" },
  },
  de: {
    prefix: "/de",
    lang: "de",
    label: "Deutsch",
    t: { allPosts: "Alle Beiträge", tags: "Tags", related: "Verwandt", alsoIn: "Auch auf", notFound: "Nicht gefunden" },
  },
} as const satisfies Record<SiteHandle, SiteConfig>;

export type Site = keyof typeof SITES & SiteHandle;

export const SITE_HANDLES = Object.keys(SITES) as Site[];

/** Served without a prefix; the first site in sites.yaml, like Statamic's default site. */
export const DEFAULT_SITE: Site = "en";

export function isSite(handle: string): handle is Site {
  return Object.hasOwn(SITES, handle);
}

/** Site whose prefix starts the pathname, or undefined for the default site. */
export function siteFromPath(pathname: string): Site | undefined {
  return SITE_HANDLES.find((s) => {
    const { prefix } = SITES[s];
    return prefix !== "" && (pathname === prefix || pathname.startsWith(`${prefix}/`));
  });
}

/** Home page of a site: `/` or `/de`. */
export function homeOf(site: Site): string {
  return SITES[site].prefix || "/";
}
