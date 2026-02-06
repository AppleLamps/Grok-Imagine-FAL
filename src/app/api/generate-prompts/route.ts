import { NextRequest, NextResponse } from "next/server";

const XAI_API_URL = "https://api.x.ai/v1/chat/completions";

const SYSTEM_PROMPT_TEXT = `You are an expert video ad creative director. Given a master concept for an advertisement, you must generate exactly 3 detailed video clip prompts that together form a cohesive ad sequence.

Each prompt should be a rich, cinematic description optimized for AI video generation. Include:
- Camera movement and angles (tracking shot, close-up, aerial, handheld, etc.)
- Lighting and atmosphere (golden hour, neon, dramatic shadows, soft diffused, etc.)
- Motion and action details (what moves, how fast, direction)
- Visual style and mood (cinematic, documentary, minimalist, energetic, etc.)
- Color palette hints
- Specific details that make the scene vivid

The 3 clips should flow as a narrative sequence:
- Clip 1: The hook / opening — grabs attention immediately
- Clip 2: The core message / product showcase — delivers the value
- Clip 3: The closer / call-to-action — leaves a lasting impression

Respond with ONLY valid JSON in this exact format, no markdown fences:
{
  "clip_1": "detailed prompt for clip 1...",
  "clip_2": "detailed prompt for clip 2...",
  "clip_3": "detailed prompt for clip 3..."
}`;

const SYSTEM_PROMPT_IMAGE = `You are an expert video ad creative director. You will be given a master concept for an advertisement along with 1-3 reference images. Analyze each image carefully and generate exactly 3 detailed video clip prompts that together form a cohesive ad sequence.

Each prompt should describe the MOTION, CAMERA MOVEMENT, and ACTION you want to see in a video generated from that image. The images will be used as the starting frames for AI video generation, so your prompts should describe:
- How the scene should move and evolve from the starting image
- Camera movement (slow zoom in, tracking shot, orbit, pull back, etc.)
- Subject motion (walking, turning, particles flowing, liquid pouring, etc.)
- Lighting shifts and atmospheric changes
- Pace and energy of the motion
- Any text or overlay animation

IMPORTANT: If fewer than 3 images are provided, reuse images across clips as needed. For example, if 1 image is given, use it for all 3 clips with different motion directions. If 2 images are given, use image 1 for clips 1-2 and image 2 for clip 3 (or similar creative assignment).

The 3 clips should flow as a narrative sequence:
- Clip 1: The hook / opening — grabs attention with dynamic motion
- Clip 2: The core message / product showcase — controlled, elegant motion
- Clip 3: The closer / call-to-action — impactful final movement

Respond with ONLY valid JSON in this exact format, no markdown fences:
{
  "clip_1": "detailed motion prompt for clip 1...",
  "clip_2": "detailed motion prompt for clip 2...",
  "clip_3": "detailed motion prompt for clip 3...",
  "image_assignment": [1, 2, 3]
}

The "image_assignment" array maps each clip (index 0-2) to which image number (1-indexed) should be used for that clip. For example [1, 1, 2] means clips 1 and 2 use image 1, clip 3 uses image 2.`;

export async function POST(request: NextRequest) {
  const apiKey = process.env.XAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "XAI_API_KEY is not configured" },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { masterPrompt, images } = body as {
      masterPrompt: string;
      images?: string[]; // base64 data URIs or URLs
    };

    if (!masterPrompt || typeof masterPrompt !== "string") {
      return NextResponse.json(
        { error: "masterPrompt is required" },
        { status: 400 }
      );
    }

    const hasImages = images && Array.isArray(images) && images.length > 0;

    // Build message content
    let userContent: string | Array<Record<string, unknown>>;

    if (hasImages) {
      // Use multimodal content with image understanding
      const contentParts: Array<Record<string, unknown>> = [];

      // Add each image
      for (let i = 0; i < images.length; i++) {
        contentParts.push({
          type: "input_image",
          image_url: images[i],
          detail: "high",
        });
        contentParts.push({
          type: "input_text",
          text: `[Image ${i + 1} of ${images.length}]`,
        });
      }

      // Add the master prompt
      contentParts.push({
        type: "input_text",
        text: `Master ad concept: ${masterPrompt}\n\nI have provided ${images.length} image(s). Generate 3 clip prompts describing motion/action for image-to-video generation, and assign each clip to the most appropriate image.`,
      });

      userContent = contentParts;
    } else {
      userContent = `Master ad concept: ${masterPrompt}`;
    }

    const response = await fetch(XAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4-1-fast-reasoning",
        messages: [
          {
            role: "system",
            content: hasImages ? SYSTEM_PROMPT_IMAGE : SYSTEM_PROMPT_TEXT,
          },
          {
            role: "user",
            content: userContent,
          },
        ],
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("xAI API error:", response.status, errorText);
      return NextResponse.json(
        { error: `xAI API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json(
        { error: "No response from xAI" },
        { status: 500 }
      );
    }

    // Parse the JSON response — strip markdown fences if present
    const cleaned = content
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();

    const parsed = JSON.parse(cleaned);

    // Validate shape
    if (!parsed.clip_1 || !parsed.clip_2 || !parsed.clip_3) {
      return NextResponse.json(
        { error: "Invalid response format from xAI" },
        { status: 500 }
      );
    }

    const result: {
      prompts: string[];
      imageAssignment?: number[];
    } = {
      prompts: [parsed.clip_1, parsed.clip_2, parsed.clip_3],
    };

    // Include image assignment if present (for I2V mode)
    if (
      hasImages &&
      parsed.image_assignment &&
      Array.isArray(parsed.image_assignment)
    ) {
      // Convert from 1-indexed to 0-indexed
      result.imageAssignment = parsed.image_assignment.map(
        (n: number) => n - 1
      );
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("Generate prompts error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to generate prompts",
      },
      { status: 500 }
    );
  }
}
