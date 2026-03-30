import { genWordFromCorpus, type CorpusRuntimeModel } from "../corpusModel";
import type { PRNG } from "../markov";
import {
  capitalizeHu,
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
