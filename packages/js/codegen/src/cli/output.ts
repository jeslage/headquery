// Terminal output for the CLI: colours, ✓/✗ lines.
import * as util from "node:util";

export type Format = "green" | "red" | "yellow" | "dim" | "bold" | "cyan" | "blue" | "underline";
export type Style = (format: Format | Format[], text: string) => string;
type StyleText = (format: Format | Format[], text: string, options?: { validateStream?: boolean }) => string;

/** Colour text for a stream: only on a TTY, never with NO_COLOR, and only where Node has util.styleText (≥ 20.12). */
export function style(format: Format | Format[], text: string, stream: NodeJS.WriteStream = process.stdout): string {
  const styleText = (util as { styleText?: StyleText }).styleText;
  if (!styleText || !stream.isTTY || "NO_COLOR" in process.env) return text;
  return styleText(format, text, { validateStream: false });
}

export const ok = (message: string) => console.log(`${style("green", "✓")} ${message}`);
export const fail = (message: string) => console.error(`${style("red", "✗", process.stderr)} ${message}`);
export const warn = (message: string) => console.log(`${style("yellow", "!")} ${message}`);

/**
 * Whether a stream's terminal renders OSC 8 hyperlinks. `FORCE_HYPERLINK=1` / `=0` overrides the guess.
 * Terminals that aren't recognised still get the plain URL, which most of them make clickable anyway.
 */
export function supportsHyperlinks(stream: NodeJS.WriteStream = process.stdout): boolean {
  const env = process.env;
  if (env.FORCE_HYPERLINK !== undefined) return env.FORCE_HYPERLINK !== "0";
  if (!stream.isTTY || env.CI || env.TERM === "dumb") return false;
  if (env.WT_SESSION || env.KONSOLE_VERSION || env.KITTY_WINDOW_ID || env.WEZTERM_PANE) return true;
  if (Number(env.VTE_VERSION ?? 0) >= 5000) return true;
  return ["iTerm.app", "vscode", "WezTerm", "Hyper", "ghostty", "WarpTerminal"].includes(env.TERM_PROGRAM ?? "");
}

/** A URL styled as a link (blue, underlined) and, where supported, clickable via OSC 8. */
export function link(url: string, stream: NodeJS.WriteStream = process.stdout): string {
  const text = style(["blue", "underline"], url, stream);
  return supportsHyperlinks(stream) ? `\u001B]8;;${url}\u0007${text}\u001B]8;;\u0007` : text;
}
