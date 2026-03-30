/**
 * Function-word and typographic placeholder rules (Hungarian + Romanian).
 * Sources: standard grammars / school grammars (conjunctive & interrogative inventories);
 * articles: areal typology (Hungarian: no freestanding definite/indefinite article like English;
 * Romanian: definite article enclitic on noun, not a separate word — generation is word-level only, see docs).
 */

/** Tokens that strongly imply more material follows — rare as the lone final word before . ? ! */
export const HU_FORBIDDEN_FINAL = new Set(
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

/** Clausal or sentence-initial bias: question / relative pro-forms */
export const HU_PREFER_INITIAL = new Set(
  [
    "ki",
    "kit",
    "kinek",
    "hol",
    "honnan",
    "hová",
    "mikor",
    "miért",
    "hogyan",
    "hány",
    "mennyi",
    "milyen",
    "mi",
    "mit",
    "mivel",
    "meddig",
    "mióta",
  ].map((s) => s.toLowerCase()),
);

export const RO_FORBIDDEN_FINAL = new Set(
  [
    "și",
    "sau",
    "ori",
    "dar",
    "însă",
    "întrucât",
    "fiindcă",
    "pentru",
    "că",
    "dacă",
    "deși",
    "deoarece",
    "precum",
    "iar",
    "fie",
    "nici",
    "ci",
    "încât",
    "astfel",
    "deci",
  ].map((s) => s.toLowerCase()),
);

export const RO_PREFER_INITIAL = new Set(
  [
    "ce",
    "cine",
    "care",
    "când",
    "unde",
    "cum",
    "cât",
    "câte",
    "oriunde",
    "oricând",
    "oricum",
  ].map((s) => s.toLowerCase()),
);

/**
 * Visually similar placeholders (same length class / character inventory) — not real lexemes.
 * Applied stochastically at word level so text reads “almost” familiar.
 */
export const HU_VISUAL_SUBSTITUTES = {
  és: "ézs",
  vagy: "vázk",
  de: "dê",
  mert: "mérx",
  hogy: "hógz",
  ha: "há",
  mikor: "mikôr",
  hol: "hól",
  mi: "mî",
  ki: "kî",
};

export const RO_VISUAL_SUBSTITUTES = {
  și: "şî",
  sau: "sáu",
  dar: "dâr",
  că: "câ",
  cum: "cûm",
  când: "cânx",
  unde: "únde",
  ce: "cé",
  cine: "cíne",
  care: "cáre",
};

export function rulesForLocale(locale) {
  if (locale === "hu") {
    return {
      forbiddenFinal: [...HU_FORBIDDEN_FINAL],
      preferInitial: [...HU_PREFER_INITIAL],
      initialBoost: 0.14,
      substituteProb: 0.28,
      visualSubstitutes: HU_VISUAL_SUBSTITUTES,
      article: {
        mode: "none_freestanding",
        note:
          "Hungarian does not use a/an/the as separate words; definiteness is often marked on the noun (suffix) — not split in this engine.",
      },
    };
  }
  return {
    forbiddenFinal: [...RO_FORBIDDEN_FINAL],
    preferInitial: [...RO_PREFER_INITIAL],
    initialBoost: 0.15,
    substituteProb: 0.28,
    visualSubstitutes: RO_VISUAL_SUBSTITUTES,
    article: {
      mode: "enclitic_definite",
      note:
        "Romanian definite article is typically suffixed to the noun (-l, -le, -ul, …), not a separate word — model does not synthesize full morphology.",
    },
  };
}
