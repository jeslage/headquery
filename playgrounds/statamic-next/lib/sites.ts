// The playground's Statamic sites (playgrounds/statamic/seed/resources/sites.yaml) and how this app
// serves them: the default site without a prefix, every other site under its Statamic URL prefix,
// so Statamic's `url` fields (`/blog/…`, `/de/blog/…`) are this app's routes as well.
// No "server-only": proxy.ts imports this too.

export const SITES = {
  default: {
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
} as const;

export type Site = keyof typeof SITES;

export const SITE_HANDLES = Object.keys(SITES) as Site[];

export const DEFAULT_SITE: Site = "default";

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
