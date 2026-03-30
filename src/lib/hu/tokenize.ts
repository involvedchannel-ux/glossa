/**
 * Hungarian multigraphs (longest match first) — mirrors scripts/hu-tokenize.mjs.
 */
export const HU_DIGRAPHS = [
  "dzs",
  "dz",
  "sz",
  "cs",
  "gy",
  "ly",
  "ny",
  "ty",
  "zs",
] as const;

export const HU_SINGLE_LETTERS = new Set(
  "aábcdeéfghiíjklmnoóöőpqrstuúüűvwxyz".split(""),
);

export function tokenizeHungarian(text: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; ) {
    const ch = text[i];
    if (ch === " ") {
      out.push(" ");
      i += 1;
      continue;
    }
    let matched = false;
    for (const g of HU_DIGRAPHS) {
      if (text.startsWith(g, i)) {
        out.push(g);
        i += g.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;
    if (HU_SINGLE_LETTERS.has(ch!)) {
      out.push(ch!);
      i += 1;
      continue;
    }
    i += 1;
  }
  return out;
}

/** Tokenize a single lowercase word; null if an unexpected character remains. */
export function tokenizeHungarianWord(word: string): string[] | null {
  const out: string[] = [];
  for (let i = 0; i < word.length; ) {
    let matched = false;
    for (const g of HU_DIGRAPHS) {
      if (word.startsWith(g, i)) {
        out.push(g);
        i += g.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;
    const ch = word[i]!;
    if (HU_SINGLE_LETTERS.has(ch)) {
      out.push(ch);
      i += 1;
      continue;
    }
    return null;
  }
  return out;
}

export function spellingLengthFromTokens(toks: readonly string[]): number {
  return toks.reduce((n, t) => n + t.length, 0);
}
