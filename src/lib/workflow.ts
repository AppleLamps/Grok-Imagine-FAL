/**
 * Grok Imagine Ad Generator — FAL Workflow Definition
 *
 * Generates 3 parallel text-to-video clips using xAI's Grok Imagine Video.
 * Each clip has independent prompt, duration, aspect ratio, and resolution.
 */

export const AD_WORKFLOW = {
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

export const ASPECT_RATIOS = [
  "16:9",
  "4:3",
  "3:2",
  "1:1",
  "2:3",
  "3:4",
  "9:16",
] as const;

export const RESOLUTIONS = ["480p", "720p"] as const;

export type AspectRatio = (typeof ASPECT_RATIOS)[number];
export type Resolution = (typeof RESOLUTIONS)[number];

export interface ClipConfig {
  prompt: string;
  duration: number;
  aspect_ratio: AspectRatio;
  resolution: Resolution;
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
