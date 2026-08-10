import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { CURRENCIES, DEFAULT_CURRENCY, currencyLabel } from "@/lib/currencies";

/**
 * Searchable ISO 4217 currency picker. Stores the code; renders a hidden input
 * so it works inside the plain FormData-based settings/onboarding forms.
 */
export function CurrencySelect({
  name = "currency",
  value,
  onChange,
  id,
}: {
  name?: string;
  value?: string;
  onChange?: (code: string) => void;
  id?: string;
}) {
  const [internal, setInternal] = useState((value || DEFAULT_CURRENCY).toUpperCase());
  const code = (value ?? internal).toUpperCase();
  const [open, setOpen] = useState(false);

  function select(next: string) {
    setInternal(next);
    onChange?.(next);
    setOpen(false);
  }

  return (
    <>
      <input type="hidden" name={name} value={code} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            <span className="truncate">{currencyLabel(code)}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search currency…" />
            <CommandList>
              <CommandEmpty>No currency found.</CommandEmpty>
              <CommandGroup>
                {CURRENCIES.map((c) => (
                  <CommandItem
                    key={c.code}
                    value={`${c.code} ${c.name} ${c.symbol}`}
                    onSelect={() => select(c.code)}
                  >
                    <Check className={cn("mr-2 h-4 w-4", code === c.code ? "opacity-100" : "opacity-0")} />
                    {c.code} — {c.name} ({c.symbol})
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </>
  );
}
