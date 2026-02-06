"use client";

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
  ASPECT_RATIOS,
  RESOLUTIONS,
  type ClipConfig,
  type AspectRatio,
  type Resolution,
} from "@/lib/workflow";

interface ClipFormProps {
  index: number;
  config: ClipConfig;
  onChange: (config: ClipConfig) => void;
  disabled?: boolean;
}

export function ClipForm({ index, config, onChange, disabled }: ClipFormProps) {
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
        <Badge
          variant="outline"
          className="ml-auto border-white/10 text-white/30 text-[10px] font-mono"
        >
          {config.duration}s · {config.aspect_ratio} · {config.resolution}
        </Badge>
      </div>

      {/* Prompt */}
      <div className="space-y-2">
        <Label
          htmlFor={`prompt-${index}`}
          className="text-xs text-white/40 font-mono uppercase tracking-wider"
        >
          Prompt
        </Label>
        <Textarea
          id={`prompt-${index}`}
          placeholder="Describe the scene for this clip..."
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
              {ASPECT_RATIOS.map((ratio) => (
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
