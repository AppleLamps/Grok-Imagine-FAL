import { NextRequest } from "next/server";
import { put } from "@vercel/blob";
import {
    chatJSON,
    generateImage,
    submitTextToVideo,
    submitImageToVideo,
    submitVideoEdit,
    pollVideo,
} from "@/lib/xai";
import type {
    PipelineEvent,
    PipelineInput,
    SceneDecision,
    GenerationMethod,
} from "@/lib/pipeline";

// ─── System Prompts ──────────────────────────────────────────────────────────

const SCENE_1_SYSTEM = `You are an elite creative director for video advertisements. Given a product/service concept, decide the BEST generation method for SCENE 1 (the hook — 5-10 seconds that grab attention immediately).

You MUST follow the provided settings (duration, aspect ratio, resolution). If you mention a duration in the prompt, it must match the provided duration exactly. Avoid mentioning any other duration.

You must choose ONE method:

1. "text-to-video" — Write a vivid cinematic prompt and generate the video directly from text. Best when the scene is conceptual, abstract, or doesn't need photorealistic precision.

2. "image-then-video" — First generate a high-fidelity reference image, then animate it into video. Best when the opening shot needs precise visual composition, a specific product shot, or photorealistic detail that benefits from an image-first approach.

For the video_prompt: write a rich cinematic description including camera movement, lighting, motion, atmosphere, and style.
For image_prompt (if image-then-video): describe a still frame with precise composition, lighting, and detail.

Think about what will be most visually striking and attention-grabbing as a hook.`;

const SCENE_2_SYSTEM = `You are an elite creative director for video advertisements. You have already generated SCENE 1 (the hook). Now you must decide the BEST generation method for SCENE 2 (the body — the core message / product showcase, 5-10 seconds).

You MUST follow the provided settings (duration, aspect ratio, resolution). If you mention a duration in the prompt, it must match the provided duration exactly. Avoid mentioning any other duration.

You will be shown a frame from Scene 1 so you can analyze its visual style, lighting, color palette, and subject matter.

You must choose ONE method:

1. "text-to-video" — Write a new prompt that explicitly references the style, lighting, and palette of Scene 1 to ensure visual continuity. Best for a scene that shifts location or subject while keeping the same aesthetic.

2. "image-then-video" — Generate a reference image first (matching Scene 1's style), then animate it. Best when this scene needs precise visual composition or a different angle of the same subject.

3. "edit-video" — Take the Scene 1 video and modify/extend it with new action. Best when Scene 2 should feel like a seamless continuation of Scene 1's motion and setting.

CRITICAL: Maintain visual continuity — same color palette, lighting style, and production quality as Scene 1.`;

const SCENE_3_SYSTEM = `You are an elite creative director for video advertisements. You have generated SCENE 1 (hook) and SCENE 2 (body). Now you must decide the BEST generation method for SCENE 3 (the closer — call-to-action, 5-10 seconds that leave a lasting impression).

You MUST follow the provided settings (duration, aspect ratio, resolution). If you mention a duration in the prompt, it must match the provided duration exactly. Avoid mentioning any other duration.

You will be shown frames from Scene 1 and Scene 2 so you can analyze the visual flow, style, and narrative arc.

You must choose ONE method:

1. "text-to-video" — Write a closing prompt that references the established style and ends with impact. Best for a dramatic final shot or brand moment.

2. "image-then-video" — Generate a reference image (matching the established style), then animate it. Best for precise product hero shots or branded end cards.

3. "edit-video" — Take the Scene 2 video and evolve it into a closing moment. Best when the closer should feel like Scene 2 naturally resolves.

CRITICAL: The closer must feel like the natural conclusion of Scenes 1 and 2. Maintain the same visual language. If there's a Call to Action (brand name, tagline, URL), incorporate it naturally.`;

const SCENE_SYSTEMS = [SCENE_1_SYSTEM, SCENE_2_SYSTEM, SCENE_3_SYSTEM];

// ─── Scene Decision Schema ───────────────────────────────────────────────────

function getDecisionSchema(sceneNumber: number, canEditVideo: boolean) {
    const methods: GenerationMethod[] = sceneNumber === 1
        ? ["text-to-video", "image-then-video"]
        : canEditVideo
            ? ["text-to-video", "image-then-video", "edit-video"]
            : ["text-to-video", "image-then-video"];

    return {
        type: "json_schema" as const,
        json_schema: {
            name: "scene_decision",
            strict: true,
            schema: {
                type: "object",
                properties: {
                    method: {
                        type: "string",
                        enum: methods,
                        description: "The generation method to use for this scene",
                    },
                    video_prompt: {
                        type: "string",
                        description: "Rich cinematic prompt for video generation or editing",
                    },
                    image_prompt: {
                        type: "string",
                        description:
                            "Prompt for reference image generation (required if method is image-then-video, empty string otherwise)",
                    },
                    reasoning: {
                        type: "string",
                        description: "Brief explanation of why this method was chosen",
                    },
                },
                required: ["method", "video_prompt", "image_prompt", "reasoning"],
                additionalProperties: false,
            },
        },
    };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sendEvent(
    controller: ReadableStreamDefaultController,
    encoder: TextEncoder,
    event: PipelineEvent,
) {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
}

const STEP_TIMEOUT_MS = 120_000; // 120 seconds per step
const POLL_INTERVAL_MS = 5_000;
const POLL_MAX_ATTEMPTS = 180; // 15 minutes at 5s interval
// Keep the route timeout slightly above the poll loop so we never cut it short.
const POLL_TIMEOUT_MS = POLL_INTERVAL_MS * POLL_MAX_ATTEMPTS + 30_000;

/** Wrap a promise with a timeout */
function withTimeout<T>(
    promise: Promise<T>,
    label: string,
    ms: number,
    onTimeout?: () => void,
): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(
            () => {
                try { onTimeout?.(); } catch { /* ignore */ }
                reject(new Error(`${label} timed out after ${ms / 1000}s`));
            },
            ms,
        );
        promise
            .then((v) => { clearTimeout(timer); resolve(v); })
            .catch((e) => { clearTimeout(timer); reject(e); });
    });
}

function withStepTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
    return withTimeout(promise, label, STEP_TIMEOUT_MS);
}

function withPollTimeout<T>(promise: Promise<T>, label: string, onTimeout?: () => void): Promise<T> {
    return withTimeout(promise, label, POLL_TIMEOUT_MS, onTimeout);
}

/**
 * Persist a temporary xAI URL to Vercel Blob so it doesn't expire.
 * Falls back to the original URL if Blob upload fails.
 */
async function persistToBlob(
    sourceUrl: string,
    filename: string,
): Promise<string> {
    try {
        console.log(`[blob] Fetching source: ${sourceUrl.slice(0, 80)}...`);
        const res = await fetch(sourceUrl);
        if (!res.ok) throw new Error(`Failed to fetch source: ${res.status}`);

        const contentType =
            res.headers.get("content-type") || "application/octet-stream";
        const blob = await res.blob();
        console.log(`[blob] Uploading ${filename} (${(blob.size / 1024).toFixed(1)} KB, ${contentType})`);

        const { url } = await put(filename, blob, {
            access: "public",
            contentType,
            addRandomSuffix: true,
        });
        console.log(`[blob] ✓ Persisted ${filename} → ${url.slice(0, 80)}...`);
        return url;
    } catch (err) {
        console.error(`[blob] ✗ Upload failed for ${filename}, using original URL:`, err);
        return sourceUrl;
    }
}

// ─── Main Pipeline ───────────────────────────────────────────────────────────

async function runPipeline(
    input: PipelineInput,
    controller: ReadableStreamDefaultController,
    encoder: TextEncoder,
) {
    const { concept, duration = 6, aspect_ratio = "16:9", resolution = "720p" } = input;
    console.log("[pipeline] ═══ STARTING ═══", { concept: concept.slice(0, 60), duration, aspect_ratio, resolution });
    const startTime = Date.now();
    const canEditVideo = duration <= 8; // xAI video edits require input videos <= 8.7s; be conservative.

    const sceneResults: Array<{
        videoUrl: string;
        method: GenerationMethod;
        decision: SceneDecision;
        imageUrl?: string;
    }> = [];

    for (let sceneNum = 1; sceneNum <= 3; sceneNum++) {
        const sceneStart = Date.now();
        console.log(`[pipeline] ─── Scene ${sceneNum}/3 START ───`);
        // ── Step 1: Plan ──
        sendEvent(controller, encoder, {
            type: "scene_planning",
            scene: sceneNum,
            message: `Grok is planning Scene ${sceneNum}...`,
        });

        // Build user message with context from previous scenes
        const userParts: Array<Record<string, unknown>> = [];
        const settingsText =
            `Settings: duration=${duration}s, aspect_ratio=${aspect_ratio}, resolution=${resolution}. IMPORTANT: Do not mention any other duration. If you mention seconds in the prompt, it MUST be exactly ${duration}s.` +
            (canEditVideo ? "" : ` NOTE: "edit-video" is not available at ${duration}s (xAI edits require input videos <= 8.7s).`);

        // Add reference images from previous scenes (only if we have an actual image URL).
        // Passing a video URL as an image input can 422 due to schema validation.
        for (const prev of sceneResults) {
            if (prev.imageUrl) {
                userParts.push({
                    type: "input_image",
                    image_url: { url: prev.imageUrl },
                    detail: "high",
                });
            }
            userParts.push({
                type: "input_text",
                text:
                    `[Scene ${sceneResults.indexOf(prev) + 1} — method: ${prev.method}]\n` +
                    `Video URL: ${prev.videoUrl}\n` +
                    `Prompt used: "${prev.decision.video_prompt}"`,
            });
        }

        userParts.push({
            type: "input_text",
            text: `Ad concept: ${concept}\n${settingsText}\n\nDecide the best generation method for Scene ${sceneNum} of 3.${sceneNum === 1
                ? " This is the HOOK — grab attention immediately."
                : sceneNum === 2
                    ? " This is the BODY — showcase the core message/product."
                    : " This is the CLOSER — leave a lasting impression with a CTA."
                }`,
        });

        const userContent =
            sceneResults.length > 0
                ? userParts
                : `Ad concept: ${concept}\n${settingsText}\n\nDecide the best generation method for Scene 1 of 3. This is the HOOK — grab attention immediately.`;

        const decision = await withStepTimeout(
            chatJSON<SceneDecision>({
                messages: [
                    { role: "system", content: SCENE_SYSTEMS[sceneNum - 1] },
                    {
                        role: "user",
                        content: userContent,
                    },
                ],
                temperature: 0.7,
                response_format: getDecisionSchema(sceneNum, canEditVideo),
            }),
            `Scene ${sceneNum} planning`,
        );

        console.log(`[pipeline] Scene ${sceneNum} decision:`, { method: decision.method, reasoning: decision.reasoning.slice(0, 100), video_prompt: decision.video_prompt.slice(0, 80) });

        sendEvent(controller, encoder, {
            type: "scene_planned",
            scene: sceneNum,
            message: `Scene ${sceneNum}: ${decision.method} — ${decision.reasoning}`,
            data: {
                method: decision.method,
                reasoning: decision.reasoning,
                video_prompt: decision.video_prompt,
                image_prompt: decision.image_prompt || undefined,
            },
        });

        // ── Step 2: Generate ──
        let videoRequestId: string;
        let imageUrl: string | undefined;

        switch (decision.method) {
            case "text-to-video": {
                sendEvent(controller, encoder, {
                    type: "video_submitted",
                    scene: sceneNum,
                    message: "Generating video from text...",
                });
                videoRequestId = await withStepTimeout(
                    submitTextToVideo({
                        prompt: decision.video_prompt,
                        duration,
                        aspect_ratio,
                        resolution,
                    }),
                    `Scene ${sceneNum} text-to-video submit`,
                );
                break;
            }

            case "image-then-video": {
                sendEvent(controller, encoder, {
                    type: "image_generating",
                    scene: sceneNum,
                    message: "Generating reference image...",
                });

                const imgResult = await withStepTimeout(
                    generateImage({
                        prompt: decision.image_prompt || decision.video_prompt,
                        aspect_ratio,
                    }),
                    `Scene ${sceneNum} image generation`,
                );
                // Persist image to Vercel Blob
                imageUrl = await persistToBlob(
                    imgResult.url,
                    `scene-${sceneNum}-ref.png`,
                );

                sendEvent(controller, encoder, {
                    type: "image_complete",
                    scene: sceneNum,
                    message: "Reference image ready. Generating video...",
                    data: { image_url: imageUrl },
                });

                videoRequestId = await withStepTimeout(
                    submitImageToVideo({
                        prompt: decision.video_prompt,
                        image_url: imageUrl,
                        duration,
                        aspect_ratio,
                        resolution,
                    }),
                    `Scene ${sceneNum} image-to-video submit`,
                );
                break;
            }

            case "edit-video": {
                const prevVideo = sceneResults[sceneResults.length - 1];
                if (!prevVideo) throw new Error("edit-video requires a previous scene");

                sendEvent(controller, encoder, {
                    type: "video_submitted",
                    scene: sceneNum,
                    message: "Editing previous scene...",
                });

                videoRequestId = await withStepTimeout(
                    submitVideoEdit({
                        prompt: decision.video_prompt,
                        video_url: prevVideo.videoUrl,
                    }),
                    `Scene ${sceneNum} video edit submit`,
                );
                break;
            }
        }

        // ── Step 3: Poll ──
        sendEvent(controller, encoder, {
            type: "video_polling",
            scene: sceneNum,
            message: "Waiting for video generation...",
        });

        const pollAbort = new AbortController();
        const videoResult = await withPollTimeout(
            pollVideo(
                videoRequestId,
                (state) => {
                    sendEvent(controller, encoder, {
                        type: "video_polling",
                        scene: sceneNum,
                        message: `Video status: ${state}`,
                    });
                },
                POLL_MAX_ATTEMPTS,
                POLL_INTERVAL_MS,
                pollAbort.signal,
            ),
            `Scene ${sceneNum} video polling`,
            () => pollAbort.abort(),
        );

        // Persist video to Vercel Blob
        console.log(`[pipeline] Scene ${sceneNum} video done, persisting to blob...`);
        const persistedVideoUrl = await persistToBlob(
            videoResult.url,
            `scene-${sceneNum}.mp4`,
        );

        sendEvent(controller, encoder, {
            type: "video_complete",
            scene: sceneNum,
            message: `Scene ${sceneNum} video ready!`,
            data: {
                video_url: persistedVideoUrl,
                video_duration: videoResult.duration,
                video_width: videoResult.width,
                video_height: videoResult.height,
            },
        });

        sceneResults.push({
            videoUrl: persistedVideoUrl,
            method: decision.method,
            decision,
            imageUrl,
        });

        sendEvent(controller, encoder, {
            type: "scene_complete",
            scene: sceneNum,
            message: `Scene ${sceneNum} complete`,
            data: {
                method: decision.method,
                reasoning: decision.reasoning,
                video_prompt: decision.video_prompt,
                image_prompt: decision.image_prompt || undefined,
                image_url: imageUrl,
                video_url: persistedVideoUrl,
                video_duration: videoResult.duration,
                video_width: videoResult.width,
                video_height: videoResult.height,
            },
        });

        console.log(`[pipeline] ─── Scene ${sceneNum}/3 COMPLETE (${((Date.now() - sceneStart) / 1000).toFixed(1)}s) ───`);
    }

    console.log(`[pipeline] ═══ ALL DONE (${((Date.now() - startTime) / 1000).toFixed(1)}s total) ═══`);

    sendEvent(controller, encoder, {
        type: "pipeline_complete",
        scene: 3,
        message: "All 3 scenes complete!",
    });
}

// ─── Route Handler (SSE) ────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
        return new Response(
            JSON.stringify({ error: "XAI_API_KEY is not configured" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
        );
    }

    let input: PipelineInput;
    try {
        input = await request.json();
        console.log("[pipeline] POST /api/pipeline received:", JSON.stringify(input).slice(0, 200));
    } catch {
        return new Response(
            JSON.stringify({ error: "Invalid JSON body" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
        );
    }

    if (!input.concept || typeof input.concept !== "string" || !input.concept.trim()) {
        return new Response(
            JSON.stringify({ error: "concept is required" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
        );
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            try {
                await runPipeline(input, controller, encoder);
            } catch (err) {
                const message = err instanceof Error ? err.message : "Pipeline failed";
                console.error("Pipeline error:", err);
                sendEvent(controller, encoder, {
                    type: "error",
                    scene: 0,
                    message,
                });
            } finally {
                controller.close();
            }
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
        },
    });
}
