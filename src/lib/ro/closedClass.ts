import type { PRNG } from "../markov";

/** Curated closed-class Romanian (real words). Purity 1 = only these + lexicon slots. */
export const RO_CONJ = [
  "și",
  "dar",
  "însă",
  "ori",
  "deci",
  "că",
  "dacă",
  "întrucât",
  "fiindcă",
  "deși",
  "iar",
];

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
