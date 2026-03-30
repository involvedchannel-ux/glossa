import type { PRNG } from "../markov";

/** Curated closed-class Romanian (real words). Purity 1 = only these + lexicon slots. */
export const RO_CONJ = [
  "și",
  "sau",
  "dar",
  "însă",
  "ori",
  "ci",
  "deci",
  "că",
  "dacă",
  "întrucât",
  "fiindcă",
  "deși",
  "iar",
];

/** Coordinators that typically do NOT require comma when linking simple peers. */
export const RO_CONJ_NO_COMMA = ["și", "sau", "ori"];

/** Adversative/conclusive coordinators commonly preceded by comma between clauses. */
export const RO_CONJ_COMMA = ["dar", "însă", "iar", "ci", "deci"];

/** Subordinators commonly attached to a matrix clause with a comma boundary in templates. */
export const RO_SUBORD_AFTER_COMMA = ["că", "dacă", "deși", "întrucât", "fiindcă"];

export const RO_PREP = [
  "în",
  "pe",
  "la",
  "cu",
  "de",
  "din",
  "pentru",
  "fără",
  "după",
  "spre",
  "sub",
  "printre",
];

export const RO_DET_INDEF = ["un", "o", "niște"];

export const RO_DEM = [
  "acest",
  "această",
  "acești",
  "aceste",
  "aceea",
  "acel",
];

export const RO_PRON_SUBJ = ["el", "ea", "ei", "ele", "noi", "voi"];

export const RO_PRON_OBJ = ["îl", "o", "îi", "le", "ne", "vă"];

export const RO_Q = [
  "ce",
  "cine",
  "cum",
  "când",
  "unde",
  "cât",
  "care",
  "de ce",
];

/** Interrogative starters that should end with `?` in finalization. */
export const RO_REQUIRES_QUESTION_MARK_INITIAL = new Set(
  [
    "ce",
    "cine",
    "cum",
    "când",
    "unde",
    "cât",
    "care",
    "de ce",
  ].map((s) => s.toLowerCase()),
);

/** Fallback forbidden sentence-final dependents for template/corpus cleanup. */
export const RO_FORBIDDEN_SENTENCE_FINAL = new Set(
  [
    "și",
    "sau",
    "ori",
    "dar",
    "însă",
    "întrucât",
    "fiindcă",
    "că",
    "dacă",
    "deși",
    "iar",
    "ci",
    "deci",
    "fie",
    "nici",
    "precum",
  ].map((s) => s.toLowerCase()),
);

export const RO_AUX = [
  "e",
  "sunt",
  "era",
  "erau",
  "au fost",
  "va fi",
  "ar fi",
  "poate",
  "trebuie",
  "pare",
  "vor",
  "vream",
];

export const RO_COPULA_FIN = ["este", "sunt", "erau", "era", "fie"];

export function pick<T>(rng: PRNG, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)]!;
}

export function capitalizeRo(s: string): string {
  if (!s) return s;
  const map: Record<string, string> = {
    î: "Î",
    ș: "Ș",
    ț: "Ț",
    ă: "Ă",
    â: "Â",
  };
  const g = [...s];
  const f = g[0]!;
  const up = map[f] ?? f.toLocaleUpperCase("ro");
  return up + g.slice(1).join("");
}
