/**
 * Mine sentence boundaries, word lengths, and optional positional stats from plain text.
 */

/** @param {string} text */
export function roughSplitSentences(text) {
  const parts = text.split(/(?<=[.!?…])\s+/u);
  return parts.map((s) => s.trim()).filter(Boolean);
}

/** Grapheme count (Unicode code points, NFC). */
export function graphemeLen(s) {
  return [...s.normalize("NFC")].length;
}

/**
 * @param {string[]} words — lowercased, no empty
 * @returns {{ p50:number, p75:number, p82:number, p90:number, mean:number }}
 */
export function wordLengthPercentiles(words) {
  const lens = words.map(graphemeLen).sort((a, b) => a - b);
  if (lens.length === 0) {
    return { p50: 6, p75: 8, p82: 9, p90: 10, mean: 6 };
  }
  const pick = (p) => lens[Math.min(lens.length - 1, Math.floor(p * lens.length))];
  const mean = lens.reduce((a, b) => a + b, 0) / lens.length;
  return {
    p50: pick(0.5),
    p75: pick(0.75),
    p82: pick(0.82),
    p90: pick(0.9),
    mean: Math.round(mean * 10) / 10,
  };
}

/**
 * @param {string} corpus
 * @returns {string[]}
 */
export function wordsFromCorpus(corpus) {
  return corpus
    .toLowerCase()
    .split(/\s+/u)
    .map((w) => w.replace(/^["""'"„«»(]+|["""'"„»).\],;:?!…]+$/gu, ""))
    .filter((w) => w.length > 0);
}

/**
 * Mine how often a token is the first / last word of a sentence (lowercased word).
 * @param {string} corpus
 * @param {Set<string>} interesting
 */
export function mineSentenceEdges(corpus, interesting) {
  const sentences = roughSplitSentences(corpus.replace(/\n+/g, " "));
  /** @type {Map<string, number>} */
  const first = new Map();
  /** @type {Map<string, number>} */
  const last = new Map();
  for (const sent of sentences) {
    const w = wordsFromCorpus(sent);
    if (w.length === 0) continue;
    const f = w[0];
    const l = w[w.length - 1];
    if (interesting.has(f)) first.set(f, (first.get(f) ?? 0) + 1);
    if (interesting.has(l)) last.set(l, (last.get(l) ?? 0) + 1);
  }
  return { first, last };
}
