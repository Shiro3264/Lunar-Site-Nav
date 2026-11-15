import * as React from "react";

import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        "flex h-9 w-full rounded-md border border-lunanav-line bg-lunanav-navy/60 px-3 py-1 text-sm text-lunanav-white shadow-sm transition-colors placeholder:text-lunanav-muted/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-lunanav-gold disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export { Input };
