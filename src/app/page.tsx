"use client";

import { useState, useCallback } from "react";
import { fal } from "@/lib/fal";
import {
  T2V_WORKFLOW,
  I2V_WORKFLOW,
  type ClipConfig,
  type VideoResult,
  type WorkflowResult,
  type GenerationMode,
} from "@/lib/workflow";
import { ClipForm } from "@/components/clip-form";
import { MasterPrompt } from "@/components/master-prompt";
import { VideoResultsGrid } from "@/components/video-result";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Zap,
  Film,
  ArrowRight,
  AlertCircle,
  Loader2,
  Type,
  ImageIcon,
} from "lucide-react";

const DEFAULT_T2V_CLIP: ClipConfig = {
  prompt: "",
  duration: 6,
  aspect_ratio: "16:9",
  resolution: "720p",
};

const DEFAULT_I2V_CLIP: ClipConfig = {
  prompt: "",
  duration: 6,
  aspect_ratio: "auto",
  resolution: "720p",
};

export default function Home() {
  const [mode, setMode] = useState<GenerationMode>("text-to-video");
  const [clips, setClips] = useState<ClipConfig[]>([
    { ...DEFAULT_T2V_CLIP },
    { ...DEFAULT_T2V_CLIP },
    { ...DEFAULT_T2V_CLIP },
  ]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [videos, setVideos] = useState<(VideoResult | null)[]>([
    null,
    null,
    null,
  ]);
  const [clipStatuses, setClipStatuses] = useState<string[]>(["", "", ""]);
  const [error, setError] = useState<string | null>(null);

  const isI2V = mode === "image-to-video";

  const handleModeChange = useCallback(
    (newMode: GenerationMode) => {
      if (newMode === mode) return;
      setMode(newMode);
      const defaults =
        newMode === "image-to-video" ? DEFAULT_I2V_CLIP : DEFAULT_T2V_CLIP;
      setClips([{ ...defaults }, { ...defaults }, { ...defaults }]);
      setVideos([null, null, null]);
      setClipStatuses(["", "", ""]);
      setAiGeneratedPrompts(["", "", ""]);
      setError(null);
    },
    [mode]
  );

  const updateClip = useCallback((index: number, config: ClipConfig) => {
    setClips((prev) => prev.map((c, i) => (i === index ? config : c)));
  }, []);

  // Track AI-generated prompts to detect user edits
  const [aiGeneratedPrompts, setAiGeneratedPrompts] = useState<string[]>([
    "",
    "",
    "",
  ]);

  const handlePromptsGenerated = useCallback((prompts: string[]) => {
    setAiGeneratedPrompts(prompts);
    setClips((prev) =>
      prev.map((clip, i) => ({ ...clip, prompt: prompts[i] || clip.prompt }))
    );
  }, []);

  // Upload a single image file to FAL storage
  const uploadImageToFal = async (file: File): Promise<string> => {
    const url = await fal.storage.upload(file);
    return url;
  };

  // Check if we can generate
  const canGenerate = (() => {
    if (isGenerating) return false;
    if (!clips.every((c) => c.prompt.trim().length > 0)) return false;
    if (isI2V) {
      // All clips need an image
      if (!clips.every((c) => c.imageFile || c.imageUrl)) return false;
    }
    return true;
  })();

  // Warnings
  const hasAspectRatioMismatch =
    new Set(clips.map((c) => c.aspect_ratio)).size > 1;

  const totalDuration = clips.reduce((sum, c) => sum + c.duration, 0);
  const hasDurationImbalance = (() => {
    const durations = clips.map((c) => c.duration);
    return Math.max(...durations) > Math.min(...durations) * 3;
  })();

  const clipModified = clips.map(
    (clip, i) =>
      aiGeneratedPrompts[i] !== "" && clip.prompt !== aiGeneratedPrompts[i]
  );

  const handleGenerate = useCallback(async () => {
    if (!canGenerate) return;

    setIsGenerating(true);
    setError(null);
    setVideos([null, null, null]);
    setClipStatuses(["Queued", "Queued", "Queued"]);

    try {
      // For I2V mode, upload images to FAL first
      let imageUrls: (string | undefined)[] = [undefined, undefined, undefined];

      if (isI2V) {
        setIsUploading(true);
        setClipStatuses(["Uploading image", "Uploading image", "Uploading image"]);

        const uploadPromises = clips.map(async (clip, i) => {
          if (clip.imageUrl) {
            // Already uploaded
            return clip.imageUrl;
          }
          if (clip.imageFile) {
            const url = await uploadImageToFal(clip.imageFile);
            // Update the clip with the uploaded URL
            setClips((prev) =>
              prev.map((c, idx) =>
                idx === i ? { ...c, imageUrl: url } : c
              )
            );
            return url;
          }
          return undefined;
        });

        imageUrls = await Promise.all(uploadPromises);
        setIsUploading(false);

        // Verify all images uploaded
        if (imageUrls.some((url) => !url)) {
          throw new Error(
            "Failed to upload one or more images. Please try again."
          );
        }
      }

      setClipStatuses(["Processing", "Processing", "Processing"]);

      if (isI2V) {
        // Image-to-Video workflow
        const workflowInput = {
          prompt: clips[0].prompt,
          duration: clips[0].duration,
          aspect_ratio: clips[0].aspect_ratio,
          resolution: clips[0].resolution,
          image_url: imageUrls[0]!,
          prompt_2: clips[1].prompt,
          duration_2: clips[1].duration,
          aspect_ratio_2: clips[1].aspect_ratio,
          resolution_2: clips[1].resolution,
          image_url_2: imageUrls[1]!,
          prompt_3: clips[2].prompt,
          duration_3: clips[2].duration,
          aspect_ratio_3: clips[2].aspect_ratio,
          resolution_3: clips[2].resolution,
          image_url_3: imageUrls[2]!,
        };

        const stream = await fal.stream("workflows/execute", {
          input: {
            input: workflowInput,
            workflow: I2V_WORKFLOW,
          },
        });

        for await (const event of stream) {
          const data = event as Record<string, unknown>;
          if (data.video_1) {
            setVideos((prev) => [
              data.video_1 as VideoResult,
              prev[1],
              prev[2],
            ]);
            setClipStatuses((prev) => ["Complete", prev[1], prev[2]]);
          }
          if (data.video_2) {
            setVideos((prev) => [
              prev[0],
              data.video_2 as VideoResult,
              prev[2],
            ]);
            setClipStatuses((prev) => [prev[0], "Complete", prev[2]]);
          }
          if (data.video_3) {
            setVideos((prev) => [
              prev[0],
              prev[1],
              data.video_3 as VideoResult,
            ]);
            setClipStatuses((prev) => [prev[0], prev[1], "Complete"]);
          }
        }

        const result = await stream.done();
        const output =
          (result as { data?: WorkflowResult })?.data ||
          (result as WorkflowResult);

        setVideos([
          output.video_1 || null,
          output.video_2 || null,
          output.video_3 || null,
        ]);
        setClipStatuses(["Complete", "Complete", "Complete"]);
      } else {
        // Text-to-Video workflow
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
            workflow: T2V_WORKFLOW,
          },
        });

        for await (const event of stream) {
          const data = event as Record<string, unknown>;
          if (data.video_1) {
            setVideos((prev) => [
              data.video_1 as VideoResult,
              prev[1],
              prev[2],
            ]);
            setClipStatuses((prev) => ["Complete", prev[1], prev[2]]);
          }
          if (data.video_2) {
            setVideos((prev) => [
              prev[0],
              data.video_2 as VideoResult,
              prev[2],
            ]);
            setClipStatuses((prev) => [prev[0], "Complete", prev[2]]);
          }
          if (data.video_3) {
            setVideos((prev) => [
              prev[0],
              prev[1],
              data.video_3 as VideoResult,
            ]);
            setClipStatuses((prev) => [prev[0], prev[1], "Complete"]);
          }
        }

        const result = await stream.done();
        const output =
          (result as { data?: WorkflowResult })?.data ||
          (result as WorkflowResult);

        setVideos([
          output.video_1 || null,
          output.video_2 || null,
          output.video_3 || null,
        ]);
        setClipStatuses(["Complete", "Complete", "Complete"]);
      }
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
      setIsUploading(false);
    }
  }, [canGenerate, clips, isI2V]);

  // Gather clip image previews for the master prompt component
  const clipImagePreviews = clips.map((c) => c.imagePreview);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/70 bg-background/70 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-7 w-7 rounded-lg bg-[var(--brand)] flex items-center justify-center shadow-sm ring-1 ring-black/5">
              <Zap className="h-4 w-4 text-[var(--brand-foreground)]" />
            </div>
            <span className="text-sm font-semibold tracking-tight text-foreground">
              Grok Imagine
            </span>
            <span className="text-[10px] font-mono text-muted-foreground border border-border/70 rounded px-1.5 py-0.5 bg-card/40">
              AD GEN
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[11px] font-mono text-muted-foreground hidden sm:block">
              Powered by FAL Workflows
            </span>
            <Separator orientation="vertical" className="h-4" />
            <a
              href="https://fal.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors"
            >
              fal.ai
            </a>
          </div>
        </div>
      </nav>

      {/* Main */}
      <main className="flex-1 pt-14">
        {/* Compact Hero + Controls */}
        <section className="pb-16">
          <div className="max-w-6xl mx-auto px-6">
            {/* Hero row — tight, inline */}
            <div className="pt-10 pb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="hidden md:flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-card/60 border border-border/70 shadow-sm">
                  <Film className="h-5 w-5 text-foreground/80" />
                </div>
                <div>
                  <h1 className="font-display text-3xl md:text-[40px] font-semibold tracking-tight leading-[1.05] text-foreground">
                    Generate ad videos.
                  </h1>
                  <p className="text-[14px] md:text-[15px] text-muted-foreground mt-2 max-w-[60ch]">
                    Turn a concept into three parallel clips. Grok drafts the
                    shots, FAL runs the workflow, you download and edit.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-full border border-border/70 bg-card/50 px-2.5 py-1 text-[11px] font-mono text-muted-foreground">
                      3 shots
                    </span>
                    <span className="inline-flex items-center rounded-full border border-border/70 bg-card/50 px-2.5 py-1 text-[11px] font-mono text-muted-foreground">
                      parallel generation
                    </span>
                    <span className="inline-flex items-center rounded-full border border-border/70 bg-card/50 px-2.5 py-1 text-[11px] font-mono text-muted-foreground">
                      {isI2V ? "image-to-video" : "text-to-video"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Mode Toggle — right-aligned */}
              <div className="inline-flex items-center rounded-2xl border border-border/70 bg-card/60 p-1.5 shrink-0 shadow-sm">
                <button
                  type="button"
                  onClick={() => handleModeChange("text-to-video")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all duration-200 ${!isI2V
                      ? "bg-[var(--brand)] text-[var(--brand-foreground)] shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    }`}
                >
                  <Type className="h-3.5 w-3.5" />
                  Text to Video
                </button>
                <button
                  type="button"
                  onClick={() => handleModeChange("image-to-video")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all duration-200 ${isI2V
                      ? "bg-[var(--brand)] text-[var(--brand-foreground)] shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    }`}
                >
                  <ImageIcon className="h-3.5 w-3.5" />
                  Image to Video
                </button>
              </div>
            </div>

            <Separator className="opacity-70" />

            {/* Master Prompt */}
            <div className="mt-6 mb-6">
              <MasterPrompt
                onPromptsGenerated={handlePromptsGenerated}
                disabled={isGenerating}
                mode={mode}
                clipImages={clipImagePreviews}
              />
            </div>

            {/* Clip Forms */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {clips.map((clip, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-border/70 bg-card/60 p-5 shadow-sm transition-colors hover:bg-card/75"
                >
                  <ClipForm
                    index={i}
                    config={clip}
                    onChange={(c) => updateClip(i, c)}
                    disabled={isGenerating}
                    mode={mode}
                    isModified={clipModified[i]}
                  />
                </div>
              ))}
            </div>

            {/* Aspect ratio mismatch warning */}
            {hasAspectRatioMismatch && !isGenerating && (
              <div className="mt-6 flex items-start gap-3 p-4 rounded-2xl border border-border/70 bg-card/60 shadow-sm">
                <AlertCircle className="h-4 w-4 text-foreground/70 mt-0.5 shrink-0" />
                <p className="text-sm text-foreground/80">
                  Clips have different aspect ratios — the final ad may look
                  inconsistent when combined.
                </p>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mt-6 flex items-start gap-3 p-4 rounded-2xl border border-red-500/20 bg-red-500/[0.06]">
                <AlertCircle className="h-4 w-4 text-red-600/80 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm text-red-700/90">{error}</p>
                  <p className="text-xs text-red-700/60 font-mono">
                    Make sure your FAL_KEY and XAI_API_KEY are set in your
                    environment variables.
                  </p>
                </div>
              </div>
            )}

            {/* Generate Button */}
            <div className="mt-6 flex items-center gap-4">
              <Button
                onClick={handleGenerate}
                disabled={!canGenerate}
                size="lg"
                variant="brand"
                className="h-11 px-7 font-medium text-sm tracking-tight transition-all duration-200 gap-2 rounded-2xl shadow-sm disabled:opacity-40"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {isUploading ? "Uploading images..." : "Generating..."}
                  </>
                ) : (
                  <>
                    Generate 3 Clips
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>

              {!canGenerate && !isGenerating && (
                <span className="text-[11px] font-mono text-muted-foreground">
                  {isI2V
                    ? "All 3 prompts + images required"
                    : "All 3 prompts required"}
                </span>
              )}

              <div className="flex items-center gap-3 ml-auto">
                <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
                  Total: {totalDuration}s
                </span>
                {hasDurationImbalance && (
                  <span className="text-[11px] font-mono text-foreground/70">
                    Uneven clip lengths
                  </span>
                )}
              </div>
            </div>

            {/* Results */}
            <div className="mt-12">
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
      <footer className="border-t border-border/70 py-6 bg-background/40 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono text-muted-foreground">
              Grok Imagine Ad Generator
            </span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://docs.fal.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors"
            >
              Docs
            </a>
            <a
              href="https://fal.ai/models/xai/grok-imagine-video/text-to-video"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors"
            >
              Model
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
