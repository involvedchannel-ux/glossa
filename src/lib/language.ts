export type LanguageId = "la" | "hu" | "ro";

export const LANGUAGES: { id: LanguageId; label: string; native: string }[] = [
  { id: "la", label: "Classic lorem ipsum", native: "Classic lorem ipsum" },
  { id: "hu", label: "Hungarian", native: "Magyar" },
  { id: "ro", label: "Romanian", native: "Română" },
];

const STORAGE_KEY = "glossa-language";

export function readStoredLanguage(): LanguageId | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "la" || v === "hu" || v === "ro") return v;
  } catch {
    /* ignore */
  }
  return null;
}

export function writeStoredLanguage(id: LanguageId): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}
