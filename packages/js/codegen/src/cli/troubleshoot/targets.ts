import type { Target } from "../../generate";
import type { SchemaLoadError } from "../../load";
import { statamic } from "./statamic";
import type { Troubleshooting } from "./types";

const TARGETS: Record<Target, (error: SchemaLoadError) => Troubleshooting> = { statamic };

/** Likely cause and checklist for a load error, per CMS. */
export function troubleshoot(error: SchemaLoadError, target: Target): Troubleshooting {
  return TARGETS[target](error);
}
