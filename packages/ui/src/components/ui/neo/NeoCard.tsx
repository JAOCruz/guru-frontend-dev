import * as React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "../card";
import { cn } from "../../../lib/utils";

export interface NeoCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "main" | "neutral" | "outline";
}

const NeoCard = React.forwardRef<HTMLDivElement, NeoCardProps>(
  ({ className, variant = "default", ...props }, ref) => {
    return (
      <Card
        ref={ref}
        className={cn(
          "gap-5 p-6",
          {
            "bg-background text-foreground": variant === "default",
          },
          {
            "bg-main text-main-foreground": variant === "main",
          },
          {
            "bg-secondary-background text-foreground": variant === "neutral",
          },
          {
            "bg-transparent text-foreground shadow-none": variant === "outline",
          },
          className
        )}
        {...props}
      />
    );
  }
);
NeoCard.displayName = "NeoCard";

const NeoCardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <CardHeader ref={ref} className={cn("flex flex-col gap-2 p-0", className)} {...props} />
));
NeoCardHeader.displayName = "NeoCardHeader";

const NeoCardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <CardTitle
    ref={ref}
    className={cn("font-heading leading-tight text-xl sm:text-2xl md:text-3xl", className)}
    {...props}
  />
));
NeoCardTitle.displayName = "NeoCardTitle";

const NeoCardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <CardDescription
    ref={ref}
    className={cn("text-base font-base text-foreground/70", className)}
    {...props}
  />
));
NeoCardDescription.displayName = "NeoCardDescription";

const NeoCardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <CardContent ref={ref} className={cn("p-0", className)} {...props} />
));
NeoCardContent.displayName = "NeoCardContent";

const NeoCardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <CardFooter
    ref={ref}
    className={cn("flex items-center gap-3 p-0 pt-2", className)}
    {...props}
  />
));
NeoCardFooter.displayName = "NeoCardFooter";

export {
  NeoCard,
  NeoCardHeader,
  NeoCardTitle,
  NeoCardDescription,
  NeoCardContent,
  NeoCardFooter,
};
