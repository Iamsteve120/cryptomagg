import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getMarkets } from "@/lib/market.functions";
import { getAccount } from "@/lib/trading.functions";

export function useMarkets() {
  const fetchMarkets = useServerFn(getMarkets);
  return useQuery({
    queryKey: ["markets"],
    queryFn: () => fetchMarkets(),
    refetchInterval: 1_200,
    staleTime: 600,
  });
}

export function useAccount() {
  const fetchAccount = useServerFn(getAccount);
  return useQuery({
    queryKey: ["account"],
    queryFn: () => fetchAccount(),
    refetchInterval: 1_000,
    staleTime: 0,
  });
}

/** Drives fast visual market ticks between live provider refreshes. */
export function useRapidMarketClock() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}
