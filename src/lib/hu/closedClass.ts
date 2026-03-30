import type { PRNG } from "../markov";

/** Curated Hungarian closed-class (real) words for templates. */
export const HU_CONJ = [
  "és",
  "vagy",
  "de",
  "pedig",
  "mert",
  "ha",
  "viszont",
  "így",
  "akkor",
];

/**
 * Case suffixes fused onto the noun stem (one surface word). Templates should use
 * `fuseNounWithOblique()` rather than a separate spaced token.
 */
export const HU_CASE_SUFFIX = [
  "ban",
  "ben",
  "ba",
  "be",
  "hoz",
  "hez",
  "höz",
  "nál",
  "nél",
  "tól",
  "től",
  "ból",
  "ből",
  "on",
  "ön",
  "en",
  "án",
  "ra",
  "re",
];

/**
 * Subordinating conjunctions / adverbial clause introducers typically preceded by a comma
 * after the matrix clause (HungarianReference, NTK grammars).
 */
export const HU_SUBORD_AFTER_COMMA = [
  "hogy",
  "mert",
  "bár",
  "noha",
  "miközben",
  "mintha",
  "ahogy",
  "amíg",
  "ameddig",
] as const;

/**
 * Subordinators that often **open** the sentence; the dependent clause is followed by a comma
 * before the matrix clause (cf. *Amint megérkezett, elindultunk*).
 */
export const HU_SUBORD_SENTENCE_INITIAL = [
  "amint",
  "mielőtt",
  "mihelyt",
  "ahogy",
  "ameddig",
  "amíg",
] as const;

/**
 * Fallback when `hu.json` has no `linguistics.forbiddenFinal` — expand with matrix incompletes.
 * Rebuild JSON via `scripts/build-models.mjs` to persist; keep this list aligned with `linguistic-rules.mjs`.
 */
export const HU_FORBIDDEN_SENTENCE_FINAL = new Set(
  [
    "a",
    "az",
    "és",
    "vagy",
    "de",
    "pedig",
    "mert",
    "ha",
    "hogy",
    "mint",
    "amíg",
    "bár",
    "viszont",
    "ellenben",
    "hanem",
    "s",
    "avagy",
    "mintha",
    "ahogy",
    "miközben",
    "egyúttal",
    "azaz",
    "illetve",
    "amint",
    "amikor",
    "mikor",
    "mihelyt",
    "mielőtt",
    "ameddig",
    "mégis",
    "akkor",
    "így",
    "noha",
  ].map((s) => s.toLowerCase()),
);

/** Postpositions written after the noun (noun + space + postposition). */
export const HU_POSTPOSITION = [
  "alatt",
  "előtt",
  "után",
  "között",
  "nélkül",
  "szerint",
];

/** Combined pool for legacy / generic picks (e.g. weighted draws). */
export const HU_PREP = [...HU_CASE_SUFFIX, ...HU_POSTPOSITION];

export const HU_DET = ["a", "az", "egy", "néhány"];

export const HU_DEM = ["ez", "az", "ezek", "azok", "ilyen", "olyan"];

export const HU_PRON = [
  "ő",
  "ők",
  "én",
  "te",
  "mi",
  "ti",
  "őt",
  "nekem",
  "neked",
  "neki",
  "nekik",
];

export const HU_Q = [
  "mi",
  "ki",
  "hol",
  "mikor",
  "hogyan",
  "miért",
  "mennyi",
  "milyen",
  "hány",
];

/**
 * First word of sentence requires **?**
 * (unambiguous interrogative / WH forms — excludes **mi** “what” homograph with **mi** “we”).
 */
export const HU_REQUIRES_QUESTION_MARK_INITIAL = new Set(
  [
    "ki",
    "hol",
    "mikor",
    "hogyan",
    "miért",
    "mennyi",
    "milyen",
    "hány",
    "meddig",
    "mióta",
    "mit",
    "mivel",
    "honnan",
    "hová",
    "kit",
    "kinek",
    "minek",
    "miben",
    "miből",
    "hányadik",
    "melyik",
  ].map((s) => s.toLowerCase()),
);

export const HU_AUX = [
  "van",
  "volt",
  "lesz",
  "voltak",
  "lehet",
  "kell",
  "fog",
  "nincs",
];

export const HU_COP = ["volt", "volna", "lenne", "lett"];

export function pick<T>(rng: PRNG, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)]!;
}

export function capitalizeHu(s: string): string {
  if (!s) return s;
  const g = [...s];
  return g[0]!.toLocaleUpperCase("hu-HU") + g.slice(1).join("");
}
