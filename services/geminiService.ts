
import { GoogleGenAI } from "@google/genai";
import { WizardState, CampaignResult, ContentVariant, BusinessSettings, PlanTier, ContentType, Platform } from "../types";

// --- GESTIÓN DE CLAVES API ---
const getGeminiKey = () => {
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_KEY) return import.meta.env.VITE_API_KEY;
  // @ts-ignore
  if (typeof process !== 'undefined' && process.env?.API_KEY) return process.env.API_KEY;
  return "";
};

const GEMINI_API_KEY = getGeminiKey();
const ai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

// --- UTILIDADES ---
async function retryOperation<T>(operation: () => Promise<T>, retries = 2, delay = 1000): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    if (retries <= 0) throw error;
    // Manejo inteligente de Rate Limits
    const waitTime = error.message?.includes('429') || error.message?.includes('quota') ? delay * 3 : delay;
    await new Promise(resolve => setTimeout(resolve, waitTime));
    return retryOperation(operation, retries - 1, delay * 2);
  }
}

const cleanJsonText = (text: string | undefined): string => {
  if (!text) return '{}';
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
};

// --- COPYWRITING (AIDA/PAS) ---
const generateVariantCopy = async (state: WizardState, settings: BusinessSettings, angleDescription: string): Promise<{ copy: string, hashtags: string[] }> => {
  const { platform, productData } = state;
  
  const prompt = `
    ROLE: World-Class Direct Response Copywriter.
    TASK: Write a persuasive social media caption for the product "${productData.name}".
    LANGUAGE: Spanish (Native, persuasive, natural).
    
    PRODUCT DETAILS:
    - Main Benefit: "${productData.benefit}"
    - Offer/Promo: "${productData.promoDetails || 'N/A'}"
    - Audience: "${productData.targetAudience || settings.targetAudience}"
    - Tone: "${settings.tone}"
    - Context: "${angleDescription}"
    - Platform: "${platform}"

    MANDATORY FRAMEWORK (Use AIDA):
    1. ATTENTION (Hook): Stop the scroll.
    2. INTEREST: Elaborate on the problem/solution.
    3. DESIRE: Highlight the transformation.
    4. ACTION (CTA): Clear instruction.

    OUTPUT FORMAT (JSON ONLY):
    { 
      "copy": "Full caption text...", 
      "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"] 
    }
  `;

  try {
    if (!ai) throw new Error("Gemini API Key missing");
    
    const response = await retryOperation(() => ai.models.generateContent({
      model: 'gemini-2.5-flash', 
      contents: prompt,
      config: { 
        responseMimeType: 'application/json',
        temperature: 0.85 
      }
    }));
    
    const result = JSON.parse(cleanJsonText(response.text));
    return {
      copy: result.copy,
      hashtags: result.hashtags || []
    };
  } catch (error) {
    console.error("Copy Gen Error:", error);
    return { 
      copy: `🔥 ${productData.name}\n\n${productData.benefit}\n\n¡Haz tu pedido hoy mismo! 👇`, 
      hashtags: ["#sellfy", "#tendencia", "#oferta"] 
    };
  }
};

// --- GENERACIÓN DE IMAGEN (GEMINI 3 PRO) ---
const generateWithGeminiImage = async (prompt: string, productData: any): Promise<string | null> => {
    if (!ai) throw new Error("No Gemini Key");
    
    const parts: any[] = [];
    // Usamos Gemini 3 Pro para máxima fidelidad
    const model = 'gemini-3-pro-image-preview'; 
    
    if (productData.baseImage) {
        const matches = productData.baseImage.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
            parts.push({ inlineData: { mimeType: matches[1], data: matches[2] } });
            
            prompt = `
              CRITICAL TASK: Product placement.
              1. ANALYZE the input image. Isolate the main product.
              2. KEEP THE PRODUCT EXACTLY AS IT IS.
              3. GENERATE a new background: "${prompt}".
              4. INTEGRATE the product naturally.
              5. OUTPUT: High-resolution commercial photography.
            `;
        }
    } else {
       prompt = `Professional commercial photography of ${prompt}. 8k resolution, highly detailed.`;
    }

    parts.push({ text: prompt });
    
    try {
        const response = await retryOperation(() => ai.models.generateContent({
            model: model,
            contents: { parts },
            config: { 
                imageConfig: { imageSize: '1K', aspectRatio: '1:1' }
            }
        }));

        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData?.data) return `data:image/png;base64,${part.inlineData.data}`;
        }
    } catch (e) {
        console.error("Gemini Image Gen Error:", e);
    }
    return null;
};

// --- ANIMACIÓN DE IMAGEN A VIDEO (GOOGLE VEO) ---
export const animateImageWithVeo = async (imageBase64: string): Promise<string | null> => {
    if (!ai) throw new Error("No Gemini Key");

    console.log("🎥 Animando imagen con Veo...");
    
    try {
        const matches = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
        if (!matches) throw new Error("Formato de imagen inválido");

        let operation = await ai.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview', 
            prompt: "Cinematic slow motion pan, enhancing lighting and product details.",
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
            await new Promise(resolve => setTimeout(resolve, 5000));
            // @ts-ignore
            operation = await ai.operations.getVideosOperation({ operation: operation });
        }
        
        // @ts-ignore
        const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
        return videoUri ? `${videoUri}&key=${GEMINI_API_KEY}` : null;

    } catch (e) {
        console.error("Error animando imagen:", e);
        return null;
    }
};

// --- GENERACIÓN DE VIDEO TEXT-TO-VIDEO (GOOGLE VEO) ---
const generateWithVeoText = async (prompt: string): Promise<string | null> => {
    if (!ai) throw new Error("No Gemini Key");
    
    try {
        console.log("🎥 Generando video Veo Text-to-Video...");
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
            await new Promise(resolve => setTimeout(resolve, 5000));
            // @ts-ignore
            operation = await ai.operations.getVideosOperation({ operation: operation });
        }
        // @ts-ignore
        const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
        return videoUri ? `${videoUri}&key=${GEMINI_API_KEY}` : null;
    } catch (e) { 
        console.error("Error Veo Text:", e);
        return null; 
    }
};

// --- ORQUESTADOR PRINCIPAL ---
const generateVariantContent = async (index: number, angle: string, state: WizardState, settings: BusinessSettings): Promise<ContentVariant> => {
    const { productData, platform, visualStyle, contentType } = state;
    
    const isVideoRequest = contentType === ContentType.VIDEO_REEL || platform === Platform.TIKTOK || platform === Platform.IG_REELS;

    const promptText = `
      Product: "${productData.name}" - ${productData.benefit}.
      Style: ${visualStyle}.
      Angle: ${angle}.
      Brand Colors: ${settings.primaryColor}, ${settings.secondaryColor}.
    `;

    let mediaUrl: string | null = null;
    let isVideoResult = false;

    if (isVideoRequest) {
        mediaUrl = await generateWithVeoText(`${promptText}. Cinematic lighting, slow motion movement.`);
        isVideoResult = true;
    } else {
        mediaUrl = await generateWithGeminiImage(promptText, productData);
    }

    if (!mediaUrl) {
         mediaUrl = `https://placehold.co/1080x1080/222/fff?text=${encodeURIComponent("Error IA")}`;
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

export const generateCampaign = async (state: WizardState, settings: BusinessSettings, _plan: PlanTier): Promise<CampaignResult> => {
  const isVideo = state.contentType === ContentType.VIDEO_REEL || state.platform === Platform.TIKTOK || state.platform === Platform.IG_REELS;
  
  const angles = isVideo ? ["Dynamic Reveal", "Lifestyle Use", "Cinematic Atmosphere", "Creative Details"] 
                         : ["Studio Hero Shot", "Lifestyle Context", "Creative Composition", "Detail Focus"];

  console.log(`🚀 Iniciando campaña con Gemini & Veo...`);

  const variants: ContentVariant[] = [];
  for (let i = 0; i < angles.length; i++) {
      const variant = await generateVariantContent(i, angles[i], state, settings);
      variants.push(variant);
      if (i < angles.length - 1) await new Promise(r => setTimeout(r, 1000));
  }

  return {
    id: `camp-${Date.now()}`,
    timestamp: Date.now(),
    platform: state.platform!,
    variants: variants
  };
};
