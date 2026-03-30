import type { LanguageId } from "./language";
import type { PRNG } from "./markov";
import {
  canAppendHuPhonotactic,
  huContentWordShapeOk,
} from "./hu/grammar";
import {
  spellingLengthFromTokens,
  tokenizeHungarianWord,
} from "./hu/tokenize";

export type ModelArticleNote = {
  mode: string;
  note: string;
};

export type ModelLinguisticsJson = {
  forbiddenFinal: string[];
  preferInitial: string[];
  initialBoost: number;
  substituteProb: number;
  visualSubstitutes: Record<string, string>;
  article?: ModelArticleNote;
};

export type ModelWordStats = {
  maxGraphemes: number;
  p50?: number;
  p75?: number;
  p82?: number;
  p90?: number;
  mean?: number;
};

export type ModelJsonV4 = {
  v: 4;
  locale: Exclude<LanguageId, "la">;
  encoding: "chars" | "pua";
  /** Human-readable alphabet note (RO); HU lists letters only in comment */
  alphabet?: string;
  puaBase?: number;
  tokens?: string[];
  uni: Record<string, number>;
  bi: Record<string, [string, number][]>;
  tri: Record<string, [string, number][]>;
  first: Record<string, number>;
  last: Record<string, number>;
  maxConsStreak: number;
  maxVowStreak: number;
  roVowelPairs: Record<string, number>;
  wordStats?: ModelWordStats;
  linguistics?: ModelLinguisticsJson;
  /** Clean clause-length extracts for sentence surgery (optional until rebuild). */
  snippets?: string[];
};

export type CorpusLinguistics = {
  forbiddenFinal: Set<string>;
  preferInitial: Set<string>;
  initialBoost: number;
  substituteProb: number;
  visualSubstitutes: Map<string, string>;
};

export type CorpusRuntimeModel = {
  language: Exclude<LanguageId, "la">;
  encoding: "chars" | "pua";
  puaBase: number;
  idToToken: string[];
  spacePua: string;
  uniPairs: [string, number][];
  bi: Map<string, [string, number][]>;
  tri: Map<string, [string, number][]>;
  first: Map<string, number>;
  last: Map<string, number>;
  maxConsStreak: number;
  maxVowStreak: number;
  roVowelPairSet: Set<string>;
  /** Max grapheme length per generated token (from corpus percentiles + literary blend). */
  maxWordGraphemes: number;
  linguistics: CorpusLinguistics;
  /** Real-text clauses for surgery path (may be empty until model rebuild). */
  snippets: string[];
};

const RO_V = new Set("aăâeioîu".split(""));
const HU_V = new Set("aáeéiíoóöőuúüű".split(""));

/** Same seed list as `scripts/build-models.mjs` — used when no `ro.json` is loaded. */
export const RO_VOWEL_PAIR_FALLBACK = new Set(
  [
    "ea",
    "ia",
    "ie",
    "iu",
    "ii",
    "io",
    "oa",
    "ua",
    "uă",
    "eă",
    "ău",
    "âu",
    "îi",
    "îa",
    "ăi",
    "âi",
    "ei",
    "ui",
    "oi",
    "au",
    "ou",
  ].map((p) => p.toLowerCase()),
);

export function tryParseCorpusModel(raw: unknown): CorpusRuntimeModel | null {
  try {
    return parseCorpusModel(raw as ModelJsonV4);
  } catch {
    return null;
  }
}

function toMap<T>(obj: Record<string, T>): Map<string, T> {
  const m = new Map<string, T>();
  for (const k of Object.keys(obj)) m.set(k, obj[k]);
  return m;
}

function parseLinguistics(raw: ModelJsonV4): CorpusLinguistics {
  const L = raw.linguistics;
  if (!L) {
    return {
      forbiddenFinal: new Set(),
      preferInitial: new Set(),
      initialBoost: 0,
      substituteProb: 0,
      visualSubstitutes: new Map(),
    };
  }
  return {
    forbiddenFinal: new Set(L.forbiddenFinal.map((s) => s.toLowerCase())),
    preferInitial: new Set(L.preferInitial.map((s) => s.toLowerCase())),
    initialBoost: L.initialBoost ?? 0,
    substituteProb: L.substituteProb ?? 0,
    visualSubstitutes: new Map(
      Object.entries(L.visualSubstitutes ?? {}).map(([k, v]) => [
        k.toLowerCase(),
        v,
      ]),
    ),
  };
}

/** HU placeholder: approximate first/last grapheme checks when using list-based interrogatives. */
function validateHuSimple(m: CorpusRuntimeModel, w: string): boolean {
  if (w.length < 2 || w.length > 14) return false;
  const f = w[0];
  const l = w[w.length - 1];
  if (f && m.first.size > 0 && !m.first.has(f)) return false;
  if (l && m.last.size > 0 && !m.last.has(l)) return false;
  return true;
}

function shuffleInPlace<T>(a: T[], rng: PRNG): void {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = a[i]!;
    a[i] = a[j]!;
    a[j] = t;
  }
}

function pickBoostedInitial(m: CorpusRuntimeModel, rng: PRNG, maxG: number): string {
  if (m.linguistics.preferInitial.size === 0 || rng() >= m.linguistics.initialBoost) {
    return genWord(m, rng, 2, maxG);
  }
  const prefs = [...m.linguistics.preferInitial];
  shuffleInPlace(prefs, rng);
  for (const cand of prefs) {
    if (m.language === "ro" && validateRoWord(m, cand)) return cand;
    if (m.language === "hu" && validateHuSimple(m, cand)) return cand;
  }
  const shortCap = Math.min(maxG, 8);
  for (let i = 0; i < 18; i++) {
    const w = genWord(m, rng, 2, shortCap);
    if (m.linguistics.preferInitial.has(w.toLowerCase())) return w;
  }
  return genWord(m, rng, 2, maxG);
}

function fixForbiddenFinal(
  m: CorpusRuntimeModel,
  words: string[],
  rng: PRNG,
  maxG: number,
): void {
  const bad = m.linguistics.forbiddenFinal;
  if (bad.size === 0 || words.length < 2) return;
  let guard = 0;
  while (
    guard++ < 22 &&
    words.length >= 2 &&
    bad.has(words[words.length - 1]!.toLowerCase())
  ) {
    words[words.length - 1] = genWord(m, rng, 2, maxG);
  }
}

function applyVisualSubstitutes(words: string[], m: CorpusRuntimeModel, rng: PRNG): void {
  const p = m.linguistics.substituteProb;
  const map = m.linguistics.visualSubstitutes;
  if (p <= 0 || map.size === 0) return;
  for (let i = 0; i < words.length; i++) {
    const low = words[i]!.toLowerCase();
    const sub = map.get(low);
    if (sub !== undefined && rng() < p) words[i] = sub;
  }
}

export function parseCorpusModel(raw: ModelJsonV4): CorpusRuntimeModel {
  if (raw.v !== 4) throw new Error(`Expected model v4, got ${String((raw as { v?: number }).v)}`);
  if (raw.locale !== "hu" && raw.locale !== "ro") {
    throw new Error(`Bad locale ${String(raw.locale)}`);
  }
  const uniPairs = Object.entries(raw.uni) as [string, number][];
  const bi = new Map<string, [string, number][]>();
  for (const k of Object.keys(raw.bi)) bi.set(k, raw.bi[k]);
  const tri = new Map<string, [string, number][]>();
  for (const k of Object.keys(raw.tri)) tri.set(k, raw.tri[k]);
  const tokens = raw.tokens ?? [];
  const puaBase = raw.puaBase ?? 0xe000;
  const idToToken = [...tokens];
  const spaceIdx = idToToken.indexOf(" ");
  const spacePua =
    spaceIdx >= 0
      ? String.fromCodePoint(puaBase + spaceIdx)
      : " ";
  return {
    language: raw.locale,
    encoding: raw.encoding,
    puaBase,
    idToToken,
    spacePua,
    uniPairs,
    bi,
    tri,
    first: toMap(raw.first),
    last: toMap(raw.last),
    maxConsStreak: raw.maxConsStreak,
    maxVowStreak: raw.maxVowStreak,
    roVowelPairSet: new Set(Object.keys(raw.roVowelPairs ?? {})),
    maxWordGraphemes: raw.wordStats?.maxGraphemes ?? 14,
    linguistics: parseLinguistics(raw),
    snippets: Array.isArray(raw.snippets) ? raw.snippets : [],
  };
}

function weightedPickPairs(pairs: [string, number][], rng: PRNG): string {
  let total = 0;
  for (const [, w] of pairs) total += w;
  if (total <= 0) return " ";
  let r = rng() * total;
  for (const [ch, w] of pairs) {
    r -= w;
    if (r <= 0) return ch;
  }
  return pairs[0]?.[0] ?? " ";
}

function filterPairs(
  pairs: [string, number][],
  pred: (ch: string) => boolean,
): [string, number][] {
  const f = pairs.filter(([c]) => pred(c));
  return f.length > 0 ? f : pairs;
}

function isVowelRo(ch: string): boolean {
  return RO_V.has(ch);
}

function isVowelHuToken(t: string): boolean {
  if (t === " ") return false;
  if (t.length !== 1) return false;
  return HU_V.has(t);
}

function endVowelRunRo(w: string): number {
  let n = 0;
  for (let i = w.length - 1; i >= 0; i--) {
    const c = w[i];
    if (!c || c === " ") break;
    if (!isVowelRo(c)) break;
    n++;
  }
  return n;
}

function endConsRunRo(w: string): number {
  let n = 0;
  for (let i = w.length - 1; i >= 0; i--) {
    const c = w[i];
    if (!c || c === " ") break;
    if (isVowelRo(c)) break;
    n++;
  }
  return n;
}

function endVowelRunHuTok(toks: string[]): number {
  let n = 0;
  for (let i = toks.length - 1; i >= 0; i--) {
    const t = toks[i];
    if (!t || t === " ") break;
    if (!isVowelHuToken(t)) break;
    n++;
  }
  return n;
}

function endConsRunHuTok(toks: string[]): number {
  let n = 0;
  for (let i = toks.length - 1; i >= 0; i--) {
    const t = toks[i];
    if (!t || t === " ") break;
    if (isVowelHuToken(t)) break;
    n++;
  }
  return n;
}

function puaToTokens(pua: string, m: CorpusRuntimeModel): string[] {
  const out: string[] = [];
  for (const ch of pua) {
    const cp = ch.codePointAt(0);
    if (cp === undefined) continue;
    const t = m.idToToken[cp - m.puaBase];
    if (t !== undefined) out.push(t);
  }
  return out;
}

export function canAppendRoCore(
  wordChars: string,
  next: string,
  minLen: number,
  maxConsStreak: number,
  maxVowStreak: number,
  roVowelPairSet: Set<string>,
): boolean {
  if (next === " " || next === "\n") {
    return wordChars.length >= minLen;
  }
  const v = isVowelRo(next);
  const ev = endVowelRunRo(wordChars);
  const ec = endConsRunRo(wordChars);
  if (v) {
    if (ev >= maxVowStreak) return false;
    if (ev > 0) {
      const last = wordChars[wordChars.length - 1];
      if (!last) return false;
      const pair = last + next;
      if (!roVowelPairSet.has(pair)) return false;
    }
  } else if (ec >= maxConsStreak) {
    return false;
  }
  return true;
}

function canAppendRo(
  m: CorpusRuntimeModel,
  wordChars: string,
  next: string,
  minLen: number,
): boolean {
  return canAppendRoCore(
    wordChars,
    next,
    minLen,
    m.maxConsStreak,
    m.maxVowStreak,
    m.roVowelPairSet,
  );
}

export function canAppendHuCore(
  wordToks: string[],
  nextTok: string,
  minLen: number,
  maxConsStreak: number,
  maxVowStreak: number,
): boolean {
  if (nextTok === " ") {
    return wordToks.length >= minLen;
  }
  const v = isVowelHuToken(nextTok);
  const ev = endVowelRunHuTok(wordToks);
  const ec = endConsRunHuTok(wordToks);
  if (v && ev >= maxVowStreak) return false;
  if (!v && ec >= maxConsStreak) return false;
  return true;
}

function canAppendHu(
  m: CorpusRuntimeModel,
  wordToks: string[],
  nextTok: string,
  minLen: number,
): boolean {
  if (nextTok !== " " && !canAppendHuPhonotactic(wordToks, nextTok)) return false;
  return canAppendHuCore(
    wordToks,
    nextTok,
    minLen,
    m.maxConsStreak,
    m.maxVowStreak,
  );
}

function sampleNextRo(
  m: CorpusRuntimeModel,
  p2: string,
  p1: string,
  word: string,
  minLen: number,
  rng: PRNG,
): string {
  const triRow = m.tri.get(p2 + p1);
  const rows: [string, number][][] = [];
  if (triRow?.length) rows.push(triRow);
  const biRow = m.bi.get(p1);
  if (biRow?.length) rows.push(biRow);
  if (m.uniPairs.length) rows.push(m.uniPairs);
  for (const row of rows) {
    const f = filterPairs(row, (c) => canAppendRo(m, word, c, minLen));
    if (f.length > 0) return weightedPickPairs(f, rng);
  }
  return " ";
}

function sampleNextHu(
  m: CorpusRuntimeModel,
  p2: string,
  p1: string,
  wordToks: string[],
  minLen: number,
  rng: PRNG,
): string {
  const triRow = m.tri.get(p2 + p1);
  const rows: [string, number][][] = [];
  if (triRow?.length) rows.push(triRow);
  const biRow = m.bi.get(p1);
  if (biRow?.length) rows.push(biRow);
  if (m.uniPairs.length) rows.push(m.uniPairs);
  for (const row of rows) {
    const f = filterPairs(row, (puaCh) => {
      const cp = puaCh.codePointAt(0);
      if (cp === undefined) return false;
      const tok = m.idToToken[cp - m.puaBase];
      if (!tok) return false;
      return canAppendHu(m, wordToks, tok, minLen);
    });
    if (f.length > 0) return weightedPickPairs(f, rng);
  }
  return m.spacePua;
}

function validateRoWord(m: CorpusRuntimeModel, w: string): boolean {
  if (w.length < 2) return false;
  const f = w[0];
  const l = w[w.length - 1];
  if (f && m.first.size > 0 && !m.first.has(f)) return false;
  if (l && m.last.size > 0 && !m.last.has(l)) return false;
  return true;
}

/**
 * Orthography for Romanian **content words** in the template engine:
 * corpus **first/last** stats, **vowel-pair** whitelist, **run caps**, and **max length**
 * from `ro.json` when present; otherwise seed vowel pairs and conservative defaults.
 */
export function validateRoContentWord(
  m: CorpusRuntimeModel | null,
  w: string,
  opts?: { minGraphemes?: number; maxGraphemes?: number },
): boolean {
  const minG = opts?.minGraphemes ?? 2;
  const maxG =
    opts?.maxGraphemes ??
    (m && m.language === "ro" ? m.maxWordGraphemes : 14);
  const t = w.normalize("NFC").toLowerCase();
  if (!/^[a-zăâîșț]+$/u.test(t)) return false;
  const g = [...t];
  if (g.length < minG || g.length > maxG) return false;
  if (m && m.language === "ro") {
    if (!validateRoWord(m, t)) return false;
    const maxCons = m.maxConsStreak;
    const maxVow = m.maxVowStreak;
    const pairs = m.roVowelPairSet;
    let prefix = "";
    for (const ch of g) {
      if (!canAppendRoCore(prefix, ch, 0, maxCons, maxVow, pairs)) return false;
      prefix += ch;
    }
    return canAppendRoCore(prefix, " ", minG, maxCons, maxVow, pairs);
  }
  const maxCons = 3;
  const maxVow = 3;
  const pairs = RO_VOWEL_PAIR_FALLBACK;
  let prefix = "";
  for (const ch of g) {
    if (!canAppendRoCore(prefix, ch, 0, maxCons, maxVow, pairs)) return false;
    prefix += ch;
  }
  return canAppendRoCore(prefix, " ", minG, maxCons, maxVow, pairs);
}

/** Corpus first/last token bounds only (shape: `huContentWordShapeOk` on Unicode tokens). */
function validateHuWord(m: CorpusRuntimeModel, puaWord: string): boolean {
  const toks = puaToTokens(puaWord, m);
  if (toks.length < 1) return false;
  const f = toks[0];
  const l = toks[toks.length - 1];
  if (f && m.first.size > 0 && !m.first.has(f)) return false;
  if (l && m.last.size > 0 && !m.last.has(l)) return false;
  return true;
}

function huTokensToPua(m: CorpusRuntimeModel, toks: readonly string[]): string | null {
  let s = "";
  for (const t of toks) {
    const idx = m.idToToken.indexOf(t);
    if (idx < 0) return null;
    s += String.fromCodePoint(m.puaBase + idx);
  }
  return s;
}

/**
 * Template-engine validation for Hungarian fake words: multigraph tokenization,
 * corpus **first/last token**, vowel/consonant **run caps** (PUA training stats),
 * and spelling length vs **`maxWordGraphemes`** when `hu.json` is loaded.
 */
export function validateHuContentWord(
  m: CorpusRuntimeModel | null,
  w: string,
  opts?: { minGraphemes?: number; maxGraphemes?: number },
): boolean {
  const minSpell = opts?.minGraphemes ?? 3;
  const maxSpell =
    opts?.maxGraphemes ??
    (m && m.language === "hu" ? m.maxWordGraphemes : 14);
  const t = w.normalize("NFC").toLowerCase();
  if (!/^[aábcdeéfghiíjklmnoóöőpqrstuúüűvwxyz]+$/u.test(t)) return false;
  const toks = tokenizeHungarianWord(t);
  if (!toks || toks.length < 2) return false;
  if (!huContentWordShapeOk(toks)) return false;
  const spellLen = spellingLengthFromTokens(toks);
  if (spellLen < minSpell || spellLen > maxSpell) return false;

  if (m && m.language === "hu") {
    const pua = huTokensToPua(m, toks);
    if (!pua || !validateHuWord(m, pua)) return false;
    const prefix: string[] = [];
    for (const tok of toks) {
      if (!canAppendHu(m, prefix, tok, 0)) return false;
      prefix.push(tok);
    }
    return canAppendHu(m, prefix, " ", 2);
  }

  const maxCons = 4;
  const maxVow = 1;
  const prefix: string[] = [];
  for (const tok of toks) {
    if (!canAppendHuCore(prefix, tok, 0, maxCons, maxVow)) return false;
    prefix.push(tok);
  }
  return canAppendHuCore(prefix, " ", 2, maxCons, maxVow);
}

/**
 * Sentence-final punctuation only (. ? !). Semicolons introduce continuations
 * (lists, parallel clauses); they should not close a standalone generated sentence.
 */
function randomSentenceEnd(rng: PRNG): string {
  const r = rng();
  if (r < 0.86) return ".";
  if (r < 0.94) return "?";
  return "!";
}

/** Same distribution as `randomSentenceEnd` — used when templates request “corpus-like” finals. */
export function sampleClausePunctFromCorpus(rng: PRNG): string {
  return randomSentenceEnd(rng);
}

const SENTENCE_END = new Set([".", "?", "!"]);

function capitalizeFirst(lang: LanguageId, word: string): string {
  if (!word) return word;
  const cp = [...word];
  const first = cp[0];
  if (!first) return word;
  if (lang === "ro") {
    const map: Record<string, string> = {
      î: "Î",
      ș: "Ș",
      ț: "Ț",
      ă: "Ă",
      â: "Â",
    };
    const upper = map[first] ?? first.toLocaleUpperCase("ro");
    return upper + cp.slice(1).join("");
  }
  if (lang === "hu") {
    return first.toLocaleUpperCase("hu") + cp.slice(1).join("");
  }
  return first.toLocaleUpperCase() + cp.slice(1).join("");
}

function pickFallbackRo(m: CorpusRuntimeModel, rng: PRNG): string {
  const cons = m.uniPairs.filter(([c]) => c !== " " && !isVowelRo(c));
  const vow = m.uniPairs.filter(([c]) => c !== " " && isVowelRo(c));
  const pool =
    cons.length > 0 ? cons : vow.length > 0 ? vow : m.uniPairs;
  return weightedPickPairs(pool, rng);
}

function pickFallbackHu(m: CorpusRuntimeModel, rng: PRNG): string {
  const cons = m.uniPairs.filter(([pua]) => {
    const cp = pua.codePointAt(0);
    if (cp === undefined) return false;
    const tok = m.idToToken[cp - m.puaBase];
    return tok !== undefined && tok !== " " && !isVowelHuToken(tok);
  });
  const any = m.uniPairs.filter(([pua]) => {
    const cp = pua.codePointAt(0);
    if (cp === undefined) return false;
    const tok = m.idToToken[cp - m.puaBase];
    return tok !== undefined && tok !== " ";
  });
  const pool = cons.length > 0 ? cons : any;
  return weightedPickPairs(pool.length > 0 ? pool : m.uniPairs, rng);
}

function genWordRo(
  m: CorpusRuntimeModel,
  rng: PRNG,
  minLen: number,
  maxLen: number,
): string {
  for (let att = 0; att < 30; att++) {
    let p2 = " ";
    let p1 = " ";
    let w = "";
    let guard = 0;
    const maxGuard = Math.max(240, maxLen * 60);
    while (w.length < maxLen && guard++ < maxGuard) {
        const next =
        w.length === 0 && m.first.size > 0
          ? weightedPickPairs(
              filterPairs(
                [...m.first.entries()],
                (c) => canAppendRo(m, w, c, minLen),
              ),
              rng,
            )
          : sampleNextRo(m, p2, p1, w, minLen, rng);
      if (next === " " || next === "\n") {
        if (w.length >= minLen && canAppendRo(m, w, " ", minLen)) break;
        const filler = pickFallbackRo(m, rng);
        w += filler;
        p2 = p1;
        p1 = filler;
        continue;
      }
      if (!canAppendRo(m, w, next, minLen)) {
        const filler = pickFallbackRo(m, rng);
        if (canAppendRo(m, w, filler, 0)) {
          w += filler;
          p2 = p1;
          p1 = filler;
        }
        continue;
      }
      w += next;
      p2 = p1;
      p1 = next;
    }
    while (w.length < minLen) {
      const filler = pickFallbackRo(m, rng);
      w += filler;
    }
    if (w.length > maxLen) w = w.slice(0, maxLen);
    if (validateRoWord(m, w)) return w;
  }
  return "nem";
}

function genWordHu(m: CorpusRuntimeModel, rng: PRNG, minLen: number, maxLen: number): string {
  for (let att = 0; att < 30; att++) {
    let p2 = m.spacePua;
    let p1 = m.spacePua;
    let w = "";
    let toks: string[] = [];
    let charCount = 0;
    let guard = 0;
    const maxGuard = Math.max(240, maxLen * 60);
    while (charCount < maxLen && guard++ < maxGuard) {
      let next: string;
      if (toks.length === 0 && m.first.size > 0) {
        const firstPairs = [...m.first.entries()];
        const asPua = firstPairs
          .map(([tok, wt]): [string, number] | null => {
            const idx = m.idToToken.indexOf(tok);
            if (idx < 0) return null;
            return [String.fromCodePoint(m.puaBase + idx), wt];
          })
          .filter((x): x is [string, number] => x !== null);
        next = weightedPickPairs(
          filterPairs(asPua, (puaCh) => {
            const cp = puaCh.codePointAt(0);
            if (cp === undefined) return false;
            const t = m.idToToken[cp - m.puaBase];
            return t ? canAppendHu(m, toks, t, minLen) : false;
          }),
          rng,
        );
      } else {
        next = sampleNextHu(m, p2, p1, toks, minLen, rng);
      }
      const tok = m.idToToken[next.codePointAt(0)! - m.puaBase];
      if (tok === " " || next === m.spacePua) {
        if (toks.length >= minLen) break;
        const filler = pickFallbackHu(m, rng);
        const ft = m.idToToken[filler.codePointAt(0)! - m.puaBase];
        if (ft && canAppendHu(m, toks, ft, minLen)) {
          w += filler;
          toks.push(ft);
          charCount += ft.length;
          p2 = p1;
          p1 = filler;
        }
        continue;
      }
      if (!tok || !canAppendHu(m, toks, tok, minLen)) {
        const filler = pickFallbackHu(m, rng);
        const ft = m.idToToken[filler.codePointAt(0)! - m.puaBase];
        if (ft && canAppendHu(m, toks, ft, minLen)) {
          w += filler;
          toks.push(ft);
          charCount += ft.length;
          p2 = p1;
          p1 = filler;
        }
        continue;
      }
      w += next;
      toks.push(tok);
      charCount += tok.length;
      p2 = p1;
      p1 = next;
    }
    while (toks.length < minLen) {
      const filler = pickFallbackHu(m, rng);
      const ft = m.idToToken[filler.codePointAt(0)! - m.puaBase];
      if (ft) {
        w += filler;
        toks.push(ft);
      }
    }
    if (charCount > maxLen) {
      while (charCount > maxLen && toks.length > 1) {
        const t = toks.pop()!;
        charCount -= t.length;
      }
    }
    if (validateHuWord(m, w)) {
      const outToks = puaToTokens(w, m);
      if (huContentWordShapeOk(outToks)) return outToks.join("");
    }
  }
  return "szó";
}

function genWord(
  m: CorpusRuntimeModel,
  rng: PRNG,
  minLen: number,
  maxLen: number,
): string {
  if (m.encoding === "pua") return genWordHu(m, rng, minLen, maxLen);
  return genWordRo(m, rng, minLen, maxLen);
}

/**
 * Single token shaped by corpus character/token n-grams (contrast: phonotactic fake stems).
 */
export function genWordFromCorpus(
  m: CorpusRuntimeModel,
  rng: PRNG,
  minLen: number,
  maxLen: number,
): string {
  return genWord(m, rng, minLen, maxLen);
}

/** Higher = more typical local transitions under the v4 model (for reranking). */
export function scoreSentenceByModel(
  m: CorpusRuntimeModel,
  text: string,
): number {
  const t = text.normalize("NFC").toLowerCase();
  if (m.encoding === "chars") {
    let s = 0;
    for (let i = 0; i < t.length - 1; i++) {
      const a = t[i]!;
      const b = t[i + 1]!;
      if (a === " " || b === " ") continue;
      const row = m.bi.get(a);
      if (!row) continue;
      const hit = row.find(([c]) => c === b);
      s += Math.log(1 + (hit?.[1] ?? 0));
    }
    return s;
  }
  let s = 0;
  const words = t.split(/\s+/).filter(Boolean);
  for (const w of words) {
    const toks = tokenizeHungarianWord(w);
    if (!toks || toks.length < 2) continue;
    let pua = "";
    for (const tok of toks) {
      const idx = m.idToToken.indexOf(tok);
      if (idx < 0) {
        pua = "";
        break;
      }
      pua += String.fromCodePoint(m.puaBase + idx);
    }
    if (pua.length < 2) continue;
    for (let i = 0; i < pua.length - 1; i++) {
      const a = pua[i]!;
      const b = pua[i + 1]!;
      const row = m.bi.get(a);
      if (!row) continue;
      const hit = row.find(([c]) => c === b);
      s += Math.log(1 + (hit?.[1] ?? 0));
    }
  }
  return s;
}

export function generateSentenceCorpus(
  m: CorpusRuntimeModel,
  rng: PRNG,
  wordCount: number,
): string {
  const maxG = m.maxWordGraphemes;
  const words: string[] = [];
  for (let i = 0; i < wordCount; i++) {
    words.push(i === 0 ? pickBoostedInitial(m, rng, maxG) : genWord(m, rng, 2, maxG));
  }
  fixForbiddenFinal(m, words, rng, maxG);
  applyVisualSubstitutes(words, m, rng);
  const body = words.join(" ");
  const end = SENTENCE_END.has(body.slice(-1)) ? "" : randomSentenceEnd(rng);
  const raw = body + end;
  const firstSpace = raw.indexOf(" ");
  if (firstSpace === -1) return capitalizeFirst(m.language, raw);
  return (
    capitalizeFirst(m.language, raw.slice(0, firstSpace)) + raw.slice(firstSpace)
  );
}

export function generateParagraphCorpus(
  m: CorpusRuntimeModel,
  rng: PRNG,
  sentenceCount: number,
): string {
  const parts: string[] = [];
  for (let i = 0; i < sentenceCount; i++) {
    const wc = 5 + Math.floor(rng() * 12);
    parts.push(generateSentenceCorpus(m, rng, wc));
  }
  return parts.join(" ");
}
