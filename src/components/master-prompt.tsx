"use client";

import { useState, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronUp,
  ImagePlus,
  X,
  Eye,
} from "lucide-react";
import type { GenerationMode } from "@/lib/workflow";

interface MasterPromptProps {
  onPromptsGenerated: (
    prompts: string[],
    imageAssignment?: number[]
  ) => void;
  disabled?: boolean;
  mode: GenerationMode;
  /** Base64 data URIs of uploaded images (from clip forms) for Grok analysis */
  clipImages: (string | undefined)[];
}

export function MasterPrompt({
  onPromptsGenerated,
  disabled,
  mode,
  clipImages,
}: MasterPromptProps) {
  const [masterPrompt, setMasterPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);

  // Standalone image uploads (separate from clip-level images)
  const [standaloneImages, setStandaloneImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isI2V = mode === "image-to-video";

  // Gather images to send to Grok: standalone uploads (I2V) or clip images
  const imagesToAnalyze = isI2V
    ? standaloneImages.length > 0
      ? standaloneImages
      : clipImages.filter((img): img is string => !!img)
    : [];

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newImages: string[] = [];
    let loaded = 0;

    files.slice(0, 3 - standaloneImages.length).forEach((file) => {
      if (!file.type.match(/^image\/(jpeg|jpg|png|webp)$/)) return;
      if (file.size > 20 * 1024 * 1024) return;

      const reader = new FileReader();
      reader.onload = () => {
        newImages.push(reader.result as string);
        loaded++;
        if (loaded === files.length || newImages.length >= 3) {
          setStandaloneImages((prev) => [...prev, ...newImages].slice(0, 3));
        }
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeStandaloneImage = (index: number) => {
    setStandaloneImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleGenerate = async () => {
    if (!masterPrompt.trim() || isGenerating) return;

    setIsGenerating(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        masterPrompt: masterPrompt.trim(),
      };

      // Send images for analysis if available
      if (imagesToAnalyze.length > 0) {
        payload.images = imagesToAnalyze;
      }

      const response = await fetch("/api/generate-prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate prompts");
      }

      if (
        data.prompts &&
        Array.isArray(data.prompts) &&
        data.prompts.length === 3
      ) {
        onPromptsGenerated(data.prompts, data.imageAssignment);
      } else {
        throw new Error("Unexpected response format");
      }
    } catch (err) {
      console.error("Prompt generation error:", err);
      setError(
        err instanceof Error ? err.message : "Failed to generate prompts"
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="rounded-xl border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-white/[0.02] overflow-hidden">
      {/* Header — always visible */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-5 pb-4 hover:bg-white/[0.01] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="h-7 w-7 rounded-md bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-white/[0.08] flex items-center justify-center">
            <Sparkles className="h-3.5 w-3.5 text-purple-300/70" />
          </div>
          <div className="text-left">
            <h2 className="text-sm font-medium tracking-tight text-white/90">
              Master Prompt
            </h2>
            <p className="text-[11px] text-white/30 font-mono mt-0.5">
              {isI2V
                ? "Grok analyzes your images + concept to create motion prompts"
                : "grok-4-1-fast-reasoning generates 3 detailed clip prompts"}
            </p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-white/20" />
        ) : (
          <ChevronDown className="h-4 w-4 text-white/20" />
        )}
      </button>

      {/* Expandable content */}
      {isExpanded && (
        <div className="px-5 pb-5 space-y-4">
          {/* Image upload area for I2V mode */}
          {isI2V && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-white/40 font-mono uppercase tracking-wider">
                  Reference Images
                  <span className="text-white/20 ml-1">
                    ({standaloneImages.length}/3)
                  </span>
                </Label>
                {imagesToAnalyze.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Eye className="h-3 w-3 text-purple-400/50" />
                    <span className="text-[10px] font-mono text-purple-400/50">
                      Grok will analyze {imagesToAnalyze.length} image
                      {imagesToAnalyze.length > 1 ? "s" : ""}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                {/* Uploaded images */}
                {standaloneImages.map((img, i) => (
                  <div
                    key={i}
                    className="relative group/thumb w-24 h-24 rounded-lg overflow-hidden border border-white/[0.08] bg-black shrink-0"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img}
                      alt={`Reference ${i + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <Badge className="absolute bottom-1 left-1 bg-black/60 text-white/60 text-[9px] font-mono border-0 h-4 px-1">
                      {i + 1}
                    </Badge>
                    <button
                      type="button"
                      onClick={() => removeStandaloneImage(i)}
                      title={`Remove image ${i + 1}`}
                      className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity"
                    >
                      <X className="h-2.5 w-2.5 text-white/60" />
                    </button>
                  </div>
                ))}

                {/* Add button */}
                {standaloneImages.length < 3 && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={disabled || isGenerating}
                    className="w-24 h-24 rounded-lg border border-dashed border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.15] transition-all duration-200 flex flex-col items-center justify-center gap-1.5 disabled:opacity-30 disabled:pointer-events-none shrink-0"
                  >
                    <ImagePlus className="h-4 w-4 text-white/20" />
                    <span className="text-[9px] font-mono text-white/20">
                      Add
                    </span>
                  </button>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                  aria-label="Upload reference images"
                />
              </div>

              {standaloneImages.length > 0 && (
                <p className="text-[10px] font-mono text-white/20">
                  Grok will analyze these images and assign each to the best
                  clip. Images will also be sent to FAL for video generation.
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label
              htmlFor="master-prompt"
              className="text-xs text-white/40 font-mono uppercase tracking-wider"
            >
              Ad Concept
            </Label>
            <Textarea
              id="master-prompt"
              placeholder={
                isI2V
                  ? "Describe your ad concept... Grok will analyze your uploaded images and create motion prompts for each clip."
                  : "Describe your ad concept... e.g. 'A luxury electric car commercial showcasing speed, elegance, and sustainability.'"
              }
              value={masterPrompt}
              onChange={(e) => setMasterPrompt(e.target.value)}
              disabled={disabled || isGenerating}
              className="min-h-[120px] resize-none bg-white/[0.03] border-white/[0.06] text-sm text-white/90 placeholder:text-white/15 focus:border-white/20 focus:bg-white/[0.05] transition-all duration-200"
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-red-400/80 font-mono">{error}</p>
          )}

          {/* Generate button */}
          <div className="flex items-center gap-3">
            <Button
              onClick={handleGenerate}
              disabled={!masterPrompt.trim() || isGenerating || disabled}
              className="h-9 px-5 bg-white/[0.08] text-white/80 text-xs font-medium tracking-tight hover:bg-white/[0.12] hover:text-white disabled:opacity-30 transition-all duration-200 gap-2 border border-white/[0.08] rounded-lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {isI2V && imagesToAnalyze.length > 0
                    ? "Analyzing images..."
                    : "Thinking..."}
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  {isI2V && imagesToAnalyze.length > 0
                    ? `Analyze ${imagesToAnalyze.length} Image${imagesToAnalyze.length > 1 ? "s" : ""} + Generate Prompts`
                    : "Generate 3 Prompts"}
                </>
              )}
            </Button>

            {isGenerating && (
              <span className="text-[10px] font-mono text-white/20">
                {isI2V && imagesToAnalyze.length > 0
                  ? "Grok is analyzing your images and crafting motion prompts..."
                  : "Grok is crafting your ad sequence..."}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
