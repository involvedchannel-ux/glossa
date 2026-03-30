import { validateHuContentWord, type CorpusRuntimeModel } from "../corpusModel";
import type { PRNG } from "../markov";
import { HU_POSTPOSITION } from "./closedClass";

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

const HU_BACK_VOWELS = new Set(["a", "á", "o", "ó", "u", "ú"]);
const HU_FRONT_ROUNDED_VOWELS = new Set(["ö", "ő", "ü", "ű"]);
const HU_FRONT_UNROUNDED_VOWELS = new Set(["e", "é", "i", "í"]);
const HU_ALL_VOWELS = new Set([
  ...HU_BACK_VOWELS,
  ...HU_FRONT_ROUNDED_VOWELS,
  ...HU_FRONT_UNROUNDED_VOWELS,
]);

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

function lastVowelOf(word: string): string | null {
  const g = [...word.normalize("NFC").toLowerCase()];
  for (let i = g.length - 1; i >= 0; i--) {
    const ch = g[i]!;
    if (HU_ALL_VOWELS.has(ch)) return ch;
  }
  return null;
}

function isBackWord(word: string): boolean {
  const g = [...word.normalize("NFC").toLowerCase()];
  return g.some((ch) => HU_BACK_VOWELS.has(ch));
}

function chooseHarmonic2(word: string, back: string, front: string): string {
  return isBackWord(word) ? back : front;
}

function chooseHarmonic3(
  word: string,
  back: string,
  frontUnrounded: string,
  frontRounded: string,
): string {
  if (isBackWord(word)) return back;
  const lv = lastVowelOf(word);
  if (lv && HU_FRONT_ROUNDED_VOWELS.has(lv)) return frontRounded;
  return frontUnrounded;
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
  const accusative = chooseHarmonic3(lemma, "ot", "et", "öt");
  const inessive = chooseHarmonic2(lemma, "ban", "ben");
  const opts = [`${lemma}t`, `${lemma}${accusative}`, `${lemma}${inessive}`];
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
  const plural = chooseHarmonic3(lemma, "ok", "ek", "ök");
  const opts = [`${lemma}k`, `${lemma}${plural}`, `${lemma}ak`];
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
  const casePicker = Math.floor(rng() * 8);
  const suf =
    casePicker === 0
      ? chooseHarmonic2(lemma, "ban", "ben")
      : casePicker === 1
        ? chooseHarmonic2(lemma, "ba", "be")
        : casePicker === 2
          ? chooseHarmonic2(lemma, "ról", "ről")
          : casePicker === 3
            ? chooseHarmonic3(lemma, "hoz", "hez", "höz")
            : casePicker === 4
              ? chooseHarmonic2(lemma, "nál", "nél")
              : casePicker === 5
                ? chooseHarmonic2(lemma, "tól", "től")
                : casePicker === 6
                  ? chooseHarmonic2(lemma, "ból", "ből")
                  : chooseHarmonic3(lemma, "on", "en", "ön");
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
