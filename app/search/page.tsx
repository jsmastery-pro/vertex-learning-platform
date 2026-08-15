import type { Metadata } from "next";
import Link from "next/link";
import { ChartDecoration } from "@/components/home/chart-decoration";
import { PageFrame } from "@/components/layout/page-frame";
import { SiteHeader } from "@/components/layout/site-header";
import { Breadcrumbs } from "@/components/nav/breadcrumbs";
import { SearchForm } from "@/components/search/search-form";
import { SearchResults } from "@/components/search/search-results";
import { coursesHref } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Search",
  description: "Search every lesson on Vertex in plain English.",
};

function firstValue(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = firstValue(params.q).trim();

  return (
    <PageFrame>
      <SiteHeader />

      <main className="flex flex-1 flex-col px-6 pt-11 pb-16 sm:px-12 xl:px-18 xl:pb-20">
        <Breadcrumbs items={[{ label: "Search" }]} />

        <h1 className="mt-10 font-display text-[38px] leading-11 font-bold text-neutral-900">
          Search
        </h1>

        <SearchForm
          id="search-page"
          label="Search your learning"
          placeholder="Ask anything about your learning..."
          defaultValue={query}
          shortcut={null}
          className="mt-8 w-full max-w-225"
        />

        {query ? (
          <SearchResults query={query} />
        ) : (
          <p className="mt-10 text-[17px] leading-7 text-neutral-500">
            Type a question above to search every lesson, or{" "}
            <Link
              href={coursesHref}
              className="rounded-xs text-primary-500 transition-colors hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
            >
              browse the full catalog
            </Link>
            .
          </p>
        )}
      </main>

      <ChartDecoration />
    </PageFrame>
  );
}
