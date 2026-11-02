import { vocab } from './vocabulary';

const FREE_PROMPT = '{{FREE_PROMPT}}';

/** Every heading set to neutral, for filling in by hand. */
export function buildTemplate(): string {
  const neutral = vocab.neutral[0]!;
  const attributes = vocab.bandAttributes.map((a) => `${a.aliases[1]} ${neutral}`).join(', ');
  return [
    `# ${vocab.meta.name[0]}: `,
    `# ${vocab.meta.tags[0]}: `,
    `# ${vocab.meta.version[0]}: ${vocab.version}`,
    '',
    ...vocab.params.map((p) => `${p.aliases[0]}: ${neutral}`),
    ...vocab.tints.map((t) => `${t.aliases[0]}: ${neutral}`),
    ...vocab.bands.map((b) => `${b.aliases[1]}: ${attributes}`),
    '',
    `[${vocab.sections.notes[0]}]`,
    '',
    `[${vocab.sections.preserve[0]}]`,
    '',
  ].join('\n');
}

/**
 * Fills the chat instruction from seed/sgp-bridge-instruction.md. The template is passed in
 * because reading a text asset depends on the bundler, and this module must stay pure.
 */
export function buildBridgeInstruction(template: string, freeText: string): string {
  const body = template.replace(/\r\n?/g, '\n').replace(/^<!--[\s\S]*?-->\s*/, '');
  return body.replace(FREE_PROMPT, () => freeText.trim());
}
