"use client";

import { Check, ListFilter, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useTableNav } from "./table-nav";

/** Single-select facet bound to one URL parameter. */
export function FacetedFilter({ paramKey, title, options }: { paramKey: string; title: string; options: { value: string; label: string }[] }) {
  const { state, navigate } = useTableNav();
  const selected = state.filters[paramKey];
  const selectedLabel = options.find((o) => o.value === selected)?.label;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 border-dashed">
          <ListFilter />
          {title}
          {selectedLabel && (
            <>
              <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-4" />
              <Badge variant="secondary" className="max-w-40 truncate rounded-sm px-1.5 font-normal">{selectedLabel}</Badge>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          {options.length > 6 && <CommandInput placeholder={title} />}
          <CommandList>
            <CommandEmpty>No matches.</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem key={o.value} value={o.label} onSelect={() => navigate({ filters: { [paramKey]: o.value === selected ? undefined : o.value } })}>
                  <Check className={cn("size-4", o.value === selected ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{o.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            {selected && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem onSelect={() => navigate({ filters: { [paramKey]: undefined } })} className="justify-center">
                    <X className="size-4" /> Clear filter
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
