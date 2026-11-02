declare module '*/reference/sgp-reference.mjs' {
  export function loadDefaults(): { schema: unknown; vocab: unknown };
  export function parseSGP(
    text: string,
    schema: unknown,
    vocab: unknown,
  ): {
    params: Record<string, number>;
    name: string;
    tags: string[];
    notes: string;
    preserve: string;
    warnings: { line: number; message: string }[];
    matched: number;
  };
  export function serializeSGP(preset: object, schema: unknown, vocab: unknown): string;
}
