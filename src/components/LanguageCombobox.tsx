import { useState } from "react";
import { Check, ChevronsUpDown, Languages } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { LANGUAGES } from "@/lib/languages";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
};

export function LanguageCombobox({
  value,
  onChange,
  className,
  placeholder = "Select your mother tongue",
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "flex w-full items-center justify-between gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3 text-left text-sm text-[var(--color-foreground)] shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]",
            className,
          )}
        >
          <span className="flex items-center gap-2 truncate">
            <Languages className="h-4 w-4 shrink-0 opacity-60" />
            <span className={cn("truncate", !value && "text-[var(--color-muted-foreground)]")}>
              {value || placeholder}
            </span>
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search languages..." />
          <CommandList>
            <CommandEmpty>No language found.</CommandEmpty>
            <CommandGroup>
              {LANGUAGES.map((lang) => (
                <CommandItem
                  key={lang}
                  value={lang}
                  onSelect={(current) => {
                    onChange(current === value ? "" : current);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value.toLowerCase() === lang.toLowerCase() ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {lang}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
