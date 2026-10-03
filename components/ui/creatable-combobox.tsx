"use client";

import * as React from "react";
import { Combobox } from "@base-ui/react/combobox";
import { CheckIcon, ChevronDownIcon, PlusIcon, XIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type ComboboxOption = { id: string; name: string };

/** Nada elegido, una opción existente, o un nombre nuevo por crear. */
export type ComboboxValue =
  | { kind: "none" }
  | { kind: "existing"; id: string; name: string }
  | { kind: "new"; name: string };

export const NO_SELECTION: ComboboxValue = { kind: "none" };

/** Item interno: los existentes llevan `id`; el de crear lleva `create`. */
type Item = { id: string; name: string; create?: string };

const MAX_NAME_LENGTH = 40;

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}

type CreatableComboboxProps = {
  id?: string;
  options: ComboboxOption[];
  value: ComboboxValue;
  onValueChange: (value: ComboboxValue) => void;
  placeholder?: string;
  /** Texto del item de creación. Por defecto `Crear “Mascotas”`. */
  createLabel?: (name: string) => string;
  emptyMessage?: string;
  disabled?: boolean;
};

export function CreatableCombobox({
  id,
  options,
  value,
  onValueChange,
  placeholder,
  createLabel = (name) => `Crear “${name}”`,
  emptyMessage = "Sin resultados",
  disabled,
}: CreatableComboboxProps) {
  const [query, setQuery] = React.useState("");

  const selected: Item | null = React.useMemo(() => {
    if (value.kind === "existing") return { id: value.id, name: value.name };
    if (value.kind === "new") return { id: `create:${normalize(value.name)}`, name: value.name };
    return null;
  }, [value]);

  const items: Item[] = React.useMemo(() => {
    const trimmed = query.trim().slice(0, MAX_NAME_LENGTH);
    const existing = options.map((o) => ({ id: o.id, name: o.name }));
    if (!trimmed) return existing;

    const lowered = normalize(trimmed);
    if (existing.some((o) => normalize(o.name) === lowered)) return existing;

    // El nombre del item incluye el texto escrito, así el filtro interno del
    // Combobox no lo descarta mientras el usuario sigue tecleando.
    return [...existing, { id: `create:${lowered}`, name: trimmed, create: trimmed }];
  }, [options, query]);

  return (
    <Combobox.Root
      items={items}
      value={selected}
      itemToStringLabel={(item: Item) => item.name}
      // `query` solo espeja lo escrito para armar el item de "crear": el input lo
      // controla Base UI, que también lo resetea al cerrar o al elegir.
      onInputValueChange={setQuery}
      disabled={disabled}
      onValueChange={(next: Item | null) => {
        if (!next) {
          onValueChange(NO_SELECTION);
        } else if (next.create) {
          onValueChange({ kind: "new", name: next.create });
        } else {
          onValueChange({ kind: "existing", id: next.id, name: next.name });
        }
      }}
    >
      <Combobox.InputGroup className="relative">
        <Combobox.Input
          id={id}
          placeholder={placeholder}
          maxLength={MAX_NAME_LENGTH}
          className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent py-1 pr-14 pl-2.5 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80"
        />
        <div className="absolute inset-y-0 right-0 flex items-center text-muted-foreground">
          <Combobox.Clear
            className="flex size-7 items-center justify-center rounded-md outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            aria-label="Limpiar selección"
          >
            <XIcon className="size-4" />
          </Combobox.Clear>
          <Combobox.Trigger
            className="flex size-7 items-center justify-center rounded-md outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            aria-label="Ver opciones"
          >
            <ChevronDownIcon className="size-4" />
          </Combobox.Trigger>
        </div>
      </Combobox.InputGroup>

      <Combobox.Portal>
        <Combobox.Positioner className="z-50 outline-none" sideOffset={4}>
          <Combobox.Popup className="max-h-[min(var(--available-height),16rem)] w-[max(var(--anchor-width),15rem)] max-w-[var(--available-width)] origin-[var(--transform-origin)] overflow-y-auto overscroll-contain rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md transition-[scale,opacity] data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
            <Combobox.Empty className="px-2 py-1.5 text-sm text-muted-foreground empty:hidden">
              {emptyMessage}
            </Combobox.Empty>
            <Combobox.List>
              {(item: Item) => (
                <Combobox.Item
                  key={item.id}
                  value={item}
                  className={cn(
                    "grid cursor-default grid-cols-[1rem_1fr] items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none select-none",
                    "data-highlighted:bg-accent data-highlighted:text-accent-foreground",
                  )}
                >
                  <span className="col-start-1 flex items-center justify-center">
                    {item.create ? (
                      <PlusIcon className="size-4 text-primary" />
                    ) : (
                      <Combobox.ItemIndicator>
                        <CheckIcon className="size-4" />
                      </Combobox.ItemIndicator>
                    )}
                  </span>
                  <span className="col-start-2 break-words">
                    {item.create ? createLabel(item.create) : item.name}
                  </span>
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
