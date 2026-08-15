"use client";

import { useEffect, useState } from "react";
import { Play } from "lucide-react";
import Image from "next/image";
import posthog from "posthog-js";
import { ANALYTICS_EVENTS, type VideoPlaySource } from "@/lib/analytics/events";
import { useWatchDepth } from "@/components/lesson/use-watch-depth";
import { formatTimestamp } from "@/lib/format";
import { type ParsedVideo, videoEmbedUrl, videoProviderLabel } from "@/lib/video";

interface LessonVideoProps {
  lessonTitle: string;
  lessonSlug: string;
  courseSlug: string | null;
  /** The derived "5.1" label, carried onto the completion event. */
  lessonLabel: string | null;
  /** Parsed on the server; null when the stored URL is not an embeddable provider URL. */
  video: ParsedVideo | null;
  /** Pre-sized poster URL from the lesson thumbnail. */
  posterUrl: string | null;
  posterAlt: string;
  /** Second to open at, from `?t=` — already clamped to the lesson duration on the server. */
  startSeconds: number;
  /** The lesson's stored runtime, which watch depth is measured against. */
  durationSeconds: number | null;
}

/**
 * Playback stays on this page through the provider's own embed (AGENTS.md §7) — no custom player.
 * The poster renders first and the iframe only mounts once the learner presses play (or the URL
 * carries a start second), so no third-party frame loads unasked.
 */
export function LessonVideo({
  lessonTitle,
  lessonSlug,
  courseSlug,
  lessonLabel,
  video,
  posterUrl,
  posterAlt,
  startSeconds,
  durationSeconds,
}: LessonVideoProps) {
  const deepLinked = Boolean(video) && startSeconds > 0;
  const [isPlaying, setIsPlaying] = useState(deepLinked);

  const capturePlay = (source: VideoPlaySource) => {
    posthog.capture(ANALYTICS_EVENTS.videoPlayed, {
      lesson_slug: lessonSlug,
      course_slug: courseSlug,
      provider: video?.provider ?? null,
      start_seconds: startSeconds,
      duration_seconds: durationSeconds,
      source,
    });
  };

  // A deep-linked video starts without anyone pressing anything, so there is no handler to hang the
  // capture on — the mount is the play.
  useEffect(() => {
    if (!deepLinked) return;
    capturePlay("deep_link");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires once per deep-linked lesson.
  }, [deepLinked, lessonSlug]);

  useWatchDepth({
    isPlaying,
    lessonSlug,
    courseSlug,
    lessonLabel,
    provider: video?.provider ?? null,
    durationSeconds,
    startSeconds,
  });

  const play = () => {
    setIsPlaying(true);
    capturePlay("poster_click");
  };

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-md bg-neutral-900">
      {isPlaying && video ? (
        <iframe
          src={videoEmbedUrl(video, { startSeconds, autoplay: true })}
          title={`${lessonTitle} — ${videoProviderLabel(video.provider)} video`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
          loading="lazy"
          allowFullScreen
          className="absolute inset-0 size-full border-0"
        />
      ) : (
        <>
          {posterUrl && (
            <Image
              src={posterUrl}
              alt={posterAlt}
              fill
              sizes="(max-width: 1024px) 100vw, 610px"
              priority
              className="object-cover opacity-80"
            />
          )}

          {video ? (
            <button
              type="button"
              onClick={play}
              className="absolute inset-0 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-inset"
            >
              <span className="flex size-16 items-center justify-center rounded-full bg-primary-500 text-white shadow-lg transition-transform hover:scale-105">
                <Play className="size-7 translate-x-0.5 fill-current" strokeWidth={2} aria-hidden />
              </span>
              <span className="sr-only">
                Play {lessonTitle}
                {startSeconds > 0 ? ` from ${formatTimestamp(startSeconds)}` : ""}
              </span>
            </button>
          ) : (
            <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-[15px] leading-6 text-white/80">
              This lesson&apos;s video is unavailable.
            </p>
          )}
        </>
      )}
    </div>
  );
}
