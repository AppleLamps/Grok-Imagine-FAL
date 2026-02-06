"use client";

import { useRef } from "react";
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
import { Button } from "@/components/ui/button";
import { ImagePlus, X } from "lucide-react";
import {
  T2V_ASPECT_RATIOS,
  I2V_ASPECT_RATIOS,
  RESOLUTIONS,
  type ClipConfig,
  type AspectRatio,
  type Resolution,
  type GenerationMode,
} from "@/lib/workflow";

interface ClipFormProps {
  index: number;
  config: ClipConfig;
  onChange: (config: ClipConfig) => void;
  disabled?: boolean;
  mode: GenerationMode;
  isModified?: boolean;
}

export function ClipForm({
  index,
  config,
  onChange,
  disabled,
  mode,
  isModified,
}: ClipFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isI2V = mode === "image-to-video";
  const aspectRatios = isI2V ? I2V_ASPECT_RATIOS : T2V_ASPECT_RATIOS;

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.match(/^image\/(jpeg|jpg|png|webp)$/)) {
      return;
    }

    // Validate size (20MB max per xAI docs)
    if (file.size > 20 * 1024 * 1024) {
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = () => {
      onChange({
        ...config,
        imageFile: file,
        imagePreview: reader.result as string,
        imageUrl: undefined, // Will be set after FAL upload
      });
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    onChange({
      ...config,
      imageFile: undefined,
      imagePreview: undefined,
      imageUrl: undefined,
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="group relative space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="flex h-6 w-6 items-center justify-center rounded-xl bg-[var(--brand)] text-[10px] font-mono font-semibold text-[var(--brand-foreground)] shadow-sm ring-1 ring-black/5">
          {index + 1}
        </div>
        <h3 className="text-xs font-semibold tracking-wide text-foreground uppercase">
          Shot {index + 1}
        </h3>
        {isModified && (
          <Badge
            variant="outline"
            className="border-orange-500/30 text-orange-700/80 text-[10px] font-mono bg-orange-500/10"
          >
            Modified
          </Badge>
        )}
        <Badge
          variant="outline"
          className="ml-auto border-border/70 text-muted-foreground text-[10px] font-mono bg-background/40"
        >
          {config.duration}s · {config.aspect_ratio} · {config.resolution}
        </Badge>
      </div>

      {/* Image Upload (I2V mode) */}
      {isI2V && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
            Source Image
          </Label>

          {config.imagePreview ? (
            <div className="relative group/img rounded-2xl overflow-hidden border border-border/70 bg-background/40">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={config.imagePreview}
                alt={`Clip ${index + 1} source`}
                className="w-full h-32 object-cover"
              />
              {/* Upload status indicator */}
              {config.imageUrl && (
                <div className="absolute top-2 left-2">
                  <Badge className="bg-green-500/15 text-green-800/80 border-green-500/25 text-[9px] font-mono">
                    Uploaded
                  </Badge>
                </div>
              )}
              {config.imageFile && !config.imageUrl && (
                <div className="absolute top-2 left-2">
                  <Badge className="bg-yellow-500/15 text-yellow-900/70 border-yellow-500/25 text-[9px] font-mono">
                    Ready
                  </Badge>
                </div>
              )}
              {/* Remove button */}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemoveImage}
                disabled={disabled}
                className="absolute top-2 right-2 h-7 w-7 p-0 bg-background/70 hover:bg-background text-foreground/70 hover:text-foreground rounded-full opacity-0 group-hover/img:opacity-100 transition-opacity border border-border/70"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
              className="w-full h-32 rounded-2xl border border-dashed border-border/80 bg-background/35 hover:bg-background/55 hover:border-foreground/20 transition-all duration-200 flex flex-col items-center justify-center gap-2 disabled:opacity-30 disabled:pointer-events-none"
            >
              <div className="h-9 w-9 rounded-2xl bg-card/70 border border-border/70 flex items-center justify-center shadow-sm">
                <ImagePlus className="h-4 w-4 text-muted-foreground" />
              </div>
              <span className="text-[11px] font-mono text-muted-foreground">
                Drop or click to upload
              </span>
              <span className="text-[9px] font-mono text-muted-foreground/80">
                JPG, PNG, WebP · 20MB max
              </span>
            </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            onChange={handleImageSelect}
            className="hidden"
            aria-label={`Upload image for clip ${index + 1}`}
          />
        </div>
      )}

      {/* Prompt */}
      <div className="space-y-2">
        <Label
          htmlFor={`prompt-${index}`}
          className="text-xs text-muted-foreground font-mono uppercase tracking-wider"
        >
          {isI2V ? "Motion Prompt" : "Prompt"}
        </Label>
        <Textarea
          id={`prompt-${index}`}
          placeholder={
            isI2V
              ? "Describe the motion and action for this image..."
              : "Describe the scene for this clip..."
          }
          value={config.prompt}
          onChange={(e) => onChange({ ...config, prompt: e.target.value })}
          disabled={disabled}
          className="min-h-[90px] resize-none bg-background/40 border-border/70 text-sm text-foreground placeholder:text-muted-foreground/80 focus:border-foreground/30 focus:bg-background/55 transition-all duration-200 rounded-2xl"
        />
      </div>

      {/* Settings Row */}
      <div className="grid grid-cols-3 gap-4">
        {/* Duration */}
        <div className="space-y-2.5">
          <Label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
            Duration
          </Label>
          <div className="flex items-center gap-3">
            <Slider
              value={[config.duration]}
              onValueChange={([v]) => onChange({ ...config, duration: v })}
              min={1}
              max={15}
              step={1}
              disabled={disabled}
              className="flex-1"
            />
            <span className="text-xs font-mono text-muted-foreground w-6 text-right tabular-nums">
              {config.duration}s
            </span>
          </div>
        </div>

        {/* Aspect Ratio */}
        <div className="space-y-2.5">
          <Label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
            Ratio
          </Label>
          <Select
            value={config.aspect_ratio}
            onValueChange={(v) =>
              onChange({ ...config, aspect_ratio: v as AspectRatio })
            }
            disabled={disabled}
          >
            <SelectTrigger className="bg-background/40 border-border/70 text-xs font-mono h-9 rounded-2xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border/70 text-foreground shadow-lg">
              {aspectRatios.map((ratio) => (
                <SelectItem
                  key={ratio}
                  value={ratio}
                  className="text-xs font-mono"
                >
                  {ratio}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Resolution */}
        <div className="space-y-2.5">
          <Label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
            Quality
          </Label>
          <Select
            value={config.resolution}
            onValueChange={(v) =>
              onChange({ ...config, resolution: v as Resolution })
            }
            disabled={disabled}
          >
            <SelectTrigger className="bg-background/40 border-border/70 text-xs font-mono h-9 rounded-2xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border/70 text-foreground shadow-lg">
              {RESOLUTIONS.map((res) => (
                <SelectItem
                  key={res}
                  value={res}
                  className="text-xs font-mono"
                >
                  {res}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
