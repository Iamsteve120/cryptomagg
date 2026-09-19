import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Check, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { LANGUAGES, setActiveLanguage, tr, type LanguageCode } from "@/lib/i18n";

export { LANGUAGES, tr };
export type { LanguageCode };

const STORAGE_KEY = "cryptomagg-language";

const LanguageContext = createContext<{
  language: LanguageCode;
  setLanguage: (code: LanguageCode) => void;
  t: (text: string) => string;
}>({ language: "en", setLanguage: () => {}, t: (text) => text });

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>("en");

  // Applied before children render so every tr() call uses the chosen language.
  setActiveLanguage(language);

  // Read after hydration so the server and client render identical markup.
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && LANGUAGES.some((l) => l.code === stored)) setLanguageState(stored as LanguageCode);
  }, []);

  useEffect(() => {
    const entry = LANGUAGES.find((l) => l.code === language);
    document.documentElement.lang = language;
    document.documentElement.dir = entry?.rtl ? "rtl" : "ltr";
  }, [language]);

  const setLanguage = useCallback((code: LanguageCode) => {
    setActiveLanguage(code);
    setLanguageState(code);
    window.localStorage.setItem(STORAGE_KEY, code);
  }, []);

  const value = useMemo(() => ({ language, setLanguage, t: tr }), [language, setLanguage]);

  return (
    <LanguageContext.Provider value={value}>
      {/* Remounting on change re-renders every translated string in the tree. */}
      <div key={language} className="contents">
        {children}
      </div>
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

export function LanguagePicker() {
  const { language, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const active = LANGUAGES.find((l) => l.code === language) ?? LANGUAGES[0]!;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-1.5 rounded-full bg-card/80 px-2.5 shadow-sm" aria-label={tr("Language")}>
          <Globe className="size-3.5" />
          <span className="text-xs font-semibold uppercase">{active.code}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-5 py-4 text-left">
          <DialogTitle className="text-lg">{tr("Language")}</DialogTitle>
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
