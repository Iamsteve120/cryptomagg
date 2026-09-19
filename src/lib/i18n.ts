import translations from "./translations.json";

export type LanguageCode =
  | "en" | "sw" | "fr" | "es" | "ar" | "zh" | "hi" | "pt"
  | "de" | "ru" | "ja" | "tr" | "id" | "am" | "fil";

export const LANGUAGES: readonly { code: LanguageCode; flag: string; native: string; english: string; rtl?: boolean }[] = [
  { code: "en", flag: "🇬🇧", native: "English", english: "English" },
  { code: "sw", flag: "🇰🇪", native: "Kiswahili", english: "Swahili" },
  { code: "fr", flag: "🇫🇷", native: "Français", english: "French" },
  { code: "es", flag: "🇪🇸", native: "Español", english: "Spanish" },
  { code: "pt", flag: "🇧🇷", native: "Português", english: "Portuguese" },
  { code: "de", flag: "🇩🇪", native: "Deutsch", english: "German" },
  { code: "ru", flag: "🇷🇺", native: "Русский", english: "Russian" },
  { code: "ar", flag: "🇦🇪", native: "العربية", english: "Arabic", rtl: true },
  { code: "zh", flag: "🇨🇳", native: "中文", english: "Chinese" },
  { code: "hi", flag: "🇮🇳", native: "हिन्दी", english: "Hindi" },
  { code: "ja", flag: "🇯🇵", native: "日本語", english: "Japanese" },
  { code: "tr", flag: "🇹🇷", native: "Türkçe", english: "Turkish" },
  { code: "id", flag: "🇮🇩", native: "Bahasa Indonesia", english: "Indonesian" },
  { code: "am", flag: "🇪🇹", native: "አማርኛ", english: "Amharic" },
  { code: "fil", flag: "🇵🇭", native: "Filipino", english: "Filipino" },
];

const TABLES = translations as Record<string, Record<string, string>>;

let active: LanguageCode = "en";

export function setActiveLanguage(code: LanguageCode) {
  active = code;
}

export function activeLanguage(): LanguageCode {
  return active;
}

/** Translate an English interface string. Unknown strings stay in English. */
export function tr(text: string): string {
  if (active === "en") return text;
  return TABLES[active]?.[text] ?? text;
}
