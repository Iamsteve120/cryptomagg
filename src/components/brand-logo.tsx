import { cn } from "@/lib/utils";
import markAsset from "@/assets/cryptomagg-mark.png.asset.json";

type Props = {
  className?: string;
  size?: "sm" | "md" | "lg";
  withWordmark?: boolean;
};

const sizes = {
  sm: "size-8",
  md: "size-10",
  lg: "size-14",
} as const;

const textSizes = {
  sm: "text-lg",
  md: "text-xl",
  lg: "text-2xl",
} as const;

export function BrandLogo({ className, size = "sm", withWordmark = true }: Props) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <img
        src={markAsset.url}
        alt="CryptoMagg logo"
        width={512}
        height={512}
        className={cn(
          sizes[size],
          "shrink-0 rounded-full object-contain drop-shadow-[0_2px_10px_color-mix(in_oklab,var(--color-primary)_35%,transparent)]",
        )}
      />
      {withWordmark ? (
        <span
          className={cn(
            "font-display font-bold leading-none tracking-tight text-foreground",
            textSizes[size],
          )}
        >
          CryptoMagg
        </span>
      ) : null}
    </span>
  );
}
