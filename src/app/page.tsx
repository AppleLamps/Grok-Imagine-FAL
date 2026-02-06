"use client";

import { useState, useCallback } from "react";
import { fal } from "@/lib/fal";
import {
  AD_WORKFLOW,
  type ClipConfig,
  type VideoResult,
  type WorkflowResult,
} from "@/lib/workflow";
import { ClipForm } from "@/components/clip-form";
import { VideoResultsGrid } from "@/components/video-result";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Zap,
  Film,
  ArrowRight,
  AlertCircle,
  Loader2,
  Github,
} from "lucide-react";

const DEFAULT_CLIP: ClipConfig = {
  prompt: "",
  duration: 6,
  aspect_ratio: "16:9",
  resolution: "720p",
};

export default function Home() {
  const [clips, setClips] = useState<ClipConfig[]>([
    { ...DEFAULT_CLIP },
    { ...DEFAULT_CLIP },
    { ...DEFAULT_CLIP },
  ]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [videos, setVideos] = useState<(VideoResult | null)[]>([
    null,
    null,
    null,
  ]);
  const [clipStatuses, setClipStatuses] = useState<string[]>(["", "", ""]);
  const [error, setError] = useState<string | null>(null);

  const updateClip = useCallback((index: number, config: ClipConfig) => {
    setClips((prev) => prev.map((c, i) => (i === index ? config : c)));
  }, []);

  const canGenerate =
    clips.every((c) => c.prompt.trim().length > 0) && !isGenerating;

  const handleGenerate = useCallback(async () => {
    if (!canGenerate) return;

    setIsGenerating(true);
    setError(null);
    setVideos([null, null, null]);
    setClipStatuses(["Queued", "Queued", "Queued"]);

    try {
      const workflowInput = {
        prompt: clips[0].prompt,
        duration: clips[0].duration,
        aspect_ratio: clips[0].aspect_ratio,
        resolution: clips[0].resolution,
        prompt_2: clips[1].prompt,
        duration_2: clips[1].duration,
        aspect_ratio_2: clips[1].aspect_ratio,
        resolution_2: clips[1].resolution,
        prompt_3: clips[2].prompt,
        duration_3: clips[2].duration,
        aspect_ratio_3: clips[2].aspect_ratio,
        resolution_3: clips[2].resolution,
      };

      const stream = await fal.stream("workflows/execute", {
        input: {
          input: workflowInput,
          workflow: AD_WORKFLOW,
        },
      });

      // Process streaming events
      for await (const event of stream) {
        const data = event as Record<string, unknown>;

        // Update statuses based on partial results
        if (data.status === "IN_PROGRESS") {
          setClipStatuses((prev) =>
            prev.map((s) => (s === "Queued" ? "Processing" : s))
          );
        }

        // Check for partial video results
        if (data.video_1 && !videos[0]) {
          setVideos((prev) => [data.video_1 as VideoResult, prev[1], prev[2]]);
          setClipStatuses((prev) => ["Complete", prev[1], prev[2]]);
        }
        if (data.video_2 && !videos[1]) {
          setVideos((prev) => [prev[0], data.video_2 as VideoResult, prev[2]]);
          setClipStatuses((prev) => [prev[0], "Complete", prev[2]]);
        }
        if (data.video_3 && !videos[2]) {
          setVideos((prev) => [prev[0], prev[1], data.video_3 as VideoResult]);
          setClipStatuses((prev) => [prev[0], prev[1], "Complete"]);
        }
      }

      // Get final result
      const result = await stream.done();
      const output = (result as { data?: WorkflowResult })?.data ||
        (result as WorkflowResult);

      setVideos([
        output.video_1 || null,
        output.video_2 || null,
        output.video_3 || null,
      ]);
      setClipStatuses(["Complete", "Complete", "Complete"]);
    } catch (err) {
      console.error("Workflow error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "An error occurred while generating videos. Please try again."
      );
      setClipStatuses(["", "", ""]);
    } finally {
      setIsGenerating(false);
    }
  }, [canGenerate, clips]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.06] bg-black/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-7 w-7 rounded-md bg-white flex items-center justify-center">
              <Zap className="h-4 w-4 text-black" />
            </div>
            <span className="text-sm font-semibold tracking-tight">
              Grok Imagine
            </span>
            <span className="text-[10px] font-mono text-white/30 border border-white/10 rounded px-1.5 py-0.5">
              AD GEN
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[11px] font-mono text-white/30 hidden sm:block">
              Powered by FAL Workflows
            </span>
            <Separator orientation="vertical" className="h-4 bg-white/10" />
            <a
              href="https://fal.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-mono text-white/40 hover:text-white/70 transition-colors"
            >
              fal.ai
            </a>
          </div>
        </div>
      </nav>

      {/* Main */}
      <main className="flex-1 pt-14">
        {/* Hero */}
        <section className="relative py-20 md:py-28 overflow-hidden">
          {/* Subtle gradient */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] via-transparent to-transparent" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-white/[0.015] rounded-full blur-[120px]" />

          <div className="relative max-w-6xl mx-auto px-6">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/[0.08] bg-white/[0.03] mb-6">
                <Film className="h-3 w-3 text-white/50" />
                <span className="text-[11px] font-mono text-white/50">
                  xAI Grok Imagine Video · 3 Parallel Clips
                </span>
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tighter leading-[1.05] mb-4">
                Generate
                <br />
                <span className="text-white/40">ad videos.</span>
              </h1>

              <p className="text-base md:text-lg text-white/40 leading-relaxed max-w-md">
                Create 3 video clips simultaneously using Grok Imagine.
                Describe each scene, configure settings, and generate.
              </p>
            </div>
          </div>
        </section>

        {/* Generator */}
        <section className="pb-24">
          <div className="max-w-6xl mx-auto px-6">
            {/* Clip Forms */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6">
              {clips.map((clip, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 transition-colors hover:border-white/[0.1] hover:bg-white/[0.03]"
                >
                  <ClipForm
                    index={i}
                    config={clip}
                    onChange={(c) => updateClip(i, c)}
                    disabled={isGenerating}
                  />
                </div>
              ))}
            </div>

            {/* Error */}
            {error && (
              <div className="mt-6 flex items-start gap-3 p-4 rounded-lg border border-red-500/20 bg-red-500/[0.05]">
                <AlertCircle className="h-4 w-4 text-red-400/70 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm text-red-400/90">{error}</p>
                  <p className="text-xs text-red-400/50 font-mono">
                    Make sure your FAL_KEY is set in your environment variables.
                  </p>
                </div>
              </div>
            )}

            {/* Generate Button */}
            <div className="mt-8 flex items-center gap-4">
              <Button
                onClick={handleGenerate}
                disabled={!canGenerate}
                size="lg"
                className="h-12 px-8 bg-white text-black font-medium text-sm tracking-tight hover:bg-white/90 disabled:opacity-30 disabled:bg-white/10 disabled:text-white/30 transition-all duration-200 gap-2 rounded-lg"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    Generate 3 Clips
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>

              {!canGenerate && !isGenerating && (
                <span className="text-[11px] font-mono text-white/20">
                  All 3 prompts required
                </span>
              )}
            </div>

            {/* Results */}
            <div className="mt-16">
              <VideoResultsGrid
                videos={videos}
                isLoading={isGenerating}
                clipStatuses={clipStatuses}
              />
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] py-6">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono text-white/20">
              Grok Imagine Ad Generator
            </span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://docs.fal.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-mono text-white/20 hover:text-white/50 transition-colors"
            >
              Docs
            </a>
            <a
              href="https://fal.ai/models/xai/grok-imagine-video/text-to-video"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-mono text-white/20 hover:text-white/50 transition-colors"
            >
              Model
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
