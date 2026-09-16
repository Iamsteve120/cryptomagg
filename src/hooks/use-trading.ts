import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMarkets } from "@/lib/market.functions";
import { getAccount } from "@/lib/trading.functions";

export function useMarkets() {
  const fetchMarkets = useServerFn(getMarkets);
  return useQuery({
    queryKey: ["markets"],
    queryFn: () => fetchMarkets(),
    refetchInterval: 6_000,
    staleTime: 3_000,
  });
}

export function useAccount() {
  const fetchAccount = useServerFn(getAccount);
  return useQuery({
    queryKey: ["account"],
    queryFn: () => fetchAccount(),
    refetchInterval: 6_000,
  });
}
