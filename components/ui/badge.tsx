import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:     "border-transparent bg-primary text-primary-foreground",
        secondary:   "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
        outline:     "text-foreground",
        vencido:     "border-red-200    bg-red-50    text-red-700",
        hoje:        "border-orange-200 bg-orange-50 text-orange-700",
        amanha:      "border-amber-200  bg-amber-50  text-amber-700",
        "3dias":     "border-yellow-200 bg-yellow-50 text-yellow-700",
        ok:          "border-green-200  bg-green-50  text-green-700",
        processado:    "border-green-200  bg-green-50  text-green-700",
        sem_arquivo:   "border-slate-200  bg-slate-100 text-slate-500",
        erro:          "border-red-200    bg-red-50    text-red-600",
        arquivo_vazio: "border-amber-300  bg-amber-50  text-amber-700",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
