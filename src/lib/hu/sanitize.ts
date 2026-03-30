import { genWordFromCorpus, type CorpusRuntimeModel } from "../corpusModel";
import type { PRNG } from "../markov";
import {
  capitalizeHu,
  HU_CASE_SUFFIX,
  HU_FORBIDDEN_SENTENCE_FINAL,
  HU_REQUIRES_QUESTION_MARK_INITIAL,
} from "./closedClass";

/** NFC + lower + trim edge punctuation so **és.** / **És** match `forbiddenFinal`. */
function wordGrammarKey(s: string): string {
  return s
    .normalize("NFC")
    .toLowerCase()
    .replace(/^[,.;:!?…]+/gu, "")
    .replace(/[,.;:!?…]+$/gu, "");
}

function forbiddenHuFinalUnion(m: CorpusRuntimeModel | null): Set<string> {
  const u = new Set<string>([...HU_FORBIDDEN_SENTENCE_FINAL]);
  if (m) for (const x of m.linguistics.forbiddenFinal) u.add(x);
  return u;
}

const HU_SURFACE_WORD_RE = /^[aábcdeéfghiíjklmnoóöőpqrstuúüűvwxz]+$/u;

function splitEdgePunctuation(word: string): {
  lead: string;
  core: string;
  trail: string;
} {
  let a = 0;
  let b = word.length;
  while (a < b && !/[\p{L}]/u.test(word[a]!)) a++;
  while (b > a && !/[\p{L}]/u.test(word[b - 1]!)) b--;
  return {
    lead: word.slice(0, a),
    core: word.slice(a, b),
    trail: word.slice(b),
  };
}

function firstSentenceWordKey(sentenceBody: string): string {
  const trimmed = sentenceBody.trim();
  if (!trimmed) return "";
  const w = trimmed.split(/\s+/)[0] ?? "";
  return wordGrammarKey(w);
}

/**
 * Enforces **repeatable** HU output rules after any generator path:
 * no forbidden clause-incomplete finals; interrogative-initial sentences end with **?** only.
 */
export function finalizeHungarianSentence(
  sentence: string,
  m: CorpusRuntimeModel | null,
  rng: PRNG,
): string {
  const t = sentence.trim();
  if (!t) return t;

  const endM = t.match(/[.?!…]+$/u);
  const endChar = endM ? endM[0]! : "";
  let body = endChar ? t.slice(0, -endChar.length).trim() : t;

  let words = body.split(/\s+/).filter(Boolean);
  if (words.length === 0) return ".";

  const forbidden = forbiddenHuFinalUnion(m);

  const maxG = m?.maxWordGraphemes ?? 14;
  let guard = 0;
  while (guard++ < 40 && words.length > 0) {
    const lastKey = wordGrammarKey(words[words.length - 1]!);
    if (!forbidden.has(lastKey)) break;
    if (m) {
      words[words.length - 1] = genWordFromCorpus(m, rng, 2, maxG);
    } else {
      words.pop();
    }
  }
  if (
    words.length > 0 &&
    forbidden.has(wordGrammarKey(words[words.length - 1]!)) &&
    m
  ) {
    for (let k = 0; k < 12; k++) {
      words[words.length - 1] = genWordFromCorpus(m, rng, 3, maxG);
      if (!forbidden.has(wordGrammarKey(words[words.length - 1]!))) break;
    }
  }

  if (words.length === 0) return ".";

  for (let i = 0; i < words.length; i++) {
    const { lead, core, trail } = splitEdgePunctuation(words[i]!);
    if (!core) continue;
    let fixedCore = core.normalize("NFC").toLowerCase();
    if (!HU_SURFACE_WORD_RE.test(fixedCore)) {
      if (m) {
        fixedCore = genWordFromCorpus(m, rng, 2, maxG);
      } else {
        fixedCore = fixedCore.replace(/[^aábcdeéfghiíjklmnoóöőpqrstuúüűvwxz]/gu, "");
      }
    }
    if (!fixedCore) continue;
    words[i] = `${lead}${fixedCore}${trail}`;
  }

  for (let i = 1; i < words.length; i++) {
    const k = wordGrammarKey(words[i]!);
    if (!HU_CASE_SUFFIX.includes(k)) continue;
    const prev = words[i - 1]!;
    words[i - 1] = `${prev}${k}`;
    words.splice(i, 1);
    i -= 1;
  }

  const joined = words.join(" ");
  const mustQuestion = HU_REQUIRES_QUESTION_MARK_INITIAL.has(
    firstSentenceWordKey(joined),
  );

  const outPunct = mustQuestion ? "?" : endChar === "!" ? "!" : ".";

  const rawOut = `${joined}${outPunct}`;
  const g = [...rawOut];
  return capitalizeHu(g[0]!) + g.slice(1).join("");
}

/**
 * Run `finalizeHungarianSentence` on each **. ? !**-delimited segment (corpus chunk + sentence, etc.).
 */
export function finalizeHungarianParagraph(
  text: string,
  m: CorpusRuntimeModel | null,
  rng: PRNG,
): string {
  const t = text.trim();
  if (!t) return t;
  const chunks = t.split(/(?<=[.?!])\s+/u).filter(Boolean);
  if (chunks.length <= 1) return finalizeHungarianSentence(t, m, rng);
  return chunks.map((c) => finalizeHungarianSentence(c, m, rng)).join(" ");
}
