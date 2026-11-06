import nextra from "nextra";

const withNextra = nextra({
  defaultShowCopyCode: true,
  search: { codeblocks: false },
});

export default withNextra({
  // Static export: the docs are plain HTML, deployable to any static host / CDN.
  output: "export",
  images: { unoptimized: true },
  reactStrictMode: true,
});
