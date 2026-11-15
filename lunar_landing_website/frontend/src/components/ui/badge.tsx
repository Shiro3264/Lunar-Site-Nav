import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "border-lunanav-gold/40 bg-lunanav-gold/10 text-lunanav-gold",
        outline: "border-lunanav-line text-lunanav-silver",
        muted: "border-lunanav-line bg-white/5 text-lunanav-muted",
        success: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
        warn: "border-amber-500/40 bg-amber-500/10 text-amber-300",
        danger: "border-red-500/40 bg-red-500/10 text-red-300",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
