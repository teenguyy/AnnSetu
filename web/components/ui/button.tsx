import { cva, type VariantProps } from "class-variance-authority";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  [
    "group/btn relative inline-flex select-none items-center justify-center gap-2 rounded-full font-label font-semibold",
    "transition-[background-color,color,box-shadow,transform] duration-200 ease-out",
    "focus-visible:outline-3 focus-visible:outline-offset-3 active:translate-y-px active:scale-[.985]",
    "disabled:pointer-events-none disabled:opacity-50",
  ],
  {
    variants: {
      variant: {
        // Sunshine fill, ink text; ring keeps it distinct on dark surfaces
        primary:
          "bg-sunshine text-ink shadow-[0_0_0_2px_var(--ink),0_8px_24px_-8px_rgba(255,226,138,.55)] hover:bg-[#ffe9a6] hover:shadow-[0_0_0_2px_var(--ink),0_0_0_6px_rgba(255,226,138,.28),0_10px_30px_-8px_rgba(255,226,138,.7)]",
        // Solid ink/ocean with cream text, for light surfaces
        solid: "bg-ink text-cream hover:bg-deep-ocean dark:bg-ocean dark:hover:bg-deep-ocean",
        // Full-opacity 2px cream outline, for dark surfaces
        outline:
          "bg-ink/40 text-cream shadow-[inset_0_0_0_2px_var(--cream)] backdrop-blur-sm hover:bg-cream hover:text-ink",
        // Quiet action on app surfaces
        ghost: "text-text hover:bg-surface-2",
        danger: "bg-danger text-white hover:brightness-110",
      },
      size: {
        sm: "min-h-10 px-4 text-sm",
        md: "min-h-12 px-6 text-[15px]",
        lg: "min-h-[52px] px-7 text-base",
        xl: "min-h-[58px] px-8 text-[17px]",
      },
    },
    defaultVariants: { variant: "primary", size: "lg" },
  },
);

type Variants = VariantProps<typeof buttonVariants>;

function Arrow() {
  return (
    <span aria-hidden className="transition-transform duration-200 group-hover/btn:translate-x-1">
      →
    </span>
  );
}

export function Button({
  className,
  variant,
  size,
  arrow,
  children,
  ...props
}: ComponentProps<"button"> & Variants & { arrow?: boolean }) {
  return (
    <button className={cn(buttonVariants({ variant, size }), className)} {...props}>
      {children}
      {arrow && <Arrow />}
    </button>
  );
}

export function ButtonLink({
  className,
  variant,
  size,
  arrow,
  children,
  icon,
  ...props
}: ComponentProps<typeof Link> & Variants & { arrow?: boolean; icon?: ReactNode }) {
  return (
    <Link className={cn(buttonVariants({ variant, size }), className)} {...props}>
      {children}
      {icon}
      {arrow && <Arrow />}
    </Link>
  );
}
