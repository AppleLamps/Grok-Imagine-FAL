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
    <div className="group relative space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-[11px] font-mono font-medium text-white/60">
          {index + 1}
        </div>
        <h3 className="text-sm font-medium tracking-wide text-white/80 uppercase">
          Clip {index + 1}
        </h3>
        {isModified && (
          <Badge
            variant="outline"
            className="border-orange-500/20 text-orange-400/60 text-[10px] font-mono"
          >
            Modified
          </Badge>
        )}
        <Badge
          variant="outline"
          className="ml-auto border-white/10 text-white/30 text-[10px] font-mono"
        >
          {config.duration}s · {config.aspect_ratio} · {config.resolution}
        </Badge>
      </div>

      {/* Image Upload (I2V mode) */}
      {isI2V && (
        <div className="space-y-2">
          <Label className="text-xs text-white/40 font-mono uppercase tracking-wider">
            Source Image
          </Label>

          {config.imagePreview ? (
            <div className="relative group/img rounded-lg overflow-hidden border border-white/[0.08] bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={config.imagePreview}
                alt={`Clip ${index + 1} source`}
                className="w-full h-32 object-cover"
              />
              {/* Upload status indicator */}
              {config.imageUrl && (
                <div className="absolute top-2 left-2">
                  <Badge className="bg-green-500/20 text-green-400/80 border-green-500/20 text-[9px] font-mono">
                    Uploaded
                  </Badge>
                </div>
              )}
              {config.imageFile && !config.imageUrl && (
                <div className="absolute top-2 left-2">
                  <Badge className="bg-yellow-500/20 text-yellow-400/80 border-yellow-500/20 text-[9px] font-mono">
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
                className="absolute top-2 right-2 h-6 w-6 p-0 bg-black/60 hover:bg-black/80 text-white/60 hover:text-white rounded-full opacity-0 group-hover/img:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
              className="w-full h-32 rounded-lg border border-dashed border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.15] transition-all duration-200 flex flex-col items-center justify-center gap-2 disabled:opacity-30 disabled:pointer-events-none"
            >
              <div className="h-8 w-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
                <ImagePlus className="h-4 w-4 text-white/25" />
              </div>
              <span className="text-[11px] font-mono text-white/25">
                Drop or click to upload
              </span>
              <span className="text-[9px] font-mono text-white/15">
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
          className="text-xs text-white/40 font-mono uppercase tracking-wider"
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
          className="min-h-[100px] resize-none bg-white/[0.03] border-white/[0.06] text-sm text-white/90 placeholder:text-white/20 focus:border-white/20 focus:bg-white/[0.05] transition-all duration-200"
        />
      </div>

      {/* Settings Row */}
      <div className="grid grid-cols-3 gap-4">
        {/* Duration */}
        <div className="space-y-2.5">
          <Label className="text-xs text-white/40 font-mono uppercase tracking-wider">
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
            <span className="text-xs font-mono text-white/50 w-6 text-right tabular-nums">
              {config.duration}s
            </span>
          </div>
        </div>

        {/* Aspect Ratio */}
        <div className="space-y-2.5">
          <Label className="text-xs text-white/40 font-mono uppercase tracking-wider">
            Ratio
          </Label>
          <Select
            value={config.aspect_ratio}
            onValueChange={(v) =>
              onChange({ ...config, aspect_ratio: v as AspectRatio })
            }
            disabled={disabled}
          >
            <SelectTrigger className="bg-white/[0.03] border-white/[0.06] text-xs font-mono h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#0a0a0a] border-white/10">
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
          <Label className="text-xs text-white/40 font-mono uppercase tracking-wider">
            Quality
          </Label>
          <Select
            value={config.resolution}
            onValueChange={(v) =>
              onChange({ ...config, resolution: v as Resolution })
            }
            disabled={disabled}
          >
            <SelectTrigger className="bg-white/[0.03] border-white/[0.06] text-xs font-mono h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#0a0a0a] border-white/10">
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
