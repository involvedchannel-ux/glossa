import { genWordFromCorpus, type CorpusRuntimeModel } from "../corpusModel";
import type { PRNG } from "../markov";
import {
  capitalizeRo,
  RO_FORBIDDEN_SENTENCE_FINAL,
  RO_REQUIRES_QUESTION_MARK_INITIAL,
} from "./closedClass";

function wordGrammarKey(s: string): string {
  return s
    .normalize("NFC")
    .toLowerCase()
    .replace(/^[,.;:!?…]+/gu, "")
    .replace(/[,.;:!?…]+$/gu, "");
}

function forbiddenRoFinalUnion(m: CorpusRuntimeModel | null): Set<string> {
  const u = new Set<string>([...RO_FORBIDDEN_SENTENCE_FINAL]);
  if (m) for (const x of m.linguistics.forbiddenFinal) u.add(x);
  return u;
}

function firstSentenceWordKey(sentenceBody: string): string {
  const trimmed = sentenceBody.trim();
  if (!trimmed) return "";
  const ws = trimmed.split(/\s+/u);
  if (ws.length === 0) return "";
  const w1 = ws[0] ?? "";
  const w2 = ws.length > 1 ? ws[1] ?? "" : "";
  const k1 = wordGrammarKey(w1);
  const k2 = wordGrammarKey(w2);
  if (k1 === "de" && k2 === "ce") return "de ce";
  return k1;
}

export function finalizeRomanianSentence(
  sentence: string,
  m: CorpusRuntimeModel | null,
  rng: PRNG,
): string {
  const t = sentence.trim();
  if (!t) return t;
  const endM = t.match(/[.?!…]+$/u);
  const endChar = endM ? endM[0] ?? "" : "";
  const body = endChar ? t.slice(0, -endChar.length).trim() : t;
  const words = body.split(/\s+/u).filter(Boolean);
  if (words.length === 0) return ".";

  const forbidden = forbiddenRoFinalUnion(m);
  const maxG = m?.maxWordGraphemes ?? 14;
  let guard = 0;
  while (guard++ < 36 && words.length > 0) {
    const lastKey = wordGrammarKey(words[words.length - 1] ?? "");
    if (!forbidden.has(lastKey)) break;
    if (m) {
      words[words.length - 1] = genWordFromCorpus(m, rng, 2, maxG);
    } else {
      words.pop();
    }
  }
  if (words.length === 0) return ".";

  const joined = words.join(" ");
  const firstKey = firstSentenceWordKey(joined);
  const mustQuestion = RO_REQUIRES_QUESTION_MARK_INITIAL.has(firstKey);
  const outPunct = mustQuestion ? "?" : endChar === "!" ? "!" : ".";
  const raw = `${joined}${outPunct}`;
  const g = [...raw];
  return capitalizeRo(g[0] ?? "") + g.slice(1).join("");
}

export function finalizeRomanianParagraph(
  text: string,
  m: CorpusRuntimeModel | null,
  rng: PRNG,
): string {
  const t = text.trim();
  if (!t) return t;
  const chunks = t.split(/(?<=[.?!])\s+/u).filter(Boolean);
  if (chunks.length <= 1) return finalizeRomanianSentence(t, m, rng);
  return chunks.map((c) => finalizeRomanianSentence(c, m, rng)).join(" ");
}
