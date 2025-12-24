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
    // Manejo inteligente de Rate Limits (Error 429)
    const waitTime = error.message?.includes('429') || error.message?.includes('quota') ? delay * 3 : delay;
    console.warn(`⚠️ API Limit hit. Retrying in ${waitTime}ms...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
    return retryOperation(operation, retries - 1, delay * 2);
  }
}

const cleanJsonText = (text: string | undefined): string => {
  if (!text) return '{}';
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
};

// --- COPYWRITING DE ALTA CONVERSIÓN (FrameWork AIDA/PAS) ---
const generateVariantCopy = async (state: WizardState, settings: BusinessSettings, angleDescription: string): Promise<{ copy: string, hashtags: string[] }> => {
  const { platform, productData } = state;
  
  // Prompt diseñado para ventas directas, evitando lenguaje genérico de IA
  const prompt = `
    ROLE: World-Class Direct Response Copywriter.
    TASK: Write a persuasive social media caption for the product "${productData.name}".
    LANGUAGE: Spanish (Native, persuasive, natural).
    
    PRODUCT DETAILS:
    - Main Benefit: "${productData.benefit}"
    - Offer/Promo: "${productData.promoDetails || 'N/A'}"
    - Audience: "${productData.targetAudience || settings.targetAudience}"
    - Brand Tone: "${settings.tone}"
    - Visual Context: "${angleDescription}"
    - Platform: "${platform}"

    MANDATORY FRAMEWORK (Use AIDA):
    1. ATTENTION (Hook): Stop the scroll with a bold statement or question.
    2. INTEREST: Elaborate on the problem/solution.
    3. DESIRE: Highlight the transformation/benefit (not just features).
    4. ACTION (CTA): Clear instruction on what to do next.

    RULES:
    - NO robotic intros like "Presentamos", "Descubre", "En este post". Start directly with the hook.
    - Use 2-4 relevant emojis.
    - Keep paragraphs short (mobile optimized).
    - If there is a promo, create urgency.

    OUTPUT FORMAT (JSON ONLY):
    { 
      "copy": "Full caption text...", 
      "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"] 
    }
  `;

  try {
    if (!ai) throw new Error("Gemini API Key missing");
    
    // Usamos Flash para el texto por ser rápido y excelente en razonamiento lógico
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

// --- GENERACIÓN DE IMAGEN (GEMINI 3 PRO / FLASH IMAGE) ---
const generateWithGeminiImage = async (prompt: string, productData: any): Promise<string | null> => {
    if (!ai) throw new Error("No Gemini Key");
    
    const parts: any[] = [];

    // Usamos Gemini 3 Pro para máxima fidelidad
    const model = 'gemini-3-pro-image-preview'; 
    
    if (productData.baseImage) {
        const matches = productData.baseImage.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
            parts.push({ inlineData: { mimeType: matches[1], data: matches[2] } });
            
            // Prompt de Ingeniería para mantener fidelidad del producto
            prompt = `
              CRITICAL TASK: Product placement / Compositing.
              1. ANALYZE the input image. Isolate the main product.
              2. KEEP THE PRODUCT EXACTLY AS IT IS. Do not change logos, text, shapes, or colors.
              3. GENERATE a new background based on this description: "${prompt}".
              4. INTEGRATE the product naturally with correct lighting and shadows matching the new scene.
              5. OUTPUT: High-resolution commercial photography.
            `;
        }
    } else {
       prompt = `Professional commercial photography of ${prompt}. 8k resolution, highly detailed, photorealistic.`;
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

        // Veo Fast para animaciones rápidas
        let operation = await ai.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview', 
            prompt: "Cinematic slow motion pan, enhancing lighting and product details. Professional commercial look.",
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

        // Polling para esperar el video
        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 5000));
            // @ts-ignore
            operation = await ai.operations.getVideosOperation({ operation: operation });
        }
        
        // @ts-ignore
        const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
        
        // IMPORTANTE: Añadir API Key para descargar el binario
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
                aspectRatio: '9:16' // Vertical para Reels/TikTok
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
      Angle/Composition: ${angle}.
      Brand Colors: ${settings.primaryColor}, ${settings.secondaryColor}.
      Atmosphere: Professional advertisement, 4k, highly detailed.
    `;

    let mediaUrl: string | null = null;
    let isVideoResult = false;

    // --- LÓGICA DE GENERACIÓN ---
    if (isVideoRequest) {
        // Generación de Video Nativo (Veo)
        mediaUrl = await generateWithVeoText(`${promptText}. Cinematic lighting, slow motion movement.`);
        isVideoResult = true;
    } else {
        // Generación de Imagen (Gemini)
        // Ya sea con imagen base o sin ella, llamamos a la misma función unificada
        mediaUrl = await generateWithGeminiImage(promptText, productData);
    }

    // Fallback de Error visual
    if (!mediaUrl) {
         mediaUrl = `https://placehold.co/1080x1080/222/fff?text=${encodeURIComponent("Error IA")}`;
    }

    // Generación de Texto en paralelo (o secuencial si quieres ahorrar rate limit)
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
  
  const angles = isVideo ? [
    "Dynamic Reveal (Motion)",
    "Lifestyle Use (Action)",
    "Creative Macro (Details)",
    "Cinematic Atmosphere"
  ] : [
    "Studio Hero Shot (Clean)",
    "Lifestyle Context (Real)",
    "Creative Composition (Artistic)",
    "Detail/Texture Focus"
  ];

  console.log(`🚀 Iniciando campaña con Gemini & Veo...`);

  // Ejecutamos secuencialmente con un pequeño delay para proteger la API Key de Rate Limits
  // en cuentas Tier Free/Starter.
  const variants: ContentVariant[] = [];
  for (let i = 0; i < angles.length; i++) {
      const variant = await generateVariantContent(i, angles[i], state, settings);
      variants.push(variant);
      // Pequeña pausa entre generaciones
      if (i < angles.length - 1) await new Promise(r => setTimeout(r, 1000));
  }

  return {
    id: `camp-${Date.now()}`,
    timestamp: Date.now(),
    platform: state.platform!,
    variants: variants
  };
};