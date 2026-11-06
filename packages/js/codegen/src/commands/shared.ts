// Small helpers shared by the CLI commands (bundled into dist/cli.js only).
import * as util from "node:util";
import type { ArgsDef, CommandContext } from "citty";

type Format = "green" | "red" | "yellow" | "dim" | "bold" | "cyan";
type StyleText = (format: Format | Format[], text: string, options?: { validateStream?: boolean }) => string;

/** Colour text for a stream: only on a TTY, never with NO_COLOR, and only where Node has util.styleText (≥ 20.12). */
export function style(format: Format | Format[], text: string, stream: NodeJS.WriteStream = process.stdout): string {
  const styleText = (util as { styleText?: StyleText }).styleText;
  if (!styleText || !stream.isTTY || "NO_COLOR" in process.env) return text;
  return styleText(format, text, { validateStream: false });
}

export const ok = (message: string) => console.log(`${style("green", "✓")} ${message}`);
export const fail = (message: string) => console.error(`${style("red", "✗", process.stderr)} ${message}`);

/** Strip our internal "headquery codegen: " / "headquery init: " prefixes; the CLI already says who's talking. */
const cleanMessage = (error: unknown) =>
  (error instanceof Error ? error.message : String(error)).replace(/^headquery (codegen|init): /, "");

/**
 * citty ignores unknown flags and prints stack traces for errors. Wrap a command's `run` so that
 * typos fail loudly and errors print as one line with exit code 1.
 */
export function guarded<T extends ArgsDef>(
  name: string,
  args: T,
  run: (context: CommandContext<T>) => Promise<void>,
): (context: CommandContext<T>) => Promise<void> {
  const known = new Set(["help", "h", ...Object.keys(args)]);
  for (const def of Object.values(args)) {
    const alias = "alias" in def ? def.alias : undefined;
    for (const a of Array.isArray(alias) ? alias : alias ? [alias] : []) known.add(a);
  }
  return async (context) => {
    try {
      for (const raw of context.rawArgs) {
        if (raw === "--") break;
        if (!raw.startsWith("-")) continue;
        const flag = raw.replace(/^--?/, "").split("=")[0]!;
        const base = flag.startsWith("no-") ? flag.slice(3) : flag;
        if (!known.has(flag) && !known.has(base)) {
          throw new Error(`unknown option "${raw.split("=")[0]}". Run \`headquery ${name} --help\` for the options.`);
        }
      }
      if (context.args._.length > 0) {
        throw new Error(`unexpected argument "${context.args._[0]}". Run \`headquery ${name} --help\` for the options.`);
      }
      await run(context);
    } catch (error) {
      fail(cleanMessage(error));
      process.exit(1);
    }
  };
}
