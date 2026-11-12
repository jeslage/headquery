// Type-checks every ```ts twoslash block in content/ with Twoslash.
//
// Nextra renders these blocks, but rehype-pretty-code swallows Twoslash errors and falls
// back to plain highlighting, so a broken sample would never fail `next build`. This
// script is the actual guard. Expected errors are declared with `// @errors: <code>`.
import { glob, readFile } from "node:fs/promises";
import { relative } from "node:path";
import { createTwoslasher } from "twoslash";

const BLOCK = /^```(ts|tsx)\s+twoslash[^\n]*\n([\s\S]*?)^```/gm;

const twoslasher = createTwoslasher();
let blocks = 0;
const failures = [];

for await (const file of glob("content/**/*.mdx")) {
  const source = await readFile(file, "utf8");
  for (const match of source.matchAll(BLOCK)) {
    blocks++;
    const line = source.slice(0, match.index).split("\n").length;
    try {
      twoslasher(match[2], match[1]);
    } catch (error) {
      failures.push(`${relative(process.cwd(), file)}:${line}\n${error instanceof Error ? error.message : error}`);
    }
  }
}

if (failures.length) {
  console.error(`✗ ${failures.length} of ${blocks} twoslash snippet(s) failed:\n`);
  console.error(failures.join("\n\n"));
  process.exit(1);
}
console.log(`✓ ${blocks} twoslash snippets type-check`);
