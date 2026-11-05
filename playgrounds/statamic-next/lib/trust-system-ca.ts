import tls from "node:tls";

// Trust the OS certificate store as well, so DDEV's mkcert HTTPS works without
// NODE_OPTIONS=--use-system-ca. Imported by lib/statamic.ts so it runs in every process
// that fetches (dev server, build workers). Node ≥ 22.19; older versions skip this.
if (tls.setDefaultCACertificates) {
  const certs = new Set([...tls.getCACertificates("default"), ...tls.getCACertificates("system")]);
  tls.setDefaultCACertificates([...certs]);
}
