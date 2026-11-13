import type { NavTreeItem } from "@headquery/statamic";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import type { MainNavPage } from "@/lib/cms";
import { cms } from "@/lib/statamic";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const { data } = await cms.global("settings").fields(["site_name"]).get();

  return { title: data.site_name ?? "headquery playground" };
}

type NavPage = Pick<MainNavPage, "title" | "url" | "entry_id">;

function NavItems({ items }: { items: Array<NavTreeItem<NavPage>> }) {
  return (
    <ul>
      {items.map(({ page, children }) => (
        <li key={page.url ?? page.title}>
          {/* Entries are pages of this app; plain links may point anywhere. */}
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

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Two independent GET requests, fetched in parallel.
  const [{ data: navigation }, { data: settings }] = await Promise.all([
    cms.navs("main").tree().fields(["title", "url", "entry_id"]).get(),
    cms.global("settings").get(),
  ]);
  return (
    <html lang="en">
      <body>
        <header>
          <Link href="/">{settings.site_name}</Link>
          <nav>
            <NavItems items={navigation} />
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
