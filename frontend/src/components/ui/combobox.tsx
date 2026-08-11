/**
 * Combobox
 *
 * A searchable <Select> replacement. Built on top of the existing
 * Popover primitive — no extra deps (we don't ship `cmdk`).
 *
 * Why not use the platform <Select>:
 *   - <Select> in this app renders every option inline (no filter).
 *     For ~50 centre shortnames that's already painful; for the
 *     teacher / class pickers it's unusable.
 *   - This keeps the design tokens (border-brand-60/10, h-8, font
 *     sizes) consistent with the rest of the toolbar.
 *
 * Usage:
 *   <Combobox
 *     options={centres.map(c => ({ value: c.id, label: c.label, hint: `${c.count}` }))}
 *     value={value.centre ?? "ALL"}
 *     onChange={(v) => onChange({ ...value, centre: v === "ALL" ? undefined : v })}
 *     placeholder="Tất cả trung tâm"
 *     disabled={loading}
 *   />
 */
import * as React from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface ComboboxOption {
  value: string;
  label: string;
  /** Optional secondary line (e.g. record count) shown muted next to label. */
  hint?: string;
  /** Optional searchable tokens; falls back to label. */
  keywords?: string[];
}

interface ComboboxProps {
  options: ComboboxOption[];
  value: string | undefined;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Label rendered above the trigger like the <Select>s in the toolbar. */
  label?: string;
  /** Render the row "Tất cả" as a sentinel with this value. */
  allValue?: string;
  allLabel?: string;
  /** Optional className for the root (label+trigger) column. */
  className?: string;
  /** Disable the trigger + dropdown. */
  disabled?: boolean;
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder,
  label,
  allValue = "ALL",
  allLabel = "Tất cả",
  className,
  disabled,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const comboboxId = React.useId();

  // Build the searchable list, including the "ALL" sentinel at the top.
  const allOptions: ComboboxOption[] = React.useMemo(
    () => [{ value: allValue, label: allLabel }, ...options],
    [options, allValue, allLabel],
  );

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allOptions;
    return allOptions.filter((o) => {
      const haystack = [
        o.label,
        o.hint ?? "",
        ...(o.keywords ?? []),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [allOptions, query]);

  const selected =
    allOptions.find((o) => o.value === value) ?? allOptions[0];

  function handleOpenChange(next: boolean) {
    if (next) {
      // Reset the search box every time the popover opens so the user
      // always sees the full list first, then can type to narrow.
      setQuery("");
      // Focus the search input shortly after open so the cursor lands
      // there without us fighting Popover's own focus management.
      setTimeout(() => inputRef.current?.focus(), 10);
    }
    setOpen(next);
  }

  function handleSelect(v: string) {
    onChange(v);
    setOpen(false);
    setQuery("");
  }

  const showClear =
    value !== undefined && value !== allValue && !disabled;

  return (
    <div className={cn("space-y-1.5 min-w-[180px]", className)}>
      {label && (
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
          {label}
        </span>
      )}
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <button
            type="button"
            role="combobox"
            aria-expanded={open}
            aria-controls={comboboxId}
            aria-label={label ?? placeholder}
            disabled={disabled}
            className={cn(
              "flex h-8 w-full items-center justify-between rounded-md border border-border bg-card px-2.5 text-xs font-medium text-foreground",
              "hover:border-brand-10/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-10/30 focus-visible:border-brand-10/40",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "transition-colors",
            )}
          >
            <span className="truncate flex items-center gap-1.5">
              {selected.value === allValue ? (
                <span className="text-muted-foreground">{selected.label}</span>
              ) : (
                <>
                  <span className="font-mono font-semibold">{selected.label}</span>
                  {selected.hint && (
                    <span className="text-muted-foreground">· {selected.hint}</span>
                  )}
                </>
              )}
            </span>
            <span className="flex items-center gap-1">
              {showClear && (
                <span
                  role="button"
                  aria-label="Xóa lựa chọn"
                  tabIndex={-1}
                  className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelect(allValue);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSelect(allValue);
                    }
                  }}
                >
                  <X className="h-3 w-3" />
                </span>
              )}
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 text-muted-foreground transition-transform",
                  open && "rotate-180",
                )}
              />
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          id={comboboxId}
          align="start"
          sideOffset={6}
          className="p-0"
          style={{ width: "var(--radix-popover-trigger-width)" }}
        >
          <div className="flex items-center gap-2 border-b border-border px-2.5 py-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && filtered.length > 0) {
                  handleSelect(filtered[0].value);
                } else if (e.key === "Escape") {
                  setOpen(false);
                }
              }}
              placeholder="Tìm kiếm..."
              className="h-7 border-0 bg-transparent px-0 text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>
          <div
            className="max-h-[260px] overflow-y-auto py-1 text-xs"
            role="listbox"
          >
            {filtered.length === 0 ? (
              <div className="px-3 py-6 text-center text-muted-foreground">
                Không có kết quả.
              </div>
            ) : (
              filtered.map((o) => {
                const isSelected = o.value === value;
                const isAll = o.value === allValue;
                return (
                  <button
                    key={o.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(o.value)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left hover:bg-brand-10-soft/60 transition-colors",
                      isSelected && "bg-brand-10-soft/40",
                    )}
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      {isAll ? (
                        <span className="text-muted-foreground font-medium">
                          {o.label}
                        </span>
                      ) : (
                        <>
                          <span className="font-mono font-semibold">
                            {o.label}
                          </span>
                          {o.hint && (
                            <span className="text-muted-foreground truncate">
                              · {o.hint}
                            </span>
                          )}
                        </>
                      )}
                    </span>
                    {isSelected && (
                      <Check className="h-3.5 w-3.5 shrink-0 text-brand-10" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default Combobox;
