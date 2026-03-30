import { genWordFromCorpus, type CorpusRuntimeModel } from "../corpusModel";
import type { PRNG } from "../markov";
import {
  capitalizeHu,
  HU_FORBIDDEN_SENTENCE_FINAL,
  HU_REQUIRES_QUESTION_MARK_INITIAL,
} from "./closedClass";

function stripTrailingClausePunct(s: string): string {
  return s.replace(/[,;:]+$/u, "").trim();
}

function firstSentenceWordKey(sentenceBody: string): string {
  const trimmed = sentenceBody.trim();
  if (!trimmed) return "";
  const w = trimmed.split(/\s+/)[0] ?? "";
  return stripTrailingClausePunct(w).toLowerCase();
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

  const forbidden =
    m && m.linguistics.forbiddenFinal.size > 0
      ? m.linguistics.forbiddenFinal
      : HU_FORBIDDEN_SENTENCE_FINAL;

  const maxG = m?.maxWordGraphemes ?? 14;
  let guard = 0;
  while (guard++ < 24 && words.length > 0) {
    const lastKey = stripTrailingClausePunct(words[words.length - 1]!).toLowerCase();
    if (!forbidden.has(lastKey)) break;
    if (m) {
      words[words.length - 1] = genWordFromCorpus(m, rng, 2, maxG);
    } else {
      words.pop();
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
