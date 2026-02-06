"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Play, RotateCcw } from "lucide-react";
import type { VideoResult } from "@/lib/workflow";

interface VideoResultCardProps {
  index: number;
  video: VideoResult | null;
  isLoading: boolean;
  status?: string;
}

export function VideoResultCard({
  index,
  video,
  isLoading,
  status,
}: VideoResultCardProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const showLoadingPlaceholder = isLoading && !video;

  return (
    <div className="group relative">
      {/* Label */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-[10px] font-mono text-white/50">
          {index + 1}
        </div>
        <span className="text-xs font-mono text-white/40 uppercase tracking-wider">
          Clip {index + 1}
        </span>
        {video && (
          <Badge
            variant="outline"
            className="ml-auto border-green-500/20 text-green-400/70 text-[10px] font-mono"
          >
            Ready
          </Badge>
        )}
        {isLoading && (
          <Badge
            variant="outline"
            className="ml-auto border-blue-500/20 text-blue-400/70 text-[10px] font-mono animate-pulse-slow"
          >
            {status || "Generating"}
          </Badge>
        )}
      </div>

      {/* Video Container */}
      <div
        className={`relative aspect-video rounded-lg overflow-hidden bg-white/[0.02] border border-white/[0.06] ${
          showLoadingPlaceholder ? "gold-shimmer" : ""
        }`}
      >
        {/* Loading State */}
        {showLoadingPlaceholder && (
          <div className="absolute inset-0">
            {/* Base sheen */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/[0.04] via-transparent to-black/40" />

            {/* Skeleton content */}
            <div className="absolute inset-0 p-4 flex flex-col justify-end gap-2">
              <div className="h-2.5 w-[72%] rounded bg-white/[0.10]" />
              <div className="h-2 w-[52%] rounded bg-white/[0.08]" />
              <div className="pt-1">
                <span className="text-[11px] font-mono text-amber-200/40">
                  {status || "Generating..."}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !video && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <div className="h-10 w-10 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
              <Play className="h-4 w-4 text-white/20" />
            </div>
            <span className="text-[11px] font-mono text-white/20">
              Awaiting generation
            </span>
          </div>
        )}

        {/* Video Player */}
        {video && (
          <>
            <video
              src={video.url}
              controls
              className="w-full h-full object-contain bg-black"
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
            />

            {/* Overlay controls */}
            {!isPlaying && (
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <div className="h-12 w-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
                  <Play className="h-5 w-5 text-white/80 ml-0.5" />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Actions */}
      {video && (
        <div className="flex items-center gap-2 mt-3">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[11px] font-mono text-white/40 hover:text-white/80 hover:bg-white/5 gap-1.5"
            asChild
          >
            <a href={video.url} download target="_blank" rel="noopener noreferrer">
              <Download className="h-3 w-3" />
              Download
            </a>
          </Button>
          {video.duration && (
            <span className="text-[10px] font-mono text-white/20 ml-auto tabular-nums">
              {video.duration.toFixed(1)}s
              {video.width && video.height && ` · ${video.width}×${video.height}`}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

interface VideoResultsGridProps {
  videos: (VideoResult | null)[];
  isLoading: boolean;
  clipStatuses: string[];
}

export function VideoResultsGrid({
  videos,
  isLoading,
  clipStatuses,
}: VideoResultsGridProps) {
  const hasAnyVideo = videos.some((v) => v !== null);

  if (!hasAnyVideo && !isLoading) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-medium tracking-wide text-white/60 uppercase">
          Generated Clips
        </h2>
        {isLoading && (
          <div className="flex items-center gap-2">
            <RotateCcw className="h-3 w-3 text-white/30 animate-spin" />
            <span className="text-[11px] font-mono text-white/30">
              Processing workflow...
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[0, 1, 2].map((i) => (
          <VideoResultCard
            key={i}
            index={i}
            video={videos[i] || null}
            isLoading={isLoading}
            status={clipStatuses[i]}
          />
        ))}
      </div>

      {hasAnyVideo && !isLoading && (
        <p className="text-[11px] font-mono text-white/20 text-center pt-2">
          Download your clips and combine them in your video editor to create
          the final ad.
        </p>
      )}
    </div>
  );
}
