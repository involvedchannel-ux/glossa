import { validateHuContentWord, type CorpusRuntimeModel } from "../corpusModel";
import type { PRNG } from "../markov";
import { HU_CASE_SUFFIX, HU_POSTPOSITION } from "./closedClass";

const C_SINGLE = "ptkcsrdfgmnlbvjhzr".split("");
const C_CLUSTER = ["sz", "zs", "cs", "gy", "ny", "ty", "ly", "dz"];

const V = ["a", "e", "i", "o", "u", "á", "é", "í", "ó", "ö", "ő", "ú", "ü", "ű"];

const NOUN_END_WEIGHTED = [
  "a",
  "a",
  "e",
  "e",
  "o",
  "o",
  "u",
  "i",
  "ú",
  "ő",
  "ü",
  "ű",
];

function shuffleInPlace<T>(a: T[], rng: PRNG): void {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = a[i]!;
    a[i] = a[j]!;
    a[j] = t;
  }
}

function onset(rng: PRNG, posSalience: number): string {
  if (rng() < 0.22 * (1 - 0.4 * posSalience)) {
    return C_CLUSTER[Math.floor(rng() * C_CLUSTER.length)]!;
  }
  return C_SINGLE[Math.floor(rng() * C_SINGLE.length)]!;
}

function syllable(rng: PRNG, needOnset: boolean, posSalience: number): string {
  let s = "";
  if (needOnset) s += onset(rng, posSalience);
  s += V[Math.floor(rng() * V.length)]!;
  const codaP = 0.32 * (1 - 0.55 * posSalience);
  if (rng() < codaP) {
    s += C_SINGLE[Math.floor(rng() * C_SINGLE.length)]!;
  }
  return s;
}

export function fakeStem(rng: PRNG, posSalience: number): string {
  const r = rng();
  const n =
    r < 0.55 + 0.25 * posSalience
      ? 2
      : r < 0.9 + 0.04 * posSalience
        ? 3
        : 4;
  let w = syllable(rng, true, posSalience);
  for (let i = 1; i < n; i++) {
    w += syllable(rng, rng() < 0.86 - 0.1 * posSalience, posSalience);
  }
  if (rng() < 0.2 * (1 - posSalience)) {
    w += C_SINGLE[Math.floor(rng() * C_SINGLE.length)]!;
  }
  return w;
}

function pickNounEndHu(rng: PRNG, posSalience: number): string {
  if (rng() < 0.6 + 0.3 * posSalience) {
    return NOUN_END_WEIGHTED[
      Math.floor(rng() * NOUN_END_WEIGHTED.length)
    ]!;
  }
  return NOUN_END_WEIGHTED[Math.floor(rng() * NOUN_END_WEIGHTED.length)]!;
}

export function fakeNounLemma(rng: PRNG, posSalience: number): string {
  return fakeStem(rng, posSalience) + pickNounEndHu(rng, posSalience);
}

export function applyDefiniteHu(
  lemma: string,
  rng: PRNG,
  m: CorpusRuntimeModel | null,
): string {
  const opts = [`${lemma}t`, `${lemma}at`, `${lemma}ban`];
  shuffleInPlace(opts, rng);
  for (const o of opts) {
    if (validateHuContentWord(m, o)) return o;
  }
  return lemma;
}

export function applyPluralHu(
  lemma: string,
  rng: PRNG,
  m: CorpusRuntimeModel | null,
): string {
  const opts = [`${lemma}k`, `${lemma}ak`, `${lemma}ek`];
  shuffleInPlace(opts, rng);
  for (const o of opts) {
    if (validateHuContentWord(m, o)) return o;
  }
  return lemma;
}

/**
 * Locative/adessive-style phrase: either `lemma+suffix` (one token) or
 * `lemma postposition` (two tokens), matching Hungarian surface order.
 */
export function fuseNounWithOblique(
  lemma: string,
  rng: PRNG,
  m: CorpusRuntimeModel | null,
): string {
  if (rng() < 0.34) {
    const post = HU_POSTPOSITION[Math.floor(rng() * HU_POSTPOSITION.length)]!;
    return `${lemma} ${post}`;
  }
  const suf = HU_CASE_SUFFIX[Math.floor(rng() * HU_CASE_SUFFIX.length)]!;
  const variants = [lemma + suf];
  for (const v of ["a", "e", "o"]) {
    variants.push(lemma + v + suf);
  }
  shuffleInPlace(variants, rng);
  for (const w of variants) {
    if (validateHuContentWord(m, w)) return w;
  }
  return lemma + suf;
}

/** Short finite-looking suffixes first when posSalience is high. */
const VERB_SHORT_FIRST = ["ik", "sz", "om", "em", "ott", "zik", "nak"];

export function finiteVerbFromStemHu(
  stem: string,
  rng: PRNG,
  m: CorpusRuntimeModel | null,
  posSalience: number,
): string {
  const order =
    rng() < 0.5 + 0.45 * posSalience
      ? [...VERB_SHORT_FIRST]
      : shuffleReturn(rng, VERB_SHORT_FIRST);
  for (const suf of order) {
    const w = stem + suf;
    if (validateHuContentWord(m, w)) return w;
  }
  if (validateHuContentWord(m, stem)) return stem;
  return stem + "ik";
}

function shuffleReturn(rng: PRNG, arr: readonly string[]): string[] {
  const a = [...arr];
  shuffleInPlace(a, rng);
  return a;
}

const ADJ_HU = ["os", "as", "ű", "ú", "és", "ös", "i"];

export function fakeAdjectiveHu(rng: PRNG, posSalience: number): string {
  const base = fakeStem(rng, posSalience);
  let end: string;
  if (rng() < 0.55 + 0.4 * posSalience) {
    const k = Math.min(ADJ_HU.length - 1, 1 + Math.floor(rng() * 3));
    end = ADJ_HU[k]!;
  } else {
    end = ADJ_HU[Math.floor(rng() * ADJ_HU.length)]!;
  }
  return base + end;
}
