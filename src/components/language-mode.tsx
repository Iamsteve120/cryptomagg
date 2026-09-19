import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Check, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export type LanguageCode = "en" | "sw" | "fr" | "es";

export const LANGUAGES: readonly { code: LanguageCode; flag: string; native: string; english: string }[] = [
  { code: "en", flag: "🇬🇧", native: "English", english: "English" },
  { code: "sw", flag: "🇰🇪", native: "Kiswahili", english: "Swahili" },
  { code: "fr", flag: "🇫🇷", native: "Français", english: "French" },
  { code: "es", flag: "🇪🇸", native: "Español", english: "Spanish" },
];

const STORAGE_KEY = "cryptomagg-language";

/** Shared interface wording. Anything missing falls back to English. */
const DICTIONARY: Record<LanguageCode, Record<string, string>> = {
  en: {
    language: "Language",
    dashboard: "Dashboard",
    markets: "Markets",
    trade: "Trade",
    wallet: "Wallet",
    history: "History",
    profile: "Profile",
    demo: "Demo",
    real: "Real",
    signOut: "Sign out",
    accountType: "Account type",
    demoBalance: "Demo USD",
    realBalance: "Real USDT",
    unavailable: "Unavailable",
  },
  sw: {
    language: "Lugha",
    dashboard: "Dashibodi",
    markets: "Masoko",
    trade: "Biashara",
    wallet: "Pochi",
    history: "Historia",
    profile: "Wasifu",
    demo: "Majaribio",
    real: "Halisi",
    signOut: "Toka",
    accountType: "Aina ya akaunti",
    demoBalance: "USD ya majaribio",
    realBalance: "USDT halisi",
    unavailable: "Haipatikani",
  },
  fr: {
    language: "Langue",
    dashboard: "Tableau de bord",
    markets: "Marchés",
    trade: "Trader",
    wallet: "Portefeuille",
    history: "Historique",
    profile: "Profil",
    demo: "Démo",
    real: "Réel",
    signOut: "Se déconnecter",
    accountType: "Type de compte",
    demoBalance: "USD démo",
    realBalance: "USDT réel",
    unavailable: "Indisponible",
  },
  es: {
    language: "Idioma",
    dashboard: "Panel",
    markets: "Mercados",
    trade: "Operar",
    wallet: "Cartera",
    history: "Historial",
    profile: "Perfil",
    demo: "Demo",
    real: "Real",
    signOut: "Cerrar sesión",
    accountType: "Tipo de cuenta",
    demoBalance: "USD demo",
    realBalance: "USDT real",
    unavailable: "No disponible",
  },
};

const LanguageContext = createContext<{
  language: LanguageCode;
  setLanguage: (code: LanguageCode) => void;
  t: (key: string) => string;
}>({ language: "en", setLanguage: () => {}, t: (key) => DICTIONARY.en[key] ?? key });

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>("en");

  // Read after hydration so the server and client render identical markup.
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && LANGUAGES.some((l) => l.code === stored)) setLanguageState(stored as LanguageCode);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((code: LanguageCode) => {
    setLanguageState(code);
    window.localStorage.setItem(STORAGE_KEY, code);
  }, []);

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t: (key: string) => DICTIONARY[language]?.[key] ?? DICTIONARY.en[key] ?? key,
    }),
    [language, setLanguage],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}

export function LanguagePicker() {
  const { language, setLanguage, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const active = LANGUAGES.find((l) => l.code === language) ?? LANGUAGES[0]!;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-1.5 rounded-full bg-card/80 px-2.5 shadow-sm" aria-label={t("language")}>
          <Globe className="size-3.5" />
          <span className="text-xs font-semibold uppercase">{active.code}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-5 py-4 text-left">
          <DialogTitle className="text-lg">{t("language")}</DialogTitle>
        </DialogHeader>
        <ul className="max-h-[60vh] overflow-y-auto">
          {LANGUAGES.map((item) => {
            const selected = item.code === language;
            return (
              <li key={item.code}>
                <button
                  type="button"
                  onClick={() => {
                    setLanguage(item.code);
                    setOpen(false);
                  }}
                  className={
                    "flex w-full items-center gap-4 border-b border-border/60 px-5 py-4 text-left transition-colors hover:bg-accent/60 " +
                    (selected ? "bg-accent/40" : "")
                  }
                >
                  <span className="text-2xl leading-none">{item.flag}</span>
                  <span className="min-w-0 flex-1">
                    <span className={selected ? "block font-semibold text-primary" : "block font-semibold text-foreground"}>
                      {item.native}
                    </span>
                    <span className="block text-sm text-muted-foreground">{item.english}</span>
                  </span>
                  {selected ? <Check className="size-5 text-primary" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
