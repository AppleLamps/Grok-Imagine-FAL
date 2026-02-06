"use client";

import { useState, useCallback, useRef } from "react";
import type {
  PipelineEvent,
  PipelineInput,
  VideoResult,
  GenerationMethod,
  AspectRatio,
  Resolution,
} from "@/lib/pipeline";
import { ASPECT_RATIOS, RESOLUTIONS } from "@/lib/pipeline";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  AlertCircle,
  Loader2,
  Download,
  Play,
  Brain,
  ImageIcon,
  Video,
  Pencil,
  Check,
  CircleStop,
} from "lucide-react";

// ─── Scene State ─────────────────────────────────────────────────────────────

interface SceneState {
  status: "idle" | "planning" | "generating" | "polling" | "complete" | "error";
  method?: GenerationMethod;
  reasoning?: string;
  videoPrompt?: string;
  imagePrompt?: string;
  imageUrl?: string;
  video?: VideoResult;
  message?: string;
}

const EMPTY_SCENE: SceneState = { status: "idle" };

const METHOD_LABELS: Record<GenerationMethod, string> = {
  "text-to-video": "Text → Video",
  "image-then-video": "Image → Video",
  "edit-video": "Edit Video",
};

const METHOD_ICONS: Record<GenerationMethod, typeof Video> = {
  "text-to-video": Video,
  "image-then-video": ImageIcon,
  "edit-video": Pencil,
};

const SCENE_LABELS = ["Hook", "Body", "Closer"] as const;

// ─── xAI Logo Mark ──────────────────────────────────────────────────────────

function XaiMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      className={className}
    >
      <path d="M4 4L20 20" />
      <path d="M20 4L4 20" />
    </svg>
  );
}

// ─── Page Component ──────────────────────────────────────────────────────────

export default function Home() {
  const [concept, setConcept] = useState("");
  const [duration, setDuration] = useState(6);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("16:9");
  const [resolution, setResolution] = useState<Resolution>("720p");
  const [showSettings, setShowSettings] = useState(false);

  const [isRunning, setIsRunning] = useState(false);
  const [scenes, setScenes] = useState<SceneState[]>([
    { ...EMPTY_SCENE },
    { ...EMPTY_SCENE },
    { ...EMPTY_SCENE },
  ]);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const hasAnyResult = scenes.some((s) => s.video);
  const hasStarted = isRunning || hasAnyResult;

  const handleRun = useCallback(async () => {
    if (!concept.trim() || isRunning) return;

    setIsRunning(true);
    setError(null);
    setScenes([{ ...EMPTY_SCENE }, { ...EMPTY_SCENE }, { ...EMPTY_SCENE }]);

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const payload: PipelineInput = {
        concept: concept.trim(),
        duration,
        aspect_ratio: aspectRatio,
        resolution,
      };

      const res = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: abort.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Server error ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (!json) continue;

          let event: PipelineEvent;
          try {
            event = JSON.parse(json);
          } catch {
            continue;
          }

          handlePipelineEvent(event);
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      console.error("Pipeline error:", err);
      setError(err instanceof Error ? err.message : "Pipeline failed");
    } finally {
      setIsRunning(false);
      abortRef.current = null;
    }
  }, [concept, duration, aspectRatio, resolution, isRunning]);

  const handlePipelineEvent = useCallback((event: PipelineEvent) => {
    const idx = event.scene - 1;
    if (idx < 0 || idx > 2) {
      if (event.type === "error") setError(event.message);
      return;
    }

    setScenes((prev) => {
      const next = [...prev];
      const current = { ...next[idx] };

      switch (event.type) {
        case "scene_planning":
          current.status = "planning";
          current.message = event.message;
          break;

        case "scene_planned":
          current.status = "generating";
          current.method = event.data?.method;
          current.reasoning = event.data?.reasoning;
          current.videoPrompt = event.data?.video_prompt;
          current.imagePrompt = event.data?.image_prompt;
          current.message = event.message;
          break;

        case "image_generating":
          current.message = event.message;
          break;

        case "image_complete":
          current.imageUrl = event.data?.image_url;
          current.message = event.message;
          break;

        case "video_submitted":
          current.message = event.message;
          break;

        case "video_polling":
          current.status = "polling";
          current.message = event.message;
          break;

        case "video_complete":
        case "scene_complete":
          current.status = "complete";
          current.message = "Complete";
          if (event.data?.video_url) {
            current.video = {
              url: event.data.video_url,
              duration: event.data.video_duration,
              width: event.data.video_width,
              height: event.data.video_height,
            };
          }
          if (event.data?.method) current.method = event.data.method;
          if (event.data?.reasoning) current.reasoning = event.data.reasoning;
          if (event.data?.image_url) current.imageUrl = event.data.image_url;
          break;

        case "error":
          current.status = "error";
          current.message = event.message;
          setError(event.message);
          break;
      }

      next[idx] = current;
      return next;
    });
  }, []);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    setIsRunning(false);
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/60 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <XaiMark className="h-[18px] w-[18px] text-white" />
            <div className="h-4 w-px bg-white/10" />
            <span className="text-[15px] font-semibold tracking-tight text-white">
              Imagine
            </span>
            <span className="text-[11px] font-mono text-white/30 bg-white/[0.05] border border-white/[0.08] rounded px-2 py-0.5 leading-none">
              AD
            </span>
          </div>
          <a
            href="https://x.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[13px] text-white/30 font-mono hover:text-white/50 transition-colors"
          >
            x.ai
          </a>
        </div>
      </header>

      {/* Main layout */}
      <main className="flex-1 pt-14">
        {/* Hero — centered like Grok's landing when nothing has been generated */}
        {!hasStarted && (
          <div className="flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] px-8">
            <div className="w-full max-w-3xl space-y-10">
              {/* Title */}
              <div className="text-center space-y-4">
                <h1 className="font-display text-[42px] md:text-[56px] font-semibold tracking-tight text-white leading-[1.08]">
                  Imagine your ad.
                </h1>
                <p className="text-[16px] text-white/40 max-w-lg mx-auto leading-relaxed">
                  Describe your product and Grok will plan, generate, and
                  sequence a 3&#8209;scene video ad.
                </p>
              </div>

              {/* Input — pill-style like Grok */}
              <div className="relative">
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] overflow-hidden transition-colors focus-within:border-white/[0.14] focus-within:bg-white/[0.04]">
                  <Textarea
                    id="concept"
                    placeholder="What's your product?"
                    value={concept}
                    onChange={(e) => setConcept(e.target.value)}
                    disabled={isRunning}
                    rows={3}
                    className="w-full resize-none border-0 bg-transparent text-[16px] text-white placeholder:text-white/25 px-6 pt-5 pb-16 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 min-h-0"
                  />

                  {/* Bottom bar inside input */}
                  <div className="absolute bottom-0 left-0 right-0 px-5 pb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      {/* Settings toggle */}
                      <button
                        onClick={() => setShowSettings(!showSettings)}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12px] font-mono transition-colors ${showSettings
                          ? "border-white/20 bg-white/10 text-white/70"
                          : "border-white/[0.08] text-white/30 hover:text-white/50 hover:border-white/[0.12]"
                          }`}
                      >
                        Settings
                      </button>

                      {/* Quick info pills */}
                      <span className="inline-flex items-center rounded-full border border-white/[0.06] px-3 py-1 text-[12px] font-mono text-white/25">
                        {duration}s &times; 3
                      </span>
                      <span className="inline-flex items-center rounded-full border border-white/[0.06] px-3 py-1 text-[12px] font-mono text-white/25">
                        {aspectRatio}
                      </span>
                    </div>

                    {/* Generate button */}
                    <Button
                      onClick={handleRun}
                      disabled={!concept.trim()}
                      size="sm"
                      className="h-9 px-5 rounded-full bg-white text-black text-[13px] font-medium hover:bg-white/90 disabled:opacity-20 disabled:bg-white/10 disabled:text-white/30 transition-all"
                    >
                      Generate
                      <ArrowRight className="h-4 w-4 ml-1.5" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Settings panel */}
              {showSettings && (
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-5 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="grid grid-cols-3 gap-5">
                    <div className="space-y-2">
                      <Label className="text-[10px] text-white/30 font-mono uppercase tracking-wider">
                        Duration
                      </Label>
                      <div className="flex items-center gap-3">
                        <Slider
                          value={[duration]}
                          onValueChange={([v]) => setDuration(v)}
                          min={5}
                          max={10}
                          step={1}
                          className="flex-1"
                        />
                        <span className="text-[11px] font-mono text-white/40 w-7 text-right tabular-nums">
                          {duration}s
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[10px] text-white/30 font-mono uppercase tracking-wider">
                        Ratio
                      </Label>
                      <Select
                        value={aspectRatio}
                        onValueChange={(v) => setAspectRatio(v as AspectRatio)}
                      >
                        <SelectTrigger className="bg-white/[0.03] border-white/[0.08] text-[12px] font-mono text-white/60 h-8 rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#141414] border-white/[0.08] text-white/80">
                          {ASPECT_RATIOS.map((r) => (
                            <SelectItem key={r} value={r} className="text-[12px] font-mono">
                              {r}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[10px] text-white/30 font-mono uppercase tracking-wider">
                        Quality
                      </Label>
                      <Select
                        value={resolution}
                        onValueChange={(v) => setResolution(v as Resolution)}
                      >
                        <SelectTrigger className="bg-white/[0.03] border-white/[0.08] text-[12px] font-mono text-white/60 h-8 rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#141414] border-white/[0.08] text-white/80">
                          {RESOLUTIONS.map((r) => (
                            <SelectItem key={r} value={r} className="text-[12px] font-mono">
                              {r}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              {/* Error on landing */}
              {error && (
                <div className="flex items-start gap-3 p-4 rounded-xl border border-red-500/15 bg-red-500/[0.04]">
                  <AlertCircle className="h-4 w-4 text-red-400/70 mt-0.5 shrink-0" />
                  <div className="space-y-1">
                    <p className="text-[13px] text-red-400/80">{error}</p>
                    <p className="text-[11px] text-red-400/40 font-mono">
                      Check that XAI_API_KEY is configured.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Pipeline view — shown once generation starts */}
        {hasStarted && (
          <div className="max-w-6xl mx-auto px-8 py-10 space-y-8">
            {/* Compact input bar */}
            <div className="flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-white/50 line-clamp-2 leading-relaxed">
                  {concept}
                </p>
              </div>
              {isRunning ? (
                <Button
                  onClick={handleStop}
                  size="sm"
                  className="shrink-0 h-8 px-4 rounded-full bg-white/[0.06] border border-white/[0.08] text-white/50 text-[12px] font-mono hover:bg-white/[0.1] hover:text-white/70 transition-colors gap-1.5"
                >
                  <CircleStop className="h-3.5 w-3.5" />
                  Stop
                </Button>
              ) : (
                <Button
                  onClick={handleRun}
                  disabled={!concept.trim()}
                  size="sm"
                  className="shrink-0 h-8 px-4 rounded-full bg-white text-black text-[12px] font-medium hover:bg-white/90 disabled:opacity-20 transition-all"
                >
                  Regenerate
                </Button>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-3 p-4 rounded-xl border border-red-500/15 bg-red-500/[0.04]">
                <AlertCircle className="h-4 w-4 text-red-400/70 mt-0.5 shrink-0" />
                <p className="text-[13px] text-red-400/80">{error}</p>
              </div>
            )}

            {/* Pipeline status */}
            {isRunning && (
              <div className="flex items-center gap-2.5">
                <div className="h-1.5 w-1.5 rounded-full bg-[#39ff14] shadow-[0_0_6px_rgba(57,255,20,0.6)] animate-pulse" />
                <span className="text-[12px] font-mono text-[#39ff14] drop-shadow-[0_0_8px_rgba(57,255,20,0.35)]">
                  Agentic pipeline running
                </span>
              </div>
            )}

            {/* Scene grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {scenes.map((scene, i) => (
                <SceneCard
                  key={i}
                  index={i}
                  scene={scene}
                  label={SCENE_LABELS[i]}
                />
              ))}
            </div>

            {hasAnyResult && !isRunning && (
              <p className="text-[11px] font-mono text-white/20 text-center pt-2">
                Download scenes and combine them for your final ad.
              </p>
            )}
          </div>
        )}
      </main>

      {/* Footer — barely there */}
      <footer className="py-8">
        <div className="max-w-6xl mx-auto px-8 flex items-center justify-between">
          <span className="text-[12px] font-mono text-white/15">
            Grok Imagine
          </span>
          <div className="flex items-center gap-5">
            <a
              href="https://docs.x.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12px] font-mono text-white/15 hover:text-white/40 transition-colors"
            >
              Docs
            </a>
            <a
              href="https://x.ai/api"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12px] font-mono text-white/15 hover:text-white/40 transition-colors"
            >
              API
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ─── Scene Card ──────────────────────────────────────────────────────────────

function SceneCard({
  index,
  scene,
  label,
}: {
  index: number;
  scene: SceneState;
  label: string;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const isLoading = ["planning", "generating", "polling"].includes(scene.status);

  const MethodIcon = scene.method ? METHOD_ICONS[scene.method] : null;

  return (
    <div className="group relative">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2.5">
        <div
          className={`flex h-5 w-5 items-center justify-center rounded-md text-[9px] font-mono font-semibold transition-colors ${scene.status === "complete"
            ? "bg-white/10 text-white/70"
            : isLoading
              ? "bg-white/[0.06] text-white/50"
              : "bg-white/[0.03] text-white/20"
            }`}
        >
          {scene.status === "complete" ? (
            <Check className="h-2.5 w-2.5" />
          ) : (
            index + 1
          )}
        </div>
        <span className="text-[11px] font-medium tracking-wide text-white/50 uppercase">
          {label}
        </span>

        {scene.method && (
          <Badge
            variant="outline"
            className="ml-auto border-white/[0.06] bg-transparent text-white/30 text-[9px] font-mono gap-1 px-2 py-0"
          >
            {MethodIcon && <MethodIcon className="h-2 w-2" />}
            {METHOD_LABELS[scene.method]}
          </Badge>
        )}
      </div>

      {/* Video Container */}
      <div
        className={`relative aspect-video rounded-xl overflow-hidden border transition-colors ${scene.status === "complete"
          ? "bg-black border-white/[0.08]"
          : isLoading
            ? "bg-white/[0.02] border-white/[0.06] grok-shimmer"
            : "bg-white/[0.015] border-white/[0.04]"
          }`}
      >
        {/* Loading */}
        {isLoading && (
          <div className="absolute inset-0 flex flex-col justify-end p-4 gap-2">
            <div className="h-1.5 w-[65%] rounded-full bg-white/[0.04]" />
            <div className="h-1 w-[40%] rounded-full bg-white/[0.03]" />
            <div className="pt-1.5 flex items-center gap-2">
              {scene.status === "planning" && (
                <Brain className="h-3 w-3 text-white/25 animate-pulse" />
              )}
              {scene.status === "generating" && (
                <Loader2 className="h-3 w-3 text-white/25 animate-spin" />
              )}
              {scene.status === "polling" && (
                <Loader2 className="h-3 w-3 text-white/25 animate-spin" />
              )}
              <span className="text-[10px] font-mono text-white/20">
                {scene.message || "Processing..."}
              </span>
            </div>
          </div>
        )}

        {/* Idle */}
        {scene.status === "idle" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-white/[0.03] border border-white/[0.04] flex items-center justify-center">
              <Play className="h-3.5 w-3.5 text-white/15" />
            </div>
            <span className="text-[10px] font-mono text-white/15">
              Waiting
            </span>
          </div>
        )}

        {/* Error */}
        {scene.status === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4">
            <AlertCircle className="h-4 w-4 text-red-400/50" />
            <span className="text-[10px] font-mono text-red-400/50 text-center leading-relaxed">
              {scene.message}
            </span>
          </div>
        )}

        {/* Video Player */}
        {scene.video && (
          <>
            <video
              src={scene.video.url}
              controls
              className="w-full h-full object-contain bg-black"
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
            />
            {!isPlaying && (
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <div className="h-10 w-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
                  <Play className="h-4 w-4 text-white/80 ml-0.5" />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Reasoning */}
      {scene.reasoning && (
        <div className="mt-2.5 px-3 py-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
          <div className="flex items-start gap-2">
            <Brain className="h-3 w-3 text-white/20 mt-0.5 shrink-0" />
            <p className="text-[10px] text-white/30 leading-relaxed">
              {scene.reasoning}
            </p>
          </div>
        </div>
      )}

      {/* Reference Image */}
      {scene.imageUrl && (
        <div className="mt-2">
          <div className="flex items-center gap-1.5 mb-1">
            <ImageIcon className="h-2.5 w-2.5 text-white/20" />
            <span className="text-[9px] font-mono text-white/20 uppercase tracking-wider">
              Ref image
            </span>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={scene.imageUrl}
            alt={`Scene ${index + 1} reference`}
            className="w-full h-16 object-cover rounded-lg border border-white/[0.04] opacity-70"
          />
        </div>
      )}

      {/* Actions */}
      {scene.video && (
        <div className="flex items-center gap-2 mt-2.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[10px] font-mono text-white/30 hover:text-white/60 hover:bg-white/[0.04] gap-1.5 rounded-lg px-2.5"
            asChild
          >
            <a
              href={scene.video.url}
              download
              target="_blank"
              rel="noopener noreferrer"
            >
              <Download className="h-2.5 w-2.5" />
              Download
            </a>
          </Button>
          {scene.video.duration && (
            <span className="text-[9px] font-mono text-white/15 ml-auto tabular-nums">
              {scene.video.duration.toFixed(1)}s
              {scene.video.width &&
                scene.video.height &&
                ` · ${scene.video.width}×${scene.video.height}`}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
