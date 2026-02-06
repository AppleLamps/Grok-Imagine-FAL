/**
 * Grok Imagine Ad Generator — Pipeline Types
 *
 * Sequential agentic pipeline:
 *   Scene 1 → Analyze → Scene 2 → Analyze → Scene 3
 *
 * At each scene, Grok chooses the best generation method:
 *   - text-to-video
 *   - image-then-video (generate reference image → image-to-video)
 *   - edit-video (modify/extend previous scene)
 */

// ─── Generation Method (chosen by Grok per-scene) ────────────────────────────

export type GenerationMethod =
    | "text-to-video"
    | "image-then-video"
    | "edit-video";

// ─── Scene Decision (structured output from Grok) ────────────────────────────

export interface SceneDecision {
    method: GenerationMethod;
    video_prompt: string;
    /** Only for image-then-video: prompt to generate the reference image */
    image_prompt?: string;
    reasoning: string;
}

// ─── Pipeline Event (SSE stream from server → client) ────────────────────────

export type PipelineEventType =
    | "scene_planning"     // Grok is deciding method + prompt
    | "scene_planned"      // Decision made, about to generate
    | "image_generating"   // Generating reference image (image-then-video)
    | "image_complete"     // Reference image ready
    | "video_submitted"    // Video generation submitted, polling
    | "video_polling"      // Still polling
    | "video_complete"     // Video ready
    | "scene_complete"     // Scene fully done
    | "pipeline_complete"  // All 3 scenes done
    | "error";             // Something failed

export interface PipelineEvent {
    type: PipelineEventType;
    scene: number;           // 1, 2, or 3
    message: string;
    data?: {
        method?: GenerationMethod;
        reasoning?: string;
        video_prompt?: string;
        image_prompt?: string;
        image_url?: string;
        video_url?: string;
        video_duration?: number;
        video_width?: number;
        video_height?: number;
    };
}

// ─── Scene Result ────────────────────────────────────────────────────────────

export interface SceneResult {
    sceneNumber: number;
    method: GenerationMethod;
    reasoning: string;
    videoPrompt: string;
    imagePrompt?: string;
    imageUrl?: string;
    videoUrl: string;
    videoDuration?: number;
    videoWidth?: number;
    videoHeight?: number;
}

// ─── Video Display ───────────────────────────────────────────────────────────

export interface VideoResult {
    url: string;
    width?: number;
    height?: number;
    duration?: number;
}

// ─── Pipeline Input ──────────────────────────────────────────────────────────

export interface PipelineInput {
    concept: string;
    duration?: number;          // per-scene, default 6
    aspect_ratio?: string;      // default "16:9"
    resolution?: string;        // default "720p"
}

// ─── Constants ───────────────────────────────────────────────────────────────

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
