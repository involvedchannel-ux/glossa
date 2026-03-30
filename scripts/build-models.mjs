/**
 * Builds constrained character / token n-gram JSON for HU / RO (v4).
 * Run: npm run build-models
 * Requires network. Output: public/models/{hu,ro}.json
 * Wikipedia text: CC BY-SA — attribute if redistributing verbatim extracts.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildHungarianTokenTable,
  tokenizeHungarian,
  tokensToPuaString,
  PUA_BASE,
} from "./hu-tokenize.mjs";
import {
  analyzeCorpusWords,
  analyzeHuTokenWords,
  isVowelChar,
  mapToRecordAll,
  mapToRecordMin,
} from "./lang-stats.mjs";
import {
  wordLengthPercentiles,
  wordsFromCorpus as mineWordsFromCorpus,
} from "./corpus-mine.mjs";
import { fetchLiteraryBlend } from "./literary-fetch.mjs";
import { rulesForLocale } from "./linguistic-rules.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "public", "models");

const UA = "GlossaModelBuilder/0.4 (education; local)";

const MAX_CORPUS_CHARS = 2_500_000;
const TOP_TRI = 36;
const TOP_BI = 56;
const MIN_UNI = 2;
const RO_VV_MIN = 2;

/** Letters + space only after cleaning (lowercase NFC). */
const RO_ALPHABET = new Set("aăâbcdefghiîjklmnopqrsștțuvwxyz ".split(""));
const HU_ALPHABET = new Set("aábcdeéfghiíjklmnoóöőpqrstuúüűvwxyz ".split(""));

/** Attested Romanian vowel adjacencies — union with corpus. */
const RO_VOWEL_PAIR_SEED = [
  "ea",
  "ia",
  "ie",
  "iu",
  "ii",
  "io",
  "oa",
  "ua",
  "uă",
  "eă",
  "ău",
  "âu",
  "îi",
  "îa",
  "ăi",
  "âi",
  "ei",
  "ui",
  "oi",
  "au",
  "ou",
];

function normalizeRo(text) {
  return text
    .normalize("NFC")
    .replace(/\u015f/g, "\u0219")
    .replace(/\u0163/g, "\u021b")
    .replace(/\u015e/g, "\u0218")
    .replace(/\u0162/g, "\u021a");
}

function normalizeHu(text) {
  return text.normalize("NFC");
}

function cleanWikiExtract(raw) {
  return raw
    .replace(/\{\{[\s\S]*?\}\}/g, " ")
    .replace(/\[\[[\s\S]*?\]\]/g, " ")
    .replace(/={2,}[^=]+={2,}/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Drop Bible/footnote symbols, private-use, most punctuation; keep letters. */
function stripNoiseToSpace(s) {
  return s
    .replace(/[\u2000-\u206F\u2E00-\u2E7F'"„”“«»‚‘’‹›]/g, " ")
    .replace(/[\u2020\u2021\u2042\u2055\u00a7\u00b6\u2217]/g, " ")
    .replace(/[\u0300-\u036f]/g, "");
}

function filterCharset(s, allowed) {
  let out = "";
  for (const ch of s) {
    if (allowed.has(ch)) out += ch;
    else out += " ";
  }
  return out.replace(/\s+/g, " ").trim();
}

async function fetchJson(url) {
  let delay = 2000;
  for (let attempt = 0; attempt < 8; attempt++) {
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
    });
    if (res.status === 429 || res.status === 503) {
      await new Promise((r) => setTimeout(r, delay));
      delay = Math.min(delay * 1.6, 60_000);
      continue;
    }
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return res.json();
  }
  throw new Error(`Too many retries for ${url}`);
}

/** MediaWiki limits URL length — keep batches small. */
async function fetchExtracts(host, titles) {
  if (titles.length === 0) return "";
  const chunks = [];
  for (let i = 0; i < titles.length; i += 12) {
    chunks.push(titles.slice(i, i + 12));
  }
  const parts = [];
  for (const group of chunks) {
    const u = new URL(`https://${host}/w/api.php`);
    u.searchParams.set("action", "query");
    u.searchParams.set("format", "json");
    u.searchParams.set("prop", "extracts");
    u.searchParams.set("explaintext", "1");
    u.searchParams.set("redirects", "1");
    u.searchParams.set("titles", group.join("|"));
    const data = await fetchJson(u);
    const pages = data.query?.pages ?? {};
    parts.push(
      Object.values(pages)
        .map((p) => cleanWikiExtract(p.extract ?? ""))
        .filter(Boolean)
        .join("\n\n"),
    );
    await new Promise((r) => setTimeout(r, 400));
  }
  return parts.filter(Boolean).join("\n\n");
}

function prepareCorpusChunk(chunk, locale) {
  let norm = locale === "ro" ? normalizeRo(chunk) : normalizeHu(chunk);
  norm = norm.toLowerCase();
  norm = stripNoiseToSpace(norm);
  norm = norm.replace(/[0-9]+/g, " ");
  const allowed = locale === "ro" ? RO_ALPHABET : HU_ALPHABET;
  norm = filterCharset(norm, allowed);
  return norm.replace(/\s+/g, " ").trim();
}

function collectCorpusFallback(locale) {
  const p = path.join(ROOT, "corpora", `fallback-${locale}.txt`);
  const raw = fs.readFileSync(p, "utf8");
  const once = prepareCorpusChunk(raw, locale);
  const repeated = Array.from({ length: 400 }, () => once).join("\n\n");
  return repeated.slice(0, MAX_CORPUS_CHARS);
}

async function collectCorpus(host, locale) {
  if (process.env.GLOSSA_OFFLINE === "1") {
    console.error(`  GLOSSA_OFFLINE=1 — corpora/fallback-${locale}.txt only`);
    return collectCorpusFallback(locale);
  }
  try {
    const parts = [];
    let total = 0;
    let batch = 0;
    while (total < MAX_CORPUS_CHARS && batch < 140) {
      const ru = new URL(`https://${host}/w/api.php`);
      ru.searchParams.set("action", "query");
      ru.searchParams.set("format", "json");
      ru.searchParams.set("list", "random");
      ru.searchParams.set("rnnamespace", "0");
      ru.searchParams.set("rnlimit", "25");
      const rd = await fetchJson(ru);
      const titles = (rd.query?.random ?? []).map((x) => x.title).filter(Boolean);
      const chunk = await fetchExtracts(host, titles);
      if (!chunk) {
        batch += 1;
        await new Promise((r) => setTimeout(r, 250));
        continue;
      }
      const norm = prepareCorpusChunk(chunk, locale);
      parts.push(norm);
      total += norm.length;
      batch += 1;
      await new Promise((r) => setTimeout(r, 650));
    }
    return parts.join("\n\n").slice(0, MAX_CORPUS_CHARS);
  } catch (e) {
    console.error(
      `  Wikipedia failed for ${locale}; using corpora/fallback-${locale}.txt (${e?.message ?? e})`,
    );
    return collectCorpusFallback(locale);
  }
}

function countNgrams(s) {
  const uni = new Map();
  const bi = new Map();
  const tri = new Map();
  const bumpUni = (c) => uni.set(c, (uni.get(c) ?? 0) + 1);
  const bumpBi = (a, b) => {
    if (!bi.has(a)) bi.set(a, new Map());
    bi.get(a).set(b, (bi.get(a).get(b) ?? 0) + 1);
  };
  const bumpTri = (ab, c) => {
    if (!tri.has(ab)) tri.set(ab, new Map());
    tri.get(ab).set(c, (tri.get(ab).get(c) ?? 0) + 1);
  };
  for (const ch of s) bumpUni(ch);
  for (let i = 0; i < s.length - 1; i++) bumpBi(s[i], s[i + 1]);
  for (let i = 0; i < s.length - 2; i++)
    bumpTri(s[i] + s[i + 1], s[i + 2]);
  return { uni, bi, tri };
}

function pruneRow(m, topN) {
  const ent = [...m.entries()].filter(([, c]) => c >= 1);
  ent.sort((a, b) => b[1] - a[1]);
  return ent.slice(0, topN);
}

function toJsonRows(rowMap, topN) {
  const out = {};
  for (const [k, m] of rowMap) {
    const pr = pruneRow(m, topN);
    if (pr.length === 0) continue;
    out[k] = pr.map(([ch, w]) => [ch, w]);
  }
  return out;
}

function pruneUni(uni) {
  const ent = [...uni.entries()].filter(([, c]) => c >= MIN_UNI);
  ent.sort((a, b) => b[1] - a[1]);
  const o = {};
  for (const [k, w] of ent) o[k] = w;
  return o;
}

function wordsFromCorpus(raw, locale) {
  return raw.split(/\s+/).filter((w) => w.length > 0);
}

function mergeRoVvSeed(map) {
  for (const p of RO_VOWEL_PAIR_SEED) {
    if (p.length !== 2) continue;
    map.set(p, (map.get(p) ?? 0) + RO_VV_MIN);
  }
}

/** Short clean clauses for sentence-surgery path (native spelling only). */
function mineSnippets(raw, locale) {
  const alph = locale === "ro" ? RO_ALPHABET : HU_ALPHABET;
  const merged = raw.replace(/\n+/g, " ");
  const chunks = merged.split(/[.!?]+/);
  const out = [];
  for (const chunk of chunks) {
    const s = chunk.trim();
    if (s.length < 15 || s.length > 280) continue;
    const words = s.split(/\s+/).filter((w) => w.length > 0);
    if (words.length < 5 || words.length > 16) continue;
    let ok = true;
    for (const w of words) {
      const lw = w.toLowerCase().normalize("NFC");
      for (const ch of lw) {
        if (ch === "-" || ch === "\u2014") continue;
        if (!alph.has(ch)) {
          ok = false;
          break;
        }
      }
      if (!ok) break;
    }
    if (!ok) continue;
    out.push(words.join(" "));
    if (out.length >= 240) break;
  }
  return out.slice(0, 140);
}

async function buildRo(raw) {
  const words = wordsFromCorpus(raw, "ro");
  const stats = analyzeCorpusWords(words, "ro");
  mergeRoVvSeed(stats.roVV);
  const roVVObj = mapToRecordMin(stats.roVV, RO_VV_MIN);
  const { uni, bi, tri } = countNgrams(raw);
  return {
    v: 4,
    locale: "ro",
    encoding: "chars",
    alphabet: [...RO_ALPHABET].filter((c) => c !== " ").sort().join("") + " ",
    uni: pruneUni(uni),
    bi: toJsonRows(bi, TOP_BI),
    tri: toJsonRows(tri, TOP_TRI),
    first: mapToRecordAll(stats.first),
    last: mapToRecordAll(stats.last),
    maxConsStreak: stats.maxConsStreak,
    maxVowStreak: stats.maxVowStreak,
    roVowelPairs: roVVObj,
  };
}

async function buildHu(raw) {
  const { tokens, tokenToId, idToToken } = buildHungarianTokenTable();
  /** @type {string[][]} */
  const tokenWords = [];
  const flat = [];
  for (const w of wordsFromCorpus(raw, "hu")) {
    const toks = tokenizeHungarian(w);
    if (toks.length === 0) continue;
    tokenWords.push(toks);
    for (const t of toks) flat.push(t);
    flat.push(" ");
  }
  const puaStream = tokensToPuaString(flat, tokenToId);
  const stats = analyzeHuTokenWords(tokenWords);
  const { uni, bi, tri } = countNgrams(puaStream);
  return {
    v: 4,
    locale: "hu",
    encoding: "pua",
    puaBase: PUA_BASE,
    tokens,
    uni: pruneUni(uni),
    bi: toJsonRows(bi, TOP_BI),
    tri: toJsonRows(tri, TOP_TRI),
    first: mapToRecordAll(stats.first),
    last: mapToRecordAll(stats.last),
    maxConsStreak: stats.maxConsStreak,
    maxVowStreak: 1,
    roVowelPairs: {},
  };
}

/**
 * @param {Record<string, unknown>} model
 * @param {'hu'|'ro'} locale
 * @param {string} raw filtered corpus (same pipeline as n-grams)
 */
function attachWordStatsAndLinguistics(model, locale, raw) {
  const sample = mineWordsFromCorpus(raw.replace(/\n+/g, " "));
  const lens = wordLengthPercentiles(sample);
  const maxG = Math.max(5, Math.min(12, lens.p82));
  const rules = rulesForLocale(locale);
  return {
    ...model,
    wordStats: {
      maxGraphemes: maxG,
      p50: lens.p50,
      p75: lens.p75,
      p82: lens.p82,
      p90: lens.p90,
      mean: lens.mean,
    },
    linguistics: {
      forbiddenFinal: rules.forbiddenFinal,
      preferInitial: rules.preferInitial,
      initialBoost: rules.initialBoost,
      substituteProb: rules.substituteProb,
      visualSubstitutes: rules.visualSubstitutes,
      article: rules.article,
    },
    snippets: mineSnippets(raw, locale),
  };
}

async function buildLocale(locale, host) {
  console.error(`Collecting ${locale} from ${host} …`);
  let wiki = await collectCorpus(host, locale);
  let litPrep = "";
  if (process.env.GLOSSA_OFFLINE !== "1") {
    const litRaw = await fetchLiteraryBlend(locale);
    if (litRaw.length > 0) {
      litPrep = prepareCorpusChunk(litRaw, locale);
      console.error(`  + literary blend chars (filtered): ${litPrep.length}`);
    }
  }
  const raw = [wiki, litPrep].filter(Boolean).join("\n\n").slice(0, MAX_CORPUS_CHARS);
  if (raw.length < 10_000) {
    throw new Error(`${locale}: corpus too small (${raw.length}).`);
  }
  console.error(`  chars (filtered, merged): ${raw.length}`);
  let model = locale === "hu" ? await buildHu(raw) : await buildRo(raw);
  model = attachWordStatsAndLinguistics(model, locale, raw);
  return model;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const hu = await buildLocale("hu", "hu.wikipedia.org");
  const ro = await buildLocale("ro", "ro.wikipedia.org");
  fs.writeFileSync(path.join(OUT_DIR, "hu.json"), JSON.stringify(hu), "utf8");
  fs.writeFileSync(path.join(OUT_DIR, "ro.json"), JSON.stringify(ro), "utf8");
  const hs = (await fs.promises.stat(path.join(OUT_DIR, "hu.json"))).size;
  const rs = (await fs.promises.stat(path.join(OUT_DIR, "ro.json"))).size;
  console.error(`Wrote public/models/hu.json (${hs} bytes)`);
  console.error(`Wrote public/models/ro.json (${rs} bytes)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
