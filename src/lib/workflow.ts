/**
 * Grok Imagine Ad Generator — FAL Workflow Definitions
 *
 * TEXT-TO-VIDEO: 3 parallel text-to-video clips
 * IMAGE-TO-VIDEO: 3 parallel image-to-video clips (each with a source image)
 */

// ─── Text-to-Video Workflow ──────────────────────────────────────────────────

export const T2V_WORKFLOW = {
  input: {
    id: "input",
    type: "input",
    depends: [],
    input: {
      prompt: "",
      duration: 6,
      aspect_ratio: "16:9",
      resolution: "720p",
      prompt_2: "",
      duration_2: 6,
      aspect_ratio_2: "16:9",
      resolution_2: "720p",
      prompt_3: "",
      duration_3: 6,
      aspect_ratio_3: "16:9",
      resolution_3: "720p",
    },
  },
  "node-clip-1": {
    id: "node-clip-1",
    type: "run",
    depends: ["input"],
    app: "xai/grok-imagine-video/text-to-video",
    input: {
      prompt: "$input.prompt",
      duration: "$input.duration",
      aspect_ratio: "$input.aspect_ratio",
      resolution: "$input.resolution",
    },
  },
  "node-clip-2": {
    id: "node-clip-2",
    type: "run",
    depends: ["input"],
    app: "xai/grok-imagine-video/text-to-video",
    input: {
      prompt: "$input.prompt_2",
      duration: "$input.duration_2",
      aspect_ratio: "$input.aspect_ratio_2",
      resolution: "$input.resolution_2",
    },
  },
  "node-clip-3": {
    id: "node-clip-3",
    type: "run",
    depends: ["input"],
    app: "xai/grok-imagine-video/text-to-video",
    input: {
      prompt: "$input.prompt_3",
      duration: "$input.duration_3",
      aspect_ratio: "$input.aspect_ratio_3",
      resolution: "$input.resolution_3",
    },
  },
  output: {
    id: "output",
    type: "display",
    depends: ["node-clip-1", "node-clip-2", "node-clip-3"],
    fields: {
      video_1: "$node-clip-1.video",
      video_2: "$node-clip-2.video",
      video_3: "$node-clip-3.video",
    },
  },
};

// Keep backward compat alias
export const AD_WORKFLOW = T2V_WORKFLOW;

// ─── Image-to-Video Workflow ─────────────────────────────────────────────────

export const I2V_WORKFLOW = {
  input: {
    id: "input",
    type: "input",
    depends: [],
    input: {
      prompt: "",
      duration: 6,
      aspect_ratio: "auto",
      resolution: "720p",
      image_url: "",
      prompt_2: "",
      duration_2: 6,
      aspect_ratio_2: "auto",
      resolution_2: "720p",
      image_url_2: "",
      prompt_3: "",
      duration_3: 6,
      aspect_ratio_3: "auto",
      resolution_3: "720p",
      image_url_3: "",
    },
  },
  "node-clip-1": {
    id: "node-clip-1",
    type: "run",
    depends: ["input"],
    app: "xai/grok-imagine-video/image-to-video",
    input: {
      prompt: "$input.prompt",
      duration: "$input.duration",
      aspect_ratio: "$input.aspect_ratio",
      resolution: "$input.resolution",
      image_url: "$input.image_url",
    },
  },
  "node-clip-2": {
    id: "node-clip-2",
    type: "run",
    depends: ["input"],
    app: "xai/grok-imagine-video/image-to-video",
    input: {
      prompt: "$input.prompt_2",
      duration: "$input.duration_2",
      aspect_ratio: "$input.aspect_ratio_2",
      resolution: "$input.resolution_2",
      image_url: "$input.image_url_2",
    },
  },
  "node-clip-3": {
    id: "node-clip-3",
    type: "run",
    depends: ["input"],
    app: "xai/grok-imagine-video/image-to-video",
    input: {
      prompt: "$input.prompt_3",
      duration: "$input.duration_3",
      aspect_ratio: "$input.aspect_ratio_3",
      resolution: "$input.resolution_3",
      image_url: "$input.image_url_3",
    },
  },
  output: {
    id: "output",
    type: "display",
    depends: ["node-clip-1", "node-clip-2", "node-clip-3"],
    fields: {
      video_1: "$node-clip-1.video",
      video_2: "$node-clip-2.video",
      video_3: "$node-clip-3.video",
    },
  },
};

// ─── Shared Types ────────────────────────────────────────────────────────────

export type GenerationMode = "text-to-video" | "image-to-video";

export const T2V_ASPECT_RATIOS = [
  "16:9",
  "4:3",
  "3:2",
  "1:1",
  "2:3",
  "3:4",
  "9:16",
] as const;

export const I2V_ASPECT_RATIOS = [
  "auto",
  "16:9",
  "4:3",
  "3:2",
  "1:1",
  "2:3",
  "3:4",
  "9:16",
] as const;

export const ASPECT_RATIOS = T2V_ASPECT_RATIOS;
export const RESOLUTIONS = ["480p", "720p"] as const;

export type AspectRatio = (typeof I2V_ASPECT_RATIOS)[number];
export type Resolution = (typeof RESOLUTIONS)[number];

export interface ClipConfig {
  prompt: string;
  duration: number;
  aspect_ratio: AspectRatio;
  resolution: Resolution;
  /** Local image file for preview (client-only, not serialized) */
  imageFile?: File;
  /** Image preview data URL (client-only) */
  imagePreview?: string;
  /** FAL-hosted image URL (set after upload) */
  imageUrl?: string;
}

export interface VideoResult {
  url: string;
  width?: number;
  height?: number;
  duration?: number;
  fps?: number;
  content_type?: string;
}

export interface WorkflowResult {
  video_1?: VideoResult;
  video_2?: VideoResult;
  video_3?: VideoResult;
}
