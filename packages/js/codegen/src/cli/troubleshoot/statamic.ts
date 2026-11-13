import type { SchemaLoadError } from "../../load";
import { docsUrl } from "../docs";
import type { Hint } from "../text";
import { causeOf } from "./cause";
import { genericHint } from "./generic";
import type { Troubleshooting } from "./types";

export const statamic = (error: SchemaLoadError): Troubleshooting => {
  const cause = causeOf(error);
  const generic = genericHint(error, cause) ?? [];
  let likely: Hint | undefined;
  switch (cause) {
    case "certificate":
      likely = [
        "Node doesn't trust the HTTPS certificate. Local Herd/Valet sites use their own CA, which is in the system keychain but not in Node's list. Let Node use the system CAs (Node ≥ 22.15):",
        "$ NODE_OPTIONS=--use-system-ca npx headquery generate",
        "or point it at the CA file (Valet: ~/.config/valet/CA/LaravelValetCASelfSigned.pem):",
        `$ NODE_EXTRA_CA_CERTS="$HOME/path/to/ca.pem" npx headquery generate`,
        "or use the http:// URL.",
      ];
      break;
    case "enotfound":
      likely = [...generic, "*.test domains from Herd/Valet only resolve on the machine that serves them."];
      break;
    case "404-not-found":
      likely = [
        "The schema route doesn't answer. The CMS's .env needs the schema route (without a token it stays 404) and Statamic's REST API, which is a Pro feature:",
        "$ HEADQUERY_SCHEMA_ROUTE=true",
        "$ HEADQUERY_SCHEMA_TOKEN=<same value as in the frontend>",
        "$ STATAMIC_API_ENABLED=true",
        "$ STATAMIC_PRO_ENABLED=true",
        "Then clear the cached config on the CMS:",
        "$ php artisan config:clear",
        "If you changed statamic.api.route or headquery.schema.path, set `from.apiPrefix` / `from.schemaPath` in the config.",
      ];
      break;
    case "401-unauthorized":
      likely = [
        error.sentToken
          ? "The token was rejected: HEADQUERY_SCHEMA_TOKEN here doesn't match HEADQUERY_SCHEMA_TOKEN in the CMS's .env."
          : "No token was sent. Set HEADQUERY_SCHEMA_TOKEN (same value as on the CMS) in your env file, the config's `token`, or pass --token.",
      ];
      break;
    case "500-internal-server-error":
      likely = ["The CMS failed while exporting the schema. Check storage/logs/laravel.log on the CMS."];
      break;
    case "not-json":
      likely = [
        "That's not the schema endpoint (often an HTML page or a redirect to one). Check the base URL and the API prefix (statamic.api.route, default /api).",
      ];
      break;
    case "file-not-found":
      likely = [...generic, "Export it on the CMS:", "$ php please headquery:schema --out=schema.json"];
      break;
    default:
      likely = generic.length > 0 ? generic : undefined;
  }

  return {
    ...(likely !== undefined ? { likely } : {}),
    ...(cause !== undefined ? { cause } : {}),
    cms: "Statamic",
    docs: docsUrl(`/cms/statamic/troubleshooting${cause ? `#${cause}` : ""}`),
  };
};
