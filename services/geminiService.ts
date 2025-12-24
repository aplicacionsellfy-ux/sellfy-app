import { GoogleGenAI } from "@google/genai";
import { WizardState, CampaignResult, ContentVariant, BusinessSettings, PlanTier, ContentType, Platform } from "../types";

// --- CONFIGURATION ---
const getGeminiKey = () => {
  // 1. Try standard Vite env var (VITE_API_KEY) - Works in dev and prod if VITE_ prefix used
  // @ts-ignore
  if (import.meta.env?.VITE_API_KEY) return import.meta.env.VITE_API_KEY;
  
  // 2. Try direct replacement from vite.config.ts (process.env.API_KEY) - Works for specific Vercel/Cloud configs
  try {
    // @ts-ignore
    // Vite replaces 'process.env.API_KEY' with the literal string value at build time.
    // We access it inside try/catch to handle cases where it's NOT replaced and process is undefined (browser).
    const key = process.env.API_KEY;
    if (key) return key;
  } catch (e) {
    // ReferenceError: process is not defined
  }
  
  return "";
};

const GEMINI_API_KEY = getGeminiKey();
const ai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

if (!GEMINI_API_KEY) {
    console.warn("⚠️ Gemini Service: No API Key found. AI features will fail.");
}

// Helper to sanitize JSON response
const cleanJsonText = (text: string | undefined): string => {
  if (!text) return '{}';
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
};

// --- GENERATORS ---

// 1. Copywriting Generator
const generateVariantCopy = async (state: WizardState, settings: BusinessSettings, angleDescription: string): Promise<{ copy: string, hashtags: string[] }> => {
  const { platform, productData } = state;
  
  // Default fallback
  const fallback = { 
    copy: `${productData.name} - ${productData.benefit} 🔥\n\n¡Consíguelo ahora!`, 
    hashtags: ["#sellfy", "#viral", "#fyp"] 
  };

  try {
    if (!ai) return fallback;

    const prompt = `
      ROLE: Expert Social Media Copywriter.
      TASK: Write a caption for "${productData.name}".
      PLATFORM: ${platform}.
      CONTEXT: ${angleDescription}.
      TONE: ${settings.tone}.
      BENEFIT: ${productData.benefit}.
      
      REQUIREMENTS:
      - Use AIDA framework.
      - Add emojis.
      - 3-5 hashtags.
      
      OUTPUT JSON: { "copy": "string", "hashtags": ["string"] }
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });

    const result = JSON.parse(cleanJsonText(response.text));
    return {
      copy: result.copy || fallback.copy,
      hashtags: result.hashtags || fallback.hashtags
    };
  } catch (error) {
    console.warn("Copy Gen Error:", error);
    return fallback;
  }
};

// 2. Image Generator (Adaptive Model Selection)
const generateWithGeminiImage = async (prompt: string, productData: any, plan: PlanTier): Promise<string | null> => {
    try {
        if (!ai) throw new Error("No Gemini Key");
        
        // Use Pro model only for 'pro' plan, otherwise standard flash model
        const isPro = plan === 'pro';
        const model = isPro ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';
        
        const parts: any[] = [];
        if (productData.baseImage) {
            const matches = productData.baseImage.match(/^data:([^;]+);base64,(.+)$/);
            if (matches) {
                parts.push({ inlineData: { mimeType: matches[1], data: matches[2] } });
            }
        }
        parts.push({ text: prompt });

        console.log(`🎨 Generating image with ${model}...`);
        
        const response = await ai.models.generateContent({
            model: model,
            contents: { parts },
            // Only send imageConfig for the Pro model which supports it
            config: isPro ? { imageConfig: { imageSize: '1K', aspectRatio: '1:1' } } : {}
        });

        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData?.data) return `data:image/png;base64,${part.inlineData.data}`;
        }
    } catch (e: any) {
        console.error("Gemini Image Gen Error:", e.message || e);
        
        // If Pro model fails (e.g. 403, 404, or not enabled), fallback to Flash
        if (plan === 'pro') {
            console.log("🔄 Retrying with Flash model...");
            return generateWithGeminiImage(prompt, productData, 'free');
        }
    }
    return null;
};

// 3. Video Generator (Veo)
const generateWithVeoText = async (prompt: string): Promise<string | null> => {
    try {
        if (!ai) throw new Error("No Gemini Key");
        
        console.log("🎥 Generating video with Veo...");
        let operation = await ai.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview', 
            prompt: prompt,
            config: {
                numberOfVideos: 1,
                resolution: '720p',
                aspectRatio: '9:16'
            }
        });

        // Poll for completion
        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 3000));
            // @ts-ignore
            operation = await ai.operations.getVideosOperation({ operation: operation });
        }
        
        // @ts-ignore
        const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
        // Append API Key for secure access to the video resource
        return videoUri ? `${videoUri}&key=${GEMINI_API_KEY}` : null;
    } catch (e) { 
        console.error("Veo Error:", e);
        return null; 
    }
};

// 4. Image-to-Video Animator
export const animateImageWithVeo = async (imageBase64: string): Promise<string | null> => {
    try {
        if (!ai) throw new Error("No Gemini Key");

        const matches = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
        if (!matches) throw new Error("Invalid image format");

        let operation = await ai.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview', 
            prompt: "Cinematic slow motion movement, high quality.",
            image: {
                imageBytes: matches[2],
                mimeType: matches[1]
            },
            config: {
                numberOfVideos: 1,
                resolution: '720p',
                aspectRatio: '1:1' 
            }
        });

        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 3000));
            // @ts-ignore
            operation = await ai.operations.getVideosOperation({ operation: operation });
        }
        
        // @ts-ignore
        const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
        return videoUri ? `${videoUri}&key=${GEMINI_API_KEY}` : null;

    } catch (e: any) {
        console.error("Animation Error:", e.message || e);
        return null;
    }
};

// --- MAIN ORCHESTRATOR ---

const generateVariantContent = async (index: number, angle: string, state: WizardState, settings: BusinessSettings, plan: PlanTier): Promise<ContentVariant> => {
    const { productData, platform, visualStyle, contentType } = state;
    
    const isVideoRequest = contentType === ContentType.VIDEO_REEL || platform === Platform.TIKTOK || platform === Platform.IG_REELS;

    const promptText = `
      Product: "${productData.name}" - ${productData.benefit}.
      Style: ${visualStyle}.
      Composition: ${angle}.
      Colors: ${settings.primaryColor}, ${settings.secondaryColor}.
      Vibe: ${settings.tone}.
    `;

    let mediaUrl: string | null = null;
    let isVideoResult = false;

    // 1. Generate Media
    if (isVideoRequest) {
        mediaUrl = await generateWithVeoText(`${promptText}. Cinematic lighting.`);
        isVideoResult = true;
    } else {
        mediaUrl = await generateWithGeminiImage(promptText, productData, plan);
    }

    // 2. Fallback Media
    if (!mediaUrl) {
         // Fallback to placeholder if AI fails
         mediaUrl = `https://placehold.co/1080x1080/1e293b/ffffff?text=${encodeURIComponent(productData.name || "Error")}`;
    }

    // 3. Generate Copy
    const textData = await generateVariantCopy(state, settings, angle);

    return {
        id: `var-${Date.now()}-${index}`,
        image: mediaUrl,
        isVideo: isVideoResult,
        copy: textData.copy,
        hashtags: textData.hashtags,
        angle: angle
    };
};

export const generateCampaign = async (state: WizardState, settings: BusinessSettings, plan: PlanTier): Promise<CampaignResult> => {
  const isVideo = state.contentType === ContentType.VIDEO_REEL || state.platform === Platform.TIKTOK || state.platform === Platform.IG_REELS;
  
  const angles = isVideo ? ["Dynamic Reveal", "Lifestyle Use", "Cinematic Atmosphere", "Creative Details"] 
                         : ["Studio Hero Shot", "Lifestyle Context", "Creative Composition", "Detail Focus"];

  console.log(`🚀 Starting campaign gen. Plan: ${plan}`);

  const variants: ContentVariant[] = [];
  
  // Generate variants sequentially to avoid rate limits
  for (let i = 0; i < angles.length; i++) {
      const variant = await generateVariantContent(i, angles[i], state, settings, plan);
      variants.push(variant);
      // Small delay between requests
      if (i < angles.length - 1) await new Promise(r => setTimeout(r, 500));
  }

  return {
    id: `camp-${Date.now()}`,
    timestamp: Date.now(),
    platform: state.platform!,
    variants: variants
  };
};