import type { NavTreeItem } from "@headquery/statamic";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import type { MainNavPage } from "@/lib/cms";
import { homeOf, isSite, SITE_HANDLES, SITES, type Site } from "@/lib/sites";
import { cms } from "@/lib/statamic";
import "../globals.css";

type Props = { children: ReactNode; params: Promise<{ site: string }> };

/** One root layout per Statamic site; other values of `[site]` are 404s. */
export function generateStaticParams() {
  return SITE_HANDLES.map((site) => ({ site }));
}
export const dynamicParams = false;

async function siteOf(params: Props["params"]): Promise<Site> {
  const { site } = await params;
  if (!isSite(site)) notFound();
  return site;
}

export async function generateMetadata({ params }: Omit<Props, "children">): Promise<Metadata> {
  const site = await siteOf(params);
  const { data } = await cms.globals("settings").site(site).fields(["site_name"]).get();

  return { title: data.site_name ?? "headquery playground" };
}

type NavPage = Pick<MainNavPage, "title" | "url" | "entry_id">;

function NavItems({ items }: { items: Array<NavTreeItem<NavPage>> }) {
  return (
    <ul>
      {items.map(({ page, children }) => (
        <li key={page.url ?? page.title}>
          {/* Entries are pages of this app (their Statamic URL includes the site prefix); plain links may point anywhere. */}
          {page.entry_id !== null && page.url ? (
            <Link href={page.url}>{page.title}</Link>
          ) : (
            <a href={page.url ?? "#"}>{page.title}</a>
          )}
          {children.length > 0 && <NavItems items={children} />}
        </li>
      ))}
    </ul>
  );
}

export default async function SiteLayout({ children, params }: Props) {
  const site = await siteOf(params);
  // Two independent GET requests for this site, fetched in parallel.
  const [{ data: navigation }, { data: settings }] = await Promise.all([
    cms.navs("main").tree().site(site).fields(["title", "url", "entry_id"]).get(),
    cms.globals("settings").site(site).get(),
  ]);
  return (
    <html lang={SITES[site].lang}>
      <body>
        <header>
          <Link href={homeOf(site)}>{settings.site_name}</Link>
          <nav>
            <NavItems items={navigation} />
          </nav>
          <nav className="sites">
            {SITE_HANDLES.map((s) =>
              s === site ? (
                <strong key={s}>{SITES[s].label}</strong>
              ) : (
                <Link key={s} href={homeOf(s)} hrefLang={SITES[s].lang}>
                  {SITES[s].label}
                </Link>
              ),
            )}
          </nav>
        </header>
        <main>{children}</main>
        <footer>
          {settings.social.map((s) => (
            <a key={s.id ?? s.url} href={s.url ?? "#"}>
              {s.network.label}
            </a>
          ))}
        </footer>
      </body>
    </html>
  );
}
