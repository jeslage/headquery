import type { Hint } from "../text";
import type { Cause } from "./cause";

export interface Troubleshooting {
  /** What most likely went wrong for this error, if it's recognisable. */
  likely?: Hint;
  /** The recognised problem, if any; `docs` then links to its section. */
  cause?: Cause;
  /** Name of the CMS, e.g. "Statamic". */
  cms: string;
  /** Troubleshooting docs for this CMS. */
  docs: string;
}
