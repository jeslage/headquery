// Renders the troubleshooting report for the terminal.
import type { Target } from "../../generate";
import type { SchemaLoadError } from "../../load";
import type { Style } from "../output";
import { box, renderHint, wrap } from "../text";
import { troubleshoot } from "./targets";

const statusText = (error: SchemaLoadError) => `${error.status ?? ""}${error.statusText ? ` ${error.statusText}` : ""}`;

const headline = (error: SchemaLoadError) => {
  switch (error.kind) {
    case "network":
      return `Couldn't reach the CMS${error.code ? `: ${error.code}` : ""}`;
    case "http":
      return `The schema endpoint responded ${statusText(error)}`;
    case "json":
      return error.status !== undefined
        ? `The schema endpoint didn't return JSON (${statusText(error)})`
        : "The schema file isn't valid JSON";
    case "file":
      return `Couldn't read the schema file${error.code ? `: ${error.code}` : ""}`;
  }
};

/** Key/value lines under the headline (URL, status, token, response excerpt, …). */
function details(error: SchemaLoadError): [string, string][] {
  const http = error.status !== undefined;
  const rows: [string, string | undefined][] = [
    [error.kind === "file" || (error.kind === "json" && !http) ? "File" : "URL", error.source],
    ["Status", http ? statusText(error) : undefined],
    ["Type", error.contentType],
    ["Error", error.reason],
    [
      "Token",
      error.kind !== "file" && error.source.startsWith("http") ? (error.sentToken ? "sent" : "not sent") : undefined,
    ],
    ["Response", error.body],
  ];
  return rows.filter((row): row is [string, string] => Boolean(row[1]));
}

/** The full error report: headline, details, likely cause and a link to the troubleshooting docs. */
export function formatLoadError(
  error: SchemaLoadError,
  target: Target,
  options: { width?: number; style?: Style; link?: (url: string) => string } = {},
): string {
  const width = Math.max(60, Math.min(options.width ?? 100, 110));
  const style: Style = options.style ?? ((_, text) => text);
  const link = options.link ?? ((url: string) => url);
  const { likely, cause, cms, docs } = troubleshoot(error, target);
  const out = [`${style("red", "✗")} ${style("bold", headline(error))}`, ""];

  const rows = details(error);
  const keyWidth = Math.max(...rows.map(([key]) => key.length)) + 2;
  for (const [key, value] of rows) {
    const [first = "", ...rest] = wrap(value, width, " ".repeat(2 + keyWidth));
    out.push(`  ${style("dim", key.padEnd(keyWidth))}${first.trimStart()}`, ...rest);
  }

  if (likely) {
    out.push("", `  ${style("yellow", "●")} ${style("bold", "Likely cause")}`);
    out.push(
      ...renderHint(likely, {
        width,
        textIndent: "    ",
        codeIndent: "      ",
        codeStyle: (code) => style("cyan", code),
      }),
    );
  }

  const help = cause
    ? "The troubleshooting docs explain this error step by step, with the commands to fix it:"
    : `headquery doesn't recognise this error. The troubleshooting docs list the common problems with ${cms} and how to fix them:`;
  // Room for the help text: the outer indent and the box's borders and padding.
  const helpLines = wrap(help, width - 6, "").map((text) => ({ text }));
  out.push(
    "",
    ...box([...helpLines, { text: docs, styled: link(docs) }], {
      title: { text: "→ More help", styled: `${style("cyan", "→")} ${style("bold", "More help")}` },
      indent: "  ",
      border: (text) => style("dim", text),
    }),
  );
  return out.join("\n");
}
