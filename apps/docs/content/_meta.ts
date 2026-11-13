import type { MetaRecord } from "nextra";

export default {
  index: "Introduction",
  "getting-started": "Getting started",
  codegen: "Codegen",
  client: "Client",
  cms: "CMS",
  "-- integrations": { type: "separator", title: "Integrations" },
  frameworks: "Frameworks",
  "data-fetching": "Data fetching libraries",
  "-- project": { type: "separator", title: "Project" },
  motivation: "Motivation",
  roadmap: "Roadmap",
} satisfies MetaRecord;
