import { assertIrSchema, type IrSchema } from "@headquery/schema";
import { generateStatamic } from "./statamic";

export type Target = "statamic";

export interface GenerateOptions {
  /** Defaults to `schema.cms.name`. */
  target?: Target;
  moduleName?: string;
}

/** Validate an IR schema and generate a TypeScript module for the matching adapter. */
export function generate(input: unknown, options: GenerateOptions = {}): string {
  assertIrSchema(input);
  const schema: IrSchema = input;

  const target = options.target ?? (schema.cms.name as Target);

  switch (target) {
    case "statamic":
      return generateStatamic(schema, options.moduleName ? { moduleName: options.moduleName } : {});
    default:
      throw new Error(`headquery codegen: no generator for target "${target}"`);
  }
}
