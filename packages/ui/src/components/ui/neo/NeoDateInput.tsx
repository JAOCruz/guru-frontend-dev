import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { Input, type InputProps } from "../input";
import { cn } from "../../../lib/utils";

export interface NeoDateInputProps extends InputProps {
  iconClassName?: string;
}

// Opens the browser's calendar. Some contexts (e.g. cross-origin iframes) refuse it;
// the field still accepts typing then.
function openPicker(input: HTMLInputElement | null) {
  try {
    (input as HTMLInputElement & { showPicker?: () => void })?.showPicker?.();
  } catch {
    /* typing still works */
  }
}

const NeoDateInput = React.forwardRef<HTMLInputElement, NeoDateInputProps>(
  ({ className, iconClassName, onClick, ...props }, ref) => {
    const inner = React.useRef<HTMLInputElement | null>(null);
    const setRefs = (el: HTMLInputElement | null) => {
      inner.current = el;
      if (typeof ref === "function") ref(el);
      else if (ref) ref.current = el;
    };

    return (
      // min width: the date text and the icon always fit side by side
      <div className="relative w-full min-w-[9.5rem]">
        <Input
          ref={setRefs}
          type="date"
          onClick={(e) => {
            openPicker(e.currentTarget);
            onClick?.(e);
          }}
          className={cn(
            "h-12 w-full min-w-0 cursor-pointer pl-3 pr-10 text-base [color-scheme:light] dark:[color-scheme:dark]",
            // our own icon replaces the browser's (which sits in a different spot per browser)
            "[&::-webkit-calendar-picker-indicator]:hidden",
            className
          )}
          {...props}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label="Abrir calendario"
          onClick={() => openPicker(inner.current)}
          className="absolute top-1/2 right-2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-base text-foreground/60 hover:bg-black/5 hover:text-foreground"
        >
          <CalendarIcon className={cn("h-4 w-4", iconClassName)} />
        </button>
      </div>
    );
  }
);
NeoDateInput.displayName = "NeoDateInput";

export { NeoDateInput };
