import type { ArgsDef, CommandContext } from "citty";
import { fail } from "./output";

type Run<T extends ArgsDef> = (context: CommandContext<T>) => Promise<void>;

/**
 * citty ignores unknown flags and prints stack traces for errors. Wrap a command's `run` so that
 * typos fail loudly and errors print as one line with exit code 1.
 */
export function guarded<T extends ArgsDef>(name: string, args: T, run: Run<T>): Run<T> {
  const known = knownFlags(args);
  const usage = `Run \`headquery ${name} --help\` for the options.`;
  return async (context) => {
    try {
      const unknown = findUnknownFlag(context.rawArgs, known);
      if (unknown) throw new Error(`unknown option "${unknown.split("=")[0]}". ${usage}`);
      if (context.args._.length > 0) throw new Error(`unexpected argument "${context.args._[0]}". ${usage}`);
      await run(context);
    } catch (error) {
      fail(cleanMessage(error));
      process.exit(1);
    }
  };
}

/** Flag names and aliases a command accepts, plus help. */
function knownFlags(args: ArgsDef): Set<string> {
  const known = new Set(["help", "h", ...Object.keys(args)]);
  for (const def of Object.values(args)) {
    const alias = "alias" in def ? def.alias : undefined;
    for (const a of Array.isArray(alias) ? alias : alias ? [alias] : []) known.add(a);
  }
  return known;
}

/** First flag we don't know (`--no-x` counts as `x`; nothing after `--` is a flag). */
function findUnknownFlag(rawArgs: string[], known: Set<string>): string | undefined {
  for (const raw of rawArgs) {
    if (raw === "--") return undefined;
    if (!raw.startsWith("-")) continue;
    const flag = raw.replace(/^--?/, "").split("=")[0]!;
    const base = flag.startsWith("no-") ? flag.slice(3) : flag;
    if (!known.has(flag) && !known.has(base)) return raw;
  }
  return undefined;
}

/** Strip our internal "headquery codegen: " / "headquery init: " prefixes; the CLI already says who's talking. */
const cleanMessage = (error: unknown) =>
  (error instanceof Error ? error.message : String(error)).replace(/^headquery (codegen|init): /, "");
