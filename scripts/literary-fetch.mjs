/**
 * Fetch longer, narrative-style plaintext to blend with Wikipedia for word-length stats.
 * Titles are US public-domain / Project Gutenberg; failures are ignored.
 */

const UA = "GlossaLiteraryFetch/0.1 (education; local corpus blend)";

/** @param {string} url */
async function fetchTextMaybe(url) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) return "";
    const t = await res.text();
    return t.length > 800 ? t : "";
  } catch {
    return "";
  }
}

/** Strip PG boilerplate heuristically. */
function stripGutenbergHeader(txt) {
  const start = txt.indexOf("*** START OF");
  const end = txt.indexOf("*** END OF");
  if (start !== -1 && end !== -1 && end > start) {
    return txt.slice(start, end);
  }
  return txt;
}

/** Romanian / Hungarian titles on gutenberg.org/browse/languages/{ro,hu}. */
const URLS = {
  ro: [
    "https://www.gutenberg.org/cache/epub/64597/pg64597.txt",
    "https://www.gutenberg.org/cache/epub/62916/pg62916.txt",
  ],
  hu: [
    "https://www.gutenberg.org/cache/epub/33026/pg33026.txt",
    "https://www.gutenberg.org/cache/epub/20169/pg20169.txt",
  ],
};

/**
 * @param {'hu'|'ro'} locale
 * @returns {Promise<string>}
 */
export async function fetchLiteraryBlend(locale) {
  const list = URLS[locale] ?? [];
  const chunks = [];
  for (const url of list) {
    let raw = await fetchTextMaybe(url);
    if (!raw) continue;
    raw = stripGutenbergHeader(raw);
    chunks.push(raw);
    if (chunks.join("\n\n").length > 500_000) break;
  }
  return chunks.join("\n\n").slice(0, 600_000);
}
