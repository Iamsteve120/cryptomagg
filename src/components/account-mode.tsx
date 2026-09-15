import * as React from "react";

export type AccountMode = "demo" | "live";

type AccountModeContextValue = {
  mode: AccountMode;
  setMode: (mode: AccountMode) => void;
};

const AccountModeContext = React.createContext<AccountModeContextValue | undefined>(undefined);

export function AccountModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = React.useState<AccountMode>("demo");

  React.useEffect(() => {
    const saved = window.localStorage.getItem("cryptomagg-account-mode");
    if (saved === "demo" || saved === "live") setModeState(saved);
  }, []);

  const setMode = React.useCallback((next: AccountMode) => {
    setModeState(next);
    window.localStorage.setItem("cryptomagg-account-mode", next);
  }, []);

  return (
    <AccountModeContext.Provider value={{ mode, setMode }}>
      {children}
    </AccountModeContext.Provider>
  );
}

export function useAccountMode() {
  const context = React.useContext(AccountModeContext);
  if (!context) throw new Error("useAccountMode must be used inside AccountModeProvider");
  return context;
}