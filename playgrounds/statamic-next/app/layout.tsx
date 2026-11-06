import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { cms } from "@/lib/statamic";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const { data } = await cms.global("settings").fields(["site_name"]).get();
  return { title: data.site_name ?? "headquery playground" };
}

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { data: settings } = await cms.global("settings").get();
  return (
    <html lang="en">
      <body>
        <header>
          <Link href="/">{settings.site_name}</Link>
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
