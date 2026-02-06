/**
 * xAI API client — handles all Grok Imagine generation endpoints.
 * Runs server-side only (uses XAI_API_KEY).
 *
 * Endpoints:
 *   - Text-to-Video:  POST /v1/videos/generations  { prompt, model, duration?, aspect_ratio?, resolution? }
 *   - Image-to-Video: POST /v1/videos/generations  { prompt, model, image: { url }, duration?, aspect_ratio?, resolution? }
 *   - Edit-Video:     POST /v1/videos/edits         { prompt, model, video: { url } }
 *   - Image Gen:      POST /v1/images/generations   { prompt, model, n?, response_format? }
 *   - Chat (vision):  POST /v1/chat/completions     (multimodal)
 *   - Poll Video:     GET  /v1/videos/:request_id
 */

const BASE = "https://api.x.ai/v1";
const VIDEO_MODEL = "grok-imagine-video";
const IMAGE_MODEL = "grok-imagine-image";
const CHAT_MODEL = "grok-4-1-fast";

function headers() {
    const key = process.env.XAI_API_KEY;
    if (!key) throw new Error("XAI_API_KEY is not configured");
    return {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
    };
}

// ─── Video Generation ────────────────────────────────────────────────────────

export interface VideoGenOptions {
    prompt: string;
    duration?: number;
    aspect_ratio?: string;
    resolution?: string;
}

export interface VideoGenFromImageOptions extends VideoGenOptions {
    image_url: string;
}

export interface VideoEditOptions {
    prompt: string;
    video_url: string;
}

export interface VideoResult {
    url: string;
    request_id: string;
    state?: string;
    duration?: number;
    width?: number;
    height?: number;
}

/** Submit text-to-video generation → returns request_id */
export async function submitTextToVideo(opts: VideoGenOptions): Promise<string> {
    const body = {
        prompt: opts.prompt,
        model: VIDEO_MODEL,
        ...(opts.duration && { duration: opts.duration }),
        ...(opts.aspect_ratio && { aspect_ratio: opts.aspect_ratio }),
        ...(opts.resolution && { resolution: opts.resolution }),
    };
    console.log("[xai] submitTextToVideo →", JSON.stringify(body, null, 2));
    const res = await fetch(`${BASE}/videos/generations`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const txt = await res.text();
        console.error("[xai] submitTextToVideo FAILED", res.status, txt);
        throw new Error(`xAI text-to-video error ${res.status}: ${txt}`);
    }
    const data = await res.json();
    console.log("[xai] submitTextToVideo ← request_id:", data.request_id);
    return data.request_id;
}

/** Submit image-to-video generation → returns request_id */
export async function submitImageToVideo(opts: VideoGenFromImageOptions): Promise<string> {
    const body = {
        prompt: opts.prompt,
        model: VIDEO_MODEL,
        image: { url: opts.image_url },
        ...(opts.duration && { duration: opts.duration }),
        ...(opts.aspect_ratio && { aspect_ratio: opts.aspect_ratio }),
        ...(opts.resolution && { resolution: opts.resolution }),
    };
    console.log("[xai] submitImageToVideo →", JSON.stringify({ ...body, image: { url: body.image.url.slice(0, 80) + "..." } }, null, 2));
    const res = await fetch(`${BASE}/videos/generations`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const txt = await res.text();
        console.error("[xai] submitImageToVideo FAILED", res.status, txt);
        throw new Error(`xAI image-to-video error ${res.status}: ${txt}`);
    }
    const data = await res.json();
    console.log("[xai] submitImageToVideo ← request_id:", data.request_id);
    return data.request_id;
}

/** Submit video edit → returns request_id */
export async function submitVideoEdit(opts: VideoEditOptions): Promise<string> {
    const body = {
        prompt: opts.prompt,
        model: VIDEO_MODEL,
        video: { url: opts.video_url },
    };
    console.log("[xai] submitVideoEdit →", JSON.stringify({ ...body, video: { url: body.video.url.slice(0, 80) + "..." } }, null, 2));
    const res = await fetch(`${BASE}/videos/edits`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const txt = await res.text();
        console.error("[xai] submitVideoEdit FAILED", res.status, txt);
        throw new Error(`xAI video-edit error ${res.status}: ${txt}`);
    }
    const data = await res.json();
    console.log("[xai] submitVideoEdit ← request_id:", data.request_id);
    return data.request_id;
}

/** Poll a video request until complete. Returns the final video result. */
export async function pollVideo(
    requestId: string,
    onProgress?: (state: string) => void,
    maxAttempts = 180,       // ~15 min at 5s interval
    intervalMs = 5000,
): Promise<VideoResult> {
    console.log(`[xai] pollVideo started for ${requestId}`);
    for (let i = 0; i < maxAttempts; i++) {
        const res = await fetch(`${BASE}/videos/${requestId}`, {
            headers: headers(),
        });
        if (!res.ok) {
            const txt = await res.text();
            console.error(`[xai] pollVideo FAILED attempt ${i + 1}`, res.status, txt);
            throw new Error(`xAI poll error ${res.status}: ${txt}`);
        }
        const data = await res.json();
        const state = data.state || data.status || data?.result?.state;
        const url = data.url || data?.result?.url || data?.output?.url;
        console.log(`[xai] pollVideo attempt ${i + 1}/${maxAttempts} — status: ${res.status}, state: ${state}, url: ${url ? "yes" : "no"}`);
        if (!state && !url && (i < 3 || i % 5 === 0)) {
            console.log("[xai] pollVideo raw response:", JSON.stringify(data).slice(0, 400));
        }

        if (state === "failed") {
            console.error("[xai] pollVideo — generation FAILED:", data.error);
            throw new Error(`Video generation failed: ${data.error || "unknown error"}`);
        }

        onProgress?.(state || "processing");

        if (url) {
            console.log(`[xai] pollVideo ← COMPLETE url: ${url.slice(0, 80)}...`);
            return {
                url,
                request_id: requestId,
                state: "completed",
                duration: data.duration,
                width: data.width,
                height: data.height,
            };
        }

        await new Promise((r) => setTimeout(r, intervalMs));
    }
    console.error("[xai] pollVideo — TIMED OUT after", maxAttempts, "attempts");
    throw new Error("Video generation timed out");
}

/** All-in-one: submit + poll until done */
export async function generateTextToVideo(
    opts: VideoGenOptions,
    onProgress?: (state: string) => void,
): Promise<VideoResult> {
    const id = await submitTextToVideo(opts);
    return pollVideo(id, onProgress);
}

export async function generateImageToVideo(
    opts: VideoGenFromImageOptions,
    onProgress?: (state: string) => void,
): Promise<VideoResult> {
    const id = await submitImageToVideo(opts);
    return pollVideo(id, onProgress);
}

export async function generateVideoEdit(
    opts: VideoEditOptions,
    onProgress?: (state: string) => void,
): Promise<VideoResult> {
    const id = await submitVideoEdit(opts);
    return pollVideo(id, onProgress);
}

// ─── Image Generation ────────────────────────────────────────────────────────

export interface ImageGenOptions {
    prompt: string;
    n?: number;
    aspect_ratio?: string;
    response_format?: "url" | "b64_json";
}

export interface ImageResult {
    url: string;
}

export async function generateImage(opts: ImageGenOptions): Promise<ImageResult> {
    const body = {
        prompt: opts.prompt,
        model: IMAGE_MODEL,
        n: opts.n || 1,
        ...(opts.aspect_ratio && { aspect_ratio: opts.aspect_ratio }),
        ...(opts.response_format && { response_format: opts.response_format }),
    };
    console.log("[xai] generateImage →", JSON.stringify(body, null, 2));
    const res = await fetch(`${BASE}/images/generations`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const txt = await res.text();
        console.error("[xai] generateImage FAILED", res.status, txt);
        throw new Error(`xAI image gen error ${res.status}: ${txt}`);
    }
    const data = await res.json();
    const img = data.data?.[0];
    console.log("[xai] generateImage ← url:", img?.url ? img.url.slice(0, 80) + "..." : "NONE");
    if (!img?.url) throw new Error("No image URL returned from xAI");
    return { url: img.url };
}

// ─── Chat / Vision ───────────────────────────────────────────────────────────

type ChatMessage = {
    role: "system" | "user" | "assistant";
    content: string | Array<Record<string, unknown>>;
};

export interface ChatOptions {
    messages: ChatMessage[];
    temperature?: number;
    response_format?: Record<string, unknown>;
    model?: string;
}

export async function chat(opts: ChatOptions): Promise<string> {
    console.log("[xai] chat →", { model: opts.model || CHAT_MODEL, messageCount: opts.messages.length, temperature: opts.temperature ?? 0.7, hasResponseFormat: !!opts.response_format });
    const res = await fetch(`${BASE}/chat/completions`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
            model: opts.model || CHAT_MODEL,
            messages: opts.messages,
            temperature: opts.temperature ?? 0.7,
            ...(opts.response_format && { response_format: opts.response_format }),
        }),
    });
    if (!res.ok) {
        const txt = await res.text();
        console.error("[xai] chat FAILED", res.status, txt);
        throw new Error(`xAI chat error ${res.status}: ${txt}`);
    }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    console.log("[xai] chat ← response length:", content?.length || 0, "chars");
    if (!content) throw new Error("No content returned from xAI chat");
    return content;
}

/** Structured chat — returns parsed JSON */
export async function chatJSON<T>(opts: ChatOptions): Promise<T> {
    const raw = await chat(opts);
    return JSON.parse(raw) as T;
}
