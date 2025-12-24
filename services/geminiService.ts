
import { GoogleGenAI } from "@google/genai";
import { WizardState, CampaignResult, ContentVariant, BusinessSettings, PlanTier, ContentType, Platform } from "../types";

// --- CONFIGURATION ---
const getGeminiKey = () => {
  // @ts-ignore
  if (import.meta.env?.VITE_API_KEY) return import.meta.env.VITE_API_KEY;
  try {
    // @ts-ignore
    const key = process.env.API_KEY;
    if (key) return key;
  } catch (e) {}
  return "";
};

const GEMINI_API_KEY = getGeminiKey();
const ai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

if (!GEMINI_API_KEY) {
    console.warn("⚠️ IA Service: No API Key found.");
}

const cleanJsonText = (text: string | undefined): string => {
  if (!text) return '{}';
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
};

// --- GENERATORS ---

// 1. Copywriting Generator
const generateVariantCopy = async (state: WizardState, settings: BusinessSettings, angleDescription: string): Promise<{ copy: string, hashtags: string[] }> => {
  const { platform, productData } = state;
  
  const fallback = { 
    copy: `${productData.name} - ${productData.benefit} 🔥\n\n${productData.description}\n\n¡Consíguelo ahora!`, 
    hashtags: ["#sellfy", "#viral", "#fyp"] 
  };

  try {
    if (!ai) return fallback;

    const prompt = `
      ROLE: Expert Social Media Copywriter.
      TASK: Write a persuasive caption for "${productData.name}".
      
      PRODUCT INFO:
      - Description: ${productData.description}
      - Main Benefit: ${productData.benefit}
      - Offer: ${productData.promoDetails || 'N/A'}
      - Price/Info: ${productData.price || 'N/A'}
      
      CONTEXT:
      - Platform: ${platform}
      - Visual Angle: ${angleDescription}
      - Tone: ${settings.tone}
      - Audience: ${productData.targetAudience || settings.targetAudience}

      REQUIREMENTS:
      - Use AIDA framework (Attention, Interest, Desire, Action).
      - Add relevant emojis.
      - If an OFFER is present ("${productData.promoDetails}"), mention it explicitly and urgently.
      - If PRICE is present ("${productData.price}"), include it naturally.
      - 3-5 high traffic hashtags.
      - Language: Spanish (Native).
      
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

// 2. Image Generator (High Fidelity Logic)
const generateWithGeminiImage = async (prompt: string, productData: any, plan: PlanTier, visualStyle: string): Promise<string | null> => {
    try {
        if (!ai) throw new Error("No AI Key");
        
        const isPro = plan === 'pro';
        const model = isPro ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';
        
        const parts: any[] = [];
        let finalPrompt = "";

        // Text Overlay Logic
        const textOverlayInstruction = (productData.promoDetails || productData.price) 
          ? `TEXT RENDERING: Try to include visible text in the scene if natural. 
             Offer Text: "${productData.promoDetails || ''}" 
             Price Text: "${productData.price || ''}". 
             Ensure text is legible and integrated into the ${visualStyle} style.` 
          : "";

        if (productData.baseImage) {
            const matches = productData.baseImage.match(/^data:([^;]+);base64,(.+)$/);
            if (matches) {
                parts.push({ inlineData: { mimeType: matches[1], data: matches[2] } });
                
                // CRITICAL PROMPT FOR FIDELITY
                finalPrompt = `
                  ROLE: Professional Product Photographer & Retoucher.
                  TASK: Background Replacement & Environment Compositing.
                  
                  STRICT CONSTRAINT: 
                  - KEEP THE PRODUCT (Subject) EXACTLY AS IT IS in the input image. 
                  - DO NOT change the product logo, text, shape, or color.
                  - Only improve lighting and resolution of the product (Upscaling).
                  
                  NEW ENVIRONMENT:
                  - Create a ${visualStyle} background.
                  - Context: ${prompt}.
                  - Lighting: Professional studio lighting matching the product.
                  - Integration: Ensure realistic shadows and reflections on the surface.
                  
                  ${textOverlayInstruction}
                `;
            }
        } else {
             // Generative Fallback if no image provided
             finalPrompt = `
               Professional commercial photography of ${productData.name}.
               Description: ${productData.description}.
               Style: ${visualStyle}.
               Setting: ${prompt}.
               Lighting: Studio quality, 8k resolution.
               ${textOverlayInstruction}
             `;
        }

        console.log(`🎨 Generando imagen con IA...`);
        parts.push({ text: finalPrompt });
        
        const response = await ai.models.generateContent({
            model: model,
            contents: { parts },
            config: isPro ? { imageConfig: { imageSize: '1K', aspectRatio: '1:1' } } : {}
        });

        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData?.data) return `data:image/png;base64,${part.inlineData.data}`;
        }
    } catch (e: any) {
        console.error("AI Gen Error:", e.message || e);
        if (plan === 'pro') {
            return generateWithGeminiImage(prompt, productData, 'free', visualStyle);
        }
    }
    return null;
};

// 3. Video Generator
const generateWithVeoText = async (prompt: string): Promise<string | null> => {
    try {
        if (!ai) throw new Error("No AI Key");
        
        console.log("🎥 Generando video...");
        let operation = await ai.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview', 
            prompt: prompt,
            config: {
                numberOfVideos: 1,
                resolution: '720p',
                aspectRatio: '9:16'
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
    } catch (e) { 
        console.error("Video Gen Error:", e);
        return null; 
    }
};

// 4. Image Animation
export const animateImageWithVeo = async (imageBase64: string): Promise<string | null> => {
    try {
        if (!ai) throw new Error("No AI Key");

        const matches = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
        if (!matches) throw new Error("Invalid format");

        let operation = await ai.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview', 
            prompt: "Slow motion cinematic camera movement, enhance lighting, keep product static and sharp.",
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

    // Richer prompt construction for background context
    const promptContext = `
      Composition: ${angle}.
      Product Context: ${productData.description}.
      Platform Aesthetic: ${platform}.
      Brand Colors: ${settings.primaryColor}, ${settings.secondaryColor}.
    `;

    let mediaUrl: string | null = null;
    let isVideoResult = false;

    if (isVideoRequest) {
        mediaUrl = await generateWithVeoText(`Cinematic video of ${productData.name} in a ${visualStyle} environment. ${promptContext}`);
        isVideoResult = true;
    } else {
        mediaUrl = await generateWithGeminiImage(promptContext, productData, plan, visualStyle || 'Studio');
    }

    if (!mediaUrl) {
         mediaUrl = `https://placehold.co/1080x1080/1e293b/ffffff?text=${encodeURIComponent(productData.name || "Error")}`;
    }

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
  
  const angles = isVideo ? ["Dynamic Reveal", "Lifestyle Usage", "Cinematic Mood", "Product Details"] 
                         : ["Hero Shot (Centered)", "Lifestyle Context", "Creative Angle", "Close-up Detail"];

  console.log(`🚀 Iniciando campaña...`);

  const variants: ContentVariant[] = [];
  
  for (let i = 0; i < angles.length; i++) {
      const variant = await generateVariantContent(i, angles[i], state, settings, plan);
      variants.push(variant);
      if (i < angles.length - 1) await new Promise(r => setTimeout(r, 500));
  }

  return {
    id: `camp-${Date.now()}`,
    timestamp: Date.now(),
    platform: state.platform!,
    variants: variants
  };
};
