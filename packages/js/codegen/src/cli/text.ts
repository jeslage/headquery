/**
 * Paragraphs of a hint. Entries starting with "$ " are code (commands, env lines): printed unwrapped
 * and indented, without the "$ " so they can be copied as they are.
 */
export type Hint = string[];

/** The code text of a hint entry, or undefined for prose. */
export const codeLine = (entry: string) => (entry.startsWith("$ ") ? entry.slice(2) : undefined);

/** Word-wrap `text` to `width` columns, every line indented by `indent`. */
export function wrap(text: string, width: number, indent: string): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    if (line && indent.length + line.length + 1 + word.length > width) {
      lines.push(indent + line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(indent + line);
  return lines;
}

/**
 * Render a hint: prose wrapped at `textIndent`, code at `codeIndent` (coloured with `codeStyle`).
 * A blank line separates text and code blocks, but none comes before the first entry.
 */
export function renderHint(
  hint: Hint,
  options: { width: number; textIndent: string; codeIndent: string; codeStyle?: (text: string) => string },
): string[] {
  const { width, textIndent, codeIndent, codeStyle = (text) => text } = options;
  const lines: string[] = [];
  let previousWasCode: boolean | undefined;
  for (const entry of hint) {
    const code = codeLine(entry);
    const isCode = code !== undefined;
    if (previousWasCode !== undefined && previousWasCode !== isCode) lines.push("");
    if (isCode) lines.push(codeIndent + codeStyle(code));
    else lines.push(...wrap(entry, width, textIndent));
    previousWasCode = isCode;
  }
  return lines;
}

/** A line of a box: its plain text (for measuring) and how to print it (with colours or links). */
export interface BoxRow {
  text: string;
  styled?: string;
}

/**
 * Draw a rounded box around `rows`, with `title` in the top border. Widths are measured on the
 * plain texts, so escape codes in `styled` don't break the alignment.
 */
export function box(
  rows: BoxRow[],
  options: { title: BoxRow; indent?: string; border?: (text: string) => string },
): string[] {
  const { title, indent = "", border = (text) => text } = options;
  const inner = Math.max(title.text.length + 2, ...rows.map((row) => row.text.length));
  const span = inner + 2; // between the corners: a space, the content, a space
  return [
    indent + border("╭─ ") + (title.styled ?? title.text) + border(` ${"─".repeat(span - title.text.length - 3)}╮`),
    ...rows.map(
      (row) => indent + border("│ ") + (row.styled ?? row.text) + " ".repeat(inner - row.text.length) + border(" │"),
    ),
    indent + border(`╰${"─".repeat(span)}╯`),
  ];
}
