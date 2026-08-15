import { ArrowRight, Search } from "lucide-react";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { coursesHref } from "@/lib/routes";

/**
 * The "can't find it?" strip. It closes the result list and doubles as the zero-result state, which
 * §11 requires to point at the full catalog.
 */
export function SearchEmptyState() {
  return (
    <div className="flex flex-col items-start justify-between gap-5 rounded-lg border border-primary-200 bg-primary-100 p-5 sm:flex-row sm:items-center sm:gap-8 sm:p-6">
      <div className="flex min-w-0 items-center gap-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-200">
          <Search className="size-5 text-primary-500" strokeWidth={2} aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-body-lg font-semibold text-neutral-900">
            Can&rsquo;t find what you&rsquo;re looking for?
          </p>
          <p className="mt-1 text-body text-neutral-500">
            Try different keywords or browse our full course catalog.
          </p>
        </div>
      </div>

      <Link
        href={coursesHref}
        className={buttonClasses({
          variant: "tertiary",
          size: "lg",
          className: "w-full shrink-0 text-primary-500 sm:w-auto",
        })}
      >
        Browse all courses
        <ArrowRight className="size-4.5" strokeWidth={2} aria-hidden />
      </Link>
    </div>
  );
}
