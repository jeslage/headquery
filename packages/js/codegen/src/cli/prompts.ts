// Interactive questions (@clack/prompts). Ctrl+C / Esc ends the command; files written before that stay.
import { cancel, confirm, isCancel, select, text } from "@clack/prompts";

export interface TextPrompt {
  message: string;
  /** Pre-filled, editable answer (the default). */
  initialValue?: string;
  /** Dim hint shown while the answer is empty (only when there is no default). */
  placeholder?: string;
}

function orExit<T>(answer: T): Exclude<T, symbol> {
  if (isCancel(answer)) {
    cancel("Cancelled.");
    process.exit(1);
  }
  return answer as Exclude<T, symbol>;
}

/** Ask for a line of text; the answer is trimmed. */
export async function ask(prompt: TextPrompt, required: boolean): Promise<string> {
  const answer = orExit(
    await text({ ...prompt, validate: (value) => (required && !value?.trim() ? "Required" : undefined) }),
  );
  return (answer ?? "").trim();
}

export const yesNo = async (message: string, initialValue = true) => orExit(await confirm({ message, initialValue }));

type SelectOptions<T> = Parameters<typeof select<T>>[0]["options"];

export const choose = async <T extends string>(
  message: string,
  initialValue: T,
  options: SelectOptions<T>,
): Promise<T> => orExit(await select({ message, initialValue, options }));
