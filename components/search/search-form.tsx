"use client";

import { useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { SearchInput, type SearchInputSize } from "@/components/ui/search-input";
import { searchHref } from "@/lib/routes";
import { MAX_QUERY_LENGTH } from "@/lib/search/types";

interface SearchFormProps {
  id?: string;
  /** Pre-fills the field, so the results page shows the query it is displaying. */
  defaultValue?: string;
  placeholder?: string;
  label?: string;
  size?: SearchInputSize;
  className?: string;
}

/**
 * The one way into `/search`. Submitting navigates rather than fetching: the URL owns the query, so
 * a search is shareable and the back button works (AGENTS.md §11 — a results page, not a widget).
 */
export function SearchForm({
  id = "search",
  defaultValue,
  placeholder = "Search anything...",
  label = "Search",
  size = "md",
  className,
}: SearchFormProps) {
  const router = useRouter();

  // ⌘ K is drawn on the field, so it has to do something.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "k" || !(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      document.getElementById(id)?.focus();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [id]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const field = new FormData(event.currentTarget).get("q");
    const query = typeof field === "string" ? field.trim() : "";
    if (!query) return;

    router.push(searchHref(query));
  }

  return (
    <form onSubmit={onSubmit} role="search" className={className}>
      <SearchInput
        id={id}
        name="q"
        label={label}
        placeholder={placeholder}
        size={size}
        defaultValue={defaultValue}
        maxLength={MAX_QUERY_LENGTH}
      />
    </form>
  );
}
