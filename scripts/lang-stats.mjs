/** Romanian vowels (standard orthography; y = consonant /j/ in loans). */
const RO_V = new Set("aăâeioîu".split(""));

/** Hungarian vowels (single letter; digraphs like sz are consonants). */
const HU_V = new Set("aáeéiíoóöőuúüű".split(""));

export function isVowelChar(ch, locale) {
  if (locale === "ro") return RO_V.has(ch);
  return HU_V.has(ch);
}

/** @param {string} word single “word” (letters only, no spaces) */
export function wordStreakStats(word, locale) {
  let maxC = 0;
  let maxV = 0;
  let cRun = 0;
  let vRun = 0;
  for (const ch of word) {
    const v = isVowelChar(ch, locale);
    if (v) {
      vRun += 1;
      cRun = 0;
      maxV = Math.max(maxV, vRun);
    } else {
      cRun += 1;
      vRun = 0;
      maxC = Math.max(maxC, cRun);
    }
  }
  return { maxC, maxV };
}

/**
 * Adjacent vowel-letter pairs (diphthong / hiatus cues) for Romanian.
 * @param {string} word
 * @param {'ro'} locale
 */
export function collectAdjVowelPairs(word, locale) {
  const pairs = [];
  for (let i = 0; i < word.length - 1; i++) {
    const a = word[i];
    const b = word[i + 1];
    if (!a || !b) continue;
    if (isVowelChar(a, locale) && isVowelChar(b, locale)) pairs.push(a + b);
  }
  return pairs;
}

/** @param {string} word */
export function collectRoVowelPairs(word) {
  return collectAdjVowelPairs(word, "ro");
}

/**
 * @param {string[]} wordsDecoded — human-readable tokens joined without spaces for RO (chars); for HU join tokens
 */
export function analyzeCorpusWords(wordsDecoded, locale) {
  /** @type {Map<string, number>} */
  const first = new Map();
  /** @type {Map<string, number>} */
  const last = new Map();
  /** @type {Map<string, number>} */
  const roVV = new Map();
  const streakCons = [];
  const streakVow = [];

  for (const w of wordsDecoded) {
    if (!w.length) continue;
    first.set(w[0], (first.get(w[0]) ?? 0) + 1);
    last.set(w[w.length - 1], (last.get(w[w.length - 1]) ?? 0) + 1);
    const { maxC, maxV } = wordStreakStats(w, locale);
    streakCons.push(maxC);
    streakVow.push(maxV);
    if (locale === "ro") {
      for (const p of collectAdjVowelPairs(w, "ro")) {
        roVV.set(p, (roVV.get(p) ?? 0) + 1);
      }
    }
  }

  streakCons.sort((a, b) => a - b);
  streakVow.sort((a, b) => a - b);
  const pct = (arr, p) => arr[Math.floor((p / 100) * (arr.length - 1))] ?? 1;

  return {
    first,
    last,
    roVV,
    maxConsStreak: Math.min(8, Math.max(2, pct(streakCons, 98))),
    maxVowStreak:
      locale === "hu"
        ? 1
        : Math.min(4, Math.max(2, pct(streakVow, 98))),
  };
}

/** @param {Map<string, number>} m @param {number} minCount */
export function mapToRecordMin(m, minCount) {
  const o = {};
  for (const [k, v] of m) {
    if (v >= minCount) o[k] = v;
  }
  return o;
}

/** @param {Map<string, number>} m */
export function mapToRecordAll(m) {
  const o = {};
  for (const [k, v] of m) o[k] = v;
  return o;
}

function isVowelHuToken(t) {
  if (t === " ") return false;
  if (t.length !== 1) return false;
  return HU_V.has(t);
}

/**
 * @param {string[][]} wordsAsTokens
 */
export function analyzeHuTokenWords(wordsAsTokens) {
  /** @type {Map<string, number>} */
  const first = new Map();
  /** @type {Map<string, number>} */
  const last = new Map();
  const streakCons = [];
  const streakVow = [];

  for (const toks of wordsAsTokens) {
    if (!toks.length) continue;
    first.set(toks[0], (first.get(toks[0]) ?? 0) + 1);
    last.set(toks[toks.length - 1], (last.get(toks[toks.length - 1]) ?? 0) + 1);
    let maxC = 0;
    let maxV = 0;
    let cRun = 0;
    let vRun = 0;
    for (const t of toks) {
      const v = isVowelHuToken(t);
      if (v) {
        vRun += 1;
        cRun = 0;
        maxV = Math.max(maxV, vRun);
      } else {
        cRun += 1;
        vRun = 0;
        maxC = Math.max(maxC, cRun);
      }
    }
    streakCons.push(maxC);
    streakVow.push(maxV);
  }

  streakCons.sort((a, b) => a - b);
  streakVow.sort((a, b) => a - b);
  const pct = (arr, p) => arr[Math.floor((p / 100) * (arr.length - 1))] ?? 1;

  return {
    first,
    last,
    maxConsStreak: Math.min(8, Math.max(2, pct(streakCons, 98))),
    maxVowStreak: 1,
  };
}

