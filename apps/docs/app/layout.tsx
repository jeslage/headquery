import type { Metadata } from "next";
import { Head } from "nextra/components";
import { getPageMap } from "nextra/page-map";
import { Footer, Layout, Navbar } from "nextra-theme-docs";
import type { ReactNode } from "react";
import "nextra-theme-docs/style.css";

export const metadata: Metadata = {
  title: { default: "headquery", template: "%s – headquery" },
  description: "Typed, cacheable JavaScript clients for the REST APIs of headless PHP CMSs.",
};

const REPO = "https://github.com/headquery/headquery";

export default async function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <Head />
      <body>
        <Layout
          navbar={<Navbar logo={<b>headquery</b>} projectLink={REPO} />}
          pageMap={await getPageMap()}
          docsRepositoryBase={`${REPO}/tree/main/apps/docs`}
          footer={<Footer>MIT {new Date().getFullYear()} © headquery</Footer>}
        >
          {children}
        </Layout>
      </body>
    </html>
  );
}
