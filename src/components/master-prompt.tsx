"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { GenerationMode } from "@/lib/workflow";

interface MasterPromptProps {
  onPromptsGenerated: (prompts: string[]) => void;
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

  const isI2V = mode === "image-to-video";

  // Gather images to send to Grok from clip forms
  const imagesToAnalyze = isI2V
    ? clipImages.filter((img): img is string => !!img)
    : [];

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
        onPromptsGenerated(data.prompts);
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
                ? "Grok analyzes your clip images + concept to create motion prompts"
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
                  ? "Describe your ad concept... Grok will analyze your clip images and create motion prompts for each."
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
