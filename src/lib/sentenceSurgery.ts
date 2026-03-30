import {
  generateSentenceCorpus,
  validateHuContentWord,
  type CorpusRuntimeModel,
} from "./corpusModel";
import type { PRNG } from "./markov";
import {
  HU_AUX,
  HU_CASE_SUFFIX,
  HU_CONJ,
  HU_COP,
  HU_DEM,
  HU_DET,
  HU_POSTPOSITION,
  HU_PRON,
  HU_Q,
  HU_SUBORD_AFTER_COMMA,
  HU_SUBORD_SENTENCE_INITIAL,
} from "./hu/closedClass";

function tokenParts(word: string): { lead: string; core: string; trail: string } {
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

function isReplaceableCore(core: string): boolean {
  if (core.length < 3 || core.length > 24) return false;
  return /^[\p{L}\-]+$/u.test(core);
}

const HU_FUNCTION_WORDS = new Set(
  [
    ...HU_DET,
    ...HU_DEM,
    ...HU_PRON,
    ...HU_CONJ,
    ...HU_CASE_SUFFIX,
    ...HU_AUX,
    ...HU_COP,
    ...HU_Q,
    ...HU_SUBORD_AFTER_COMMA,
    ...HU_SUBORD_SENTENCE_INITIAL,
    ...HU_POSTPOSITION,
    "is",
    "nem",
    "se",
    "sem",
  ].map((s) => s.toLowerCase()),
);

const HU_VERB_ENDINGS = [
  "nak",
  "nek",
  "unk",
  "ünk",
  "tok",
  "tek",
  "tök",
  "tam",
  "tem",
  "tom",
  "tök",
  "ik",
  "sz",
  "ok",
  "ek",
  "ök",
  "om",
  "em",
  "am",
  "át",
];

const HU_ADJ_ENDINGS = ["tlan", "tlen", "os", "es", "as", "ös", "i", "ú", "ű"];

const HU_CASE_SUFFIX_BY_LEN = [...HU_CASE_SUFFIX].sort((a, b) => b.length - a.length);

const RO_FUNCTION_WORDS = new Set(
  [
    "și",
    "sau",
    "dar",
    "iar",
    "că",
    "dacă",
    "de",
    "la",
    "în",
    "din",
    "pe",
    "cu",
    "fără",
    "este",
    "sunt",
    "era",
    "au",
    "am",
    "ai",
    "a",
    "un",
    "o",
    "niște",
  ],
);

const EN_FUNCTION_WORDS = new Set(
  [
    "and",
    "or",
    "but",
    "if",
    "that",
    "the",
    "a",
    "an",
    "to",
    "of",
    "in",
    "on",
    "for",
    "with",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "do",
    "does",
    "did",
  ],
);

const EN_VERB_ENDINGS = ["ing", "ed", "en", "ize", "ise", "fy", "s"];
const EN_ADJ_ENDINGS = ["ous", "ive", "al", "ic", "ful", "less", "able", "ible"];
const RO_VERB_ENDINGS = ["ez", "ează", "esc", "ește", "am", "ai", "au", "ăm", "ați"];
const RO_ADJ_ENDINGS = ["os", "oasă", "esc", "ească", "iv", "ivă", "al", "ică"];

function isHuLikelyFunctionWord(coreLower: string): boolean {
  return HU_FUNCTION_WORDS.has(coreLower);
}

function guessHuPos(coreLower: string): "noun" | "verb" | "adj" {
  if (HU_VERB_ENDINGS.some((s) => coreLower.endsWith(s))) return "verb";
  if (HU_ADJ_ENDINGS.some((s) => coreLower.endsWith(s))) return "adj";
  return "noun";
}

function splitHuCaseSuffix(coreLower: string): { stem: string; suffix: string } {
  for (const s of HU_CASE_SUFFIX_BY_LEN) {
    if (coreLower.length > s.length + 1 && coreLower.endsWith(s)) {
      return { stem: coreLower.slice(0, -s.length), suffix: s };
    }
  }
  return { stem: coreLower, suffix: "" };
}

function isFunctionWordForLang(lang: CorpusRuntimeModel["language"], coreLower: string): boolean {
  if (lang === "hu") return isHuLikelyFunctionWord(coreLower);
  if (lang === "ro") return RO_FUNCTION_WORDS.has(coreLower);
  return EN_FUNCTION_WORDS.has(coreLower);
}

function guessPosForLang(
  lang: CorpusRuntimeModel["language"],
  coreLower: string,
): "noun" | "verb" | "adj" {
  if (lang === "hu") return guessHuPos(coreLower);
  if (lang === "ro") {
    if (RO_VERB_ENDINGS.some((s) => coreLower.endsWith(s))) return "verb";
    if (RO_ADJ_ENDINGS.some((s) => coreLower.endsWith(s))) return "adj";
    return "noun";
  }
  if (EN_VERB_ENDINGS.some((s) => coreLower.endsWith(s))) return "verb";
  if (EN_ADJ_ENDINGS.some((s) => coreLower.endsWith(s))) return "adj";
  return "noun";
}

/**
 * Start from a real snippet (if present) or a corpus Markov sentence, then swap
 * content-word cores for fake lemmas. `replaceStrength` is typically the UI slider (0–1).
 */
export function sentenceFromSurgery(
  m: CorpusRuntimeModel,
  rng: PRNG,
  pickNoun: () => string,
  pickVerb: () => string,
  pickAdj: () => string,
  replaceStrength: number,
): string {
  return sentenceFromSurgeryWithBase(
    m,
    rng,
    pickNoun,
    pickVerb,
    pickAdj,
    replaceStrength,
  ).output;
}

export function sentenceFromSurgeryWithBase(
  m: CorpusRuntimeModel,
  rng: PRNG,
  pickNoun: () => string,
  pickVerb: () => string,
  pickAdj: () => string,
  replaceStrength: number,
): { base: string; output: string } {
  const bank = m.snippets.length > 0 ? m.snippets : null;
  const base = bank
    ? bank[Math.floor(rng() * bank.length)]!
    : generateSentenceCorpus(m, rng, 5 + Math.floor(rng() * 8));

  const words = base.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (const w of words) {
    const { lead, core, trail } = tokenParts(w);
    const coreLower = core.normalize("NFC").toLowerCase();
    if (isFunctionWordForLang(m.language, coreLower) || !isReplaceableCore(core)) {
      out.push(w);
      continue;
    }
    const shouldReplaceOpenClass =
      m.language === "hu"
        ? true
        : rng() <= Math.min(0.88, 0.2 + replaceStrength * 0.55);
    if (!shouldReplaceOpenClass) {
      out.push(w);
      continue;
    }
    {
      const pos = guessPosForLang(m.language, coreLower);
      let fake =
        pos === "verb" ? pickVerb() : pos === "adj" ? pickAdj() : pickNoun();
      if (m.language !== "hu") {
        out.push(lead + fake + trail);
        continue;
      }
      const { suffix } = splitHuCaseSuffix(coreLower);
      if (suffix) {
        const glued = `${fake}${suffix}`;
        if (validateHuContentWord(m, glued, { maxGraphemes: m.maxWordGraphemes })) {
          fake = glued;
        }
      }
      out.push(lead + fake + trail);
      continue;
    }
  }
  if (m.language === "hu") {
    const maxG = m.maxWordGraphemes;
    for (let i = 0; i < out.length; i++) {
      const { lead, core, trail } = tokenParts(out[i]!);
      if (!isReplaceableCore(core)) continue;
      const low = core.normalize("NFC").toLowerCase();
      if (validateHuContentWord(m, low, { maxGraphemes: maxG })) continue;
      const pos = guessHuPos(low);
      const fake =
        pos === "verb" ? pickVerb() : pos === "adj" ? pickAdj() : pickNoun();
      out[i] = lead + fake + trail;
    }
  }
  const joined = out.join(" ");
  const cp = [...joined];
  if (cp.length === 0) return { base, output: joined };
  if (m.language === "hu") {
    return {
      base,
      output: cp[0]!.toLocaleUpperCase("hu-HU") + cp.slice(1).join(""),
    };
  }
  const roUp: Record<string, string> = {
    î: "Î",
    ș: "Ș",
    ț: "Ț",
    ă: "Ă",
    â: "Â",
  };
  const f = cp[0]!;
  const u = roUp[f] ?? f.toLocaleUpperCase("ro");
  return { base, output: u + cp.slice(1).join("") };
}
