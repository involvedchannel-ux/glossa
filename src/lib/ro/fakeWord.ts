import { validateRoContentWord, type CorpusRuntimeModel } from "../corpusModel";
import type { PRNG } from "../markov";

const C_START = "ptcsrdfgmnlbvzh".split("");
const C_MID = "ptcsrdfgmnlbvzhr".split("");
const V_CORE = ["a", "e", "i", "o", "u"];
const V_FULL = ["a", "e", "i", "o", "u", "ă", "â", "î"];

/** Noun-like endings (frequency skew when posSalience is high). */
const NOUN_END_WEIGHTED = [
  "ă",
  "ă",
  "e",
  "e",
  "i",
  "i",
  "a",
  "u",
  "o",
];

function shuffleInPlace<T>(a: T[], rng: PRNG): void {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = a[i]!;
    a[i] = a[j]!;
    a[j] = t;
  }
}

function pickV(rng: PRNG, rateDiacritic: number): string {
  const pool = rng() < rateDiacritic ? V_FULL : V_CORE;
  return pool[Math.floor(rng() * pool.length)]!;
}

function syllable(
  rng: PRNG,
  onset: boolean,
  posSalience: number,
): string {
  const d = 0.18 + 0.08 * (1 - posSalience);
  let s = "";
  if (onset) s += C_START[Math.floor(rng() * C_START.length)]!;
  s += pickV(rng, d);
  const codaP = 0.35 * (1 - 0.55 * posSalience);
  if (rng() < codaP) s += C_MID[Math.floor(rng() * C_MID.length)]!;
  return s;
}

/**
 * Short stems biased by `posSalience`: 2 syllables most often, rarely 4;
 * less trailing consonant clutter.
 */
export function fakeStem(rng: PRNG, posSalience: number): string {
  const r = rng();
  const n =
    r < 0.58 + 0.22 * posSalience
      ? 2
      : r < 0.92 + 0.05 * posSalience
        ? 3
        : 4;
  let w = syllable(rng, true, posSalience);
  for (let i = 1; i < n; i++) {
    w += syllable(rng, rng() < 0.88 - 0.12 * posSalience, posSalience);
  }
  if (rng() < 0.22 * (1 - posSalience)) {
    w += C_MID[Math.floor(rng() * C_MID.length)]!;
  }
  return w;
}

function pickNounEnding(rng: PRNG, posSalience: number): string {
  if (rng() < 0.55 + 0.35 * posSalience) {
    return NOUN_END_WEIGHTED[Math.floor(rng() * NOUN_END_WEIGHTED.length)]!;
  }
  return ["ă", "e", "i", "u", "a", "o"][Math.floor(rng() * 6)]!;
}

export function fakeNounLemma(rng: PRNG, posSalience: number): string {
  return fakeStem(rng, posSalience) + pickNounEnding(rng, posSalience);
}

export function applyDefinite(
  lemma: string,
  rng: PRNG,
  m: CorpusRuntimeModel | null,
): string {
  const last = lemma[lemma.length - 1]!;
  const opts: string[] = [];
  if ("aeăioâîu".includes(last)) {
    opts.push(`${lemma}a`, `${lemma}le`);
  } else {
    opts.push(`${lemma}l`, `${lemma}ul`, `${lemma}ului`);
  }
  shuffleInPlace(opts, rng);
  for (const o of opts) {
    if (validateRoContentWord(m, o)) return o;
  }
  return lemma;
}

export function applyPlural(
  lemma: string,
  rng: PRNG,
  m: CorpusRuntimeModel | null,
): string {
  const opts: string[] = [];
  if (lemma.endsWith("u")) opts.push(`${lemma}ri`);
  opts.push(`${lemma}e`, `${lemma}uri`);
  shuffleInPlace(opts, rng);
  for (const o of opts) {
    if (validateRoContentWord(m, o)) return o;
  }
  return lemma;
}

/** Shorter 3sg-style endings first when posSalience is high. */
const VERB_3SG_ORDER = ["ă", "e", "ește", "ăște", "ează", "uiește"];

function verbSuffixOrderForStem(
  stem: string,
  rng: PRNG,
  posSalience: number,
): string[] {
  const s = stem.normalize("NFC").toLowerCase();
  const last = s[s.length - 1] ?? "";

  // Romanian has no Hungarian-style vowel harmony, but verb allomorphy is
  // stem-sensitive (e.g. vowel stems often surface with -iește/-uiește).
  if (/[iî]$/u.test(s)) {
    return rng() < 0.55 + 0.3 * posSalience
      ? ["iește", "ește", "uiește", "ăște", "ează", "ă", "e"]
      : shuffleReturn(rng, ["iește", ...VERB_3SG_ORDER]);
  }
  if (last === "u") {
    return rng() < 0.55 + 0.3 * posSalience
      ? ["uiește", "ește", "iește", "ează", "ăște", "ă", "e"]
      : shuffleReturn(rng, ["uiește", ...VERB_3SG_ORDER]);
  }
  if (s.includes("â") || s.includes("î")) {
    return rng() < 0.5 + 0.3 * posSalience
      ? ["ăște", "ește", "ează", "ă", "e", "uiește"]
      : shuffleReturn(rng, [...VERB_3SG_ORDER]);
  }
  if ("aeăo".includes(last)) {
    return rng() < 0.5 + 0.35 * posSalience
      ? ["ează", "ește", "ăște", "ă", "e", "uiește"]
      : shuffleReturn(rng, [...VERB_3SG_ORDER]);
  }
  return rng() < 0.45 + 0.5 * posSalience
    ? [...VERB_3SG_ORDER]
    : shuffleReturn(rng, VERB_3SG_ORDER);
}

export function finiteVerbFromStem(
  stem: string,
  rng: PRNG,
  m: CorpusRuntimeModel | null,
  posSalience: number,
): string {
  const order = verbSuffixOrderForStem(stem, rng, posSalience);
  for (const suf of order) {
    const w =
      stem.endsWith("e") && suf.startsWith("e")
        ? stem.slice(0, -1) + suf
        : stem + suf;
    if (validateRoContentWord(m, w)) return w;
  }
  if (validateRoContentWord(m, stem)) return stem;
  return stem + "e";
}

function shuffleReturn(rng: PRNG, arr: readonly string[]): string[] {
  const a = [...arr];
  shuffleInPlace(a, rng);
  return a;
}

/** Shorter adjective-like endings first when posSalience is high. */
const ADJ_BY_LEN = ["os", "iu", "esc", "al", "an", "oasă", "ească"];

export function fakeAdjective(rng: PRNG, posSalience: number): string {
  const base = fakeStem(rng, posSalience);
  let end: string;
  if (rng() < 0.5 + 0.45 * posSalience) {
    const k = Math.min(ADJ_BY_LEN.length - 1, 2 + Math.floor(rng() * 3));
    end = ADJ_BY_LEN[k]!;
  } else {
    end = ADJ_BY_LEN[Math.floor(rng() * ADJ_BY_LEN.length)]!;
  }
  return base + end;
}
