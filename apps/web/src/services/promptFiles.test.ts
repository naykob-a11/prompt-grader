import { describe, expect, test, vi } from 'vitest';
import { isPromptFile, PromptFileError, readPromptFile, safeFileName } from './promptFiles';

vi.mock('./promptSync', () => ({ replaceText: vi.fn() }));

const fileOf = (bytes: Uint8Array) => ({
  size: bytes.length,
  arrayBuffer: () => Promise.resolve(bytes.slice().buffer),
});
const encode = (text: string) => new TextEncoder().encode(text);

async function problemOf(run: Promise<unknown>) {
  const error = await run.catch((e: unknown) => e);
  return (error as PromptFileError).problem;
}

describe('readPromptFile', () => {
  test('reads UTF-8, with or without a byte-order mark', async () => {
    expect(await readPromptFile(fileOf(encode('เงา: ยก')))).toBe('เงา: ยก');
    const bom = new Uint8Array([0xef, 0xbb, 0xbf, ...encode('เงา: ยก')]);
    expect(await readPromptFile(fileOf(bom))).toBe('เงา: ยก');
  });

  test('refuses bytes that are not UTF-8', async () => {
    const bytes = new Uint8Array([0xff, 0xfe, 0x00, 0x80]);
    expect(await problemOf(readPromptFile(fileOf(bytes)))).toBe('notText');
  });

  test('refuses files over the size or line limit', async () => {
    expect(await problemOf(readPromptFile(fileOf(encode('12345')), 4))).toBe('tooLarge');
    const lines = fileOf(encode('a\nb\nc'));
    expect(await problemOf(readPromptFile(lines, 100, 2))).toBe('tooLarge');
  });
});

describe('file names', () => {
  test('only text files count as prompts', () => {
    const named = (name: string) => ({ name }) as File;
    expect(isPromptFile(named('a.sgp.txt'))).toBe(true);
    expect(isPromptFile(named('A.MD'))).toBe(true);
    expect(isPromptFile(named('photo.jpg'))).toBe(false);
  });

  test('export names lose path separators and forbidden characters', () => {
    expect(safeFileName('../../etc/passwd')).toBe('.. .. etc passwd');
    expect(safeFileName('ก:ข*ค?')).toBe('ก ข ค');
    expect(safeFileName('ทุ่งเขียว Cinematic')).toBe('ทุ่งเขียว Cinematic');
    expect(safeFileName('name...')).toBe('name');
  });

  test('a name with nothing usable still gives a file name', () => {
    expect(safeFileName('///')).toBe('prompt');
    expect(safeFileName('')).toBe('prompt');
  });
});
