import type { PRNG } from "../markov";
import { HU_DIGRAPHS, tokenizeHungarianWord } from "./tokenize";

const HU_VOWEL_LETTERS = new Set("aáeéiíoóöőuúüű".split(""));

const HU_MULTIGRAPH_SET = new Set<string>(HU_DIGRAPHS as unknown as string[]);

/** No more than this many consonant **tokens** before the first vowel token (digraphs = one token). */
export const HU_MAX_INITIAL_CONSONANT_TOKENS = 2;

export function isHuMultigraphToken(t: string): boolean {
  return HU_MULTIGRAPH_SET.has(t);
}

export function isHuVowelLetterToken(t: string): boolean {
  return t.length === 1 && HU_VOWEL_LETTERS.has(t);
}

/**
 * Consonant tokens from the start until the first vowel; if there is no vowel, length of the whole token list.
 */
export function huLeadingConsonantTokensBeforeFirstVowel(
  toks: readonly string[],
): number {
  let n = 0;
  for (const tok of toks) {
    if (isHuVowelLetterToken(tok)) return n;
    n += 1;
  }
  return n;
}

/**
 * Adjacent multigraph letters (*ty*+*sz*, *sz*+*cs*, …) are unpronounceable juxtapositions in Hungarian
 * filler orthography; reject anywhere in the word (Hungarian syllable-structure / helyesírás teaching).
 */
export function huHasAdjacentMultigraphs(toks: readonly string[]): boolean {
  for (let i = 0; i + 1 < toks.length; i++) {
    if (isHuMultigraphToken(toks[i]!) && isHuMultigraphToken(toks[i + 1]!)) {
      return true;
    }
  }
  return false;
}

/**
 * Word-onset cap: at most two consonant tokens before the first vowel (excludes *ly*+*t*+*m*+*u*-style onset).
 */
export function huOnsetConsonantCapOk(toks: readonly string[]): boolean {
  return (
    huLeadingConsonantTokensBeforeFirstVowel(toks) <= HU_MAX_INITIAL_CONSONANT_TOKENS
  );
}

export function huPhonotacticConstraintsOk(toks: readonly string[]): boolean {
  if (huHasAdjacentMultigraphs(toks)) return false;
  return huOnsetConsonantCapOk(toks);
}

/** Inline generation: reject append if the trial prefix would violate phonotactics. */
export function canAppendHuPhonotactic(
  wordToks: readonly string[],
  nextTok: string,
): boolean {
  if (nextTok === " ") return true;
  return huPhonotacticConstraintsOk([...wordToks, nextTok]);
}

/** All non-corpus checks for a tokenized Hungarian content word (模板 + Markov). */
export function huContentWordShapeOk(toks: readonly string[]): boolean {
  if (huHasIllegalGeminateInitial(toks) || huDispreferredInitialToken(toks)) {
    return false;
  }
  return huPhonotacticConstraintsOk(toks);
}

/**
 * Standard definite article before the next written word (lowercase output).
 * Vowel letters: multigraph-initial words (sz-, cs-, …) take **a** (school grammars, SubLearn, HungarianReference).
 */
export function definiteArticleHu(followingSurfaceWord: string): "a" | "az" {
  const w = followingSurfaceWord.normalize("NFC").toLowerCase();
  const toks = tokenizeHungarianWord(w);
  if (!toks || toks.length === 0) return "a";
  const t0 = toks[0]!;
  if (t0.length === 1 && HU_VOWEL_LETTERS.has(t0)) return "az";
  return "a";
}

/**
 * Picks egy / néhány or the correct definite article (a vs az) for template slots.
 */
export function pickHuDeterminer(rng: PRNG, followingWord: string): string {
  const r = rng();
  if (r < 0.25) return "egy";
  if (r < 0.5) return "néhány";
  return definiteArticleHu(followingWord);
}

/**
 * **Ez a** / **ez az** / **az a** / **az az** patterns (demonstrative + definite article + noun).
 */
export function demonstrativeNounPhrase(rng: PRNG, noun: string): string {
  const dem = rng() < 0.5 ? "ez" : "az";
  return `${dem} ${definiteArticleHu(noun)} ${noun}`;
}

/**
 * **Typo-shaped** word onsets to avoid in invented words: identical single-letter tokens at the left edge
 * (e.g. *ss…*, *tt…*), or a multigraph immediately echoed by its closing letter (*css…*, *ggy…*) — distinct
 * from legal **nn** in *innen* or doubled digraphs (**ssz**, **ggy**) where the second unit is the digraph token.
 */
export function huHasIllegalGeminateInitial(toks: readonly string[]): boolean {
  if (toks.length < 2) return false;
  const a = toks[0]!;
  const b = toks[1]!;
  if (a.length === 1 && b.length === 1 && a === b) return true;
  if (a.length === 2 && b.length === 1 && a[1] === b) return true;
  return false;
}

/**
 * **ű** word-initially is rare in native vocabulary (e.g. *űr*, *űz*); excluding it from validated fake/Markov
 * shapes reduces odd sentence-initial filler while **ú** remains allowed (*út*, *új*, …).
 */
export function huDispreferredInitialToken(toks: readonly string[]): boolean {
  const t0 = toks[0];
  return t0 === "ű";
}
