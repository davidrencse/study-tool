import { Search } from "lucide-react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "./ui/command";
export default function WorkspaceSearch({
  open,
  onOpenChange,
  query,
  onQueryChange,
  hits,
  onChoose,
}) {
  return (
    <CommandDialog
      shouldFilter={false}
      open={open}
      onOpenChange={onOpenChange}
      title="Search workspace"
      description="Find notes, classes, tasks, and flashcards"
    >
      <CommandInput
        value={query}
        onValueChange={onQueryChange}
        placeholder="Search your workspace…"
      />
      <CommandList>
        <CommandEmpty>
          {query.length < 2
            ? "Type at least two characters."
            : "No results found."}
        </CommandEmpty>
        <CommandGroup heading="Results">
          {hits.map((hit, i) => (
            <CommandItem
              key={`${hit.href || hit.cardId}:${i}`}
              value={`${hit.label} ${i}`}
              onSelect={() => onChoose(hit)}
            >
              <Search size={15} />
              <span className="min-w-0">
                <span className="block truncate">{hit.label}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {hit.sub}
                </span>
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
