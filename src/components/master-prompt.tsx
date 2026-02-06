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
    <div className="rounded-2xl border border-border/70 bg-card/60 overflow-hidden shadow-sm">
      {/* Header — always visible */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-accent/60 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-[var(--brand)] border border-black/5 flex items-center justify-center shadow-sm">
            <Sparkles className="h-4 w-4 text-[var(--brand-foreground)]" />
          </div>
          <div className="text-left">
            <h2 className="text-sm font-semibold tracking-tight text-foreground">
              Master prompt
              <span className="ml-2 text-[10px] font-mono text-muted-foreground">
                {isI2V
                  ? "image analysis + prompts"
                  : "grok-4-1-fast"}
              </span>
            </h2>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {/* Expandable content */}
      {isExpanded && (
        <div className="px-5 pb-5 space-y-4">
          <div className="space-y-1.5">
            <Label
              htmlFor="master-prompt"
              className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider"
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
              className="min-h-[110px] resize-none bg-background/40 border-border/70 text-sm text-foreground placeholder:text-muted-foreground/80 focus:border-foreground/30 focus:bg-background/55 transition-all duration-200 rounded-2xl"
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-red-700/80 font-mono">{error}</p>
          )}

          {/* Generate button */}
          <div className="flex items-center gap-3">
            <Button
              onClick={handleGenerate}
              disabled={!masterPrompt.trim() || isGenerating || disabled}
              variant="brand"
              size="sm"
              className="h-9 px-4 text-[12px] font-semibold tracking-tight transition-all duration-200 gap-1.5 rounded-2xl shadow-sm disabled:opacity-40"
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
              <span className="text-[10px] font-mono text-muted-foreground">
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
