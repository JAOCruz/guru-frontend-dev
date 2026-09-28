import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { Input, type InputProps } from "../input";
import { cn } from "../../../lib/utils";

export interface NeoDateInputProps extends InputProps {
  iconClassName?: string;
}

const NeoDateInput = React.forwardRef<HTMLInputElement, NeoDateInputProps>(
  ({ className, iconClassName, ...props }, ref) => {
    return (
      <div className="relative w-full min-w-[9.5rem]">
        <Input
          ref={ref}
          type="date"
          className={cn(
            "h-12 w-full min-w-0 pl-3 pr-9 text-base [color-scheme:light] dark:[color-scheme:dark]",
            "[&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0",
            "[&::-webkit-calendar-picker-indicator]:z-10 [&::-webkit-calendar-picker-indicator]:cursor-pointer",
            "[&::-webkit-calendar-picker-indicator]:bg-transparent [&::-webkit-calendar-picker-indicator]:text-transparent",
            className
          )}
          {...props}
        />
        <CalendarIcon
          className={cn(
            "pointer-events-none absolute top-1/2 right-3 z-0 h-4 w-4 -translate-y-1/2 text-foreground/60",
            iconClassName
          )}
        />
      </div>
    );
  }
);
NeoDateInput.displayName = "NeoDateInput";

export { NeoDateInput };
