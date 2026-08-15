import { SearchInput, type SearchInputSize } from "@/components/ui/search-input";

interface SearchFormProps {
  id?: string;
  size?: SearchInputSize;
  /** Accessible label for the box; visually hidden. */
  label?: string;
  placeholder?: string;
  /** Prefills the box, e.g. the current query on the results page. */
  defaultValue?: string;
  /** Keyboard hint on the right; pass null to hide it. */
  shortcut?: string | null;
  className?: string;
}

/**
 * The search entry point. A native GET form that navigates to `/search?q=...` on submit, so the box
 * works without client JavaScript. The results page reads `q` from there (AGENTS.md §5 — the browser
 * never calls the LLM or the MCP directly; it only lands on a server-rendered route).
 */
export function SearchForm({
  id = "search",
  size,
  label,
  placeholder,
  defaultValue,
  shortcut,
  className,
}: SearchFormProps) {
  return (
    <form action="/search" method="get" role="search" className={className}>
      <SearchInput
        id={id}
        name="q"
        size={size}
        label={label}
        placeholder={placeholder}
        defaultValue={defaultValue}
        shortcut={shortcut}
      />
    </form>
  );
}
