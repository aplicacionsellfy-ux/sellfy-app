import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { WizardState, CampaignResult, ContentVariant, BusinessSettings, PlanTier } from "../types";

// --- UTILIDADES ---
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- INICIALIZACIÓN ROBUSTA DEL CLIENTE ---
const getClient = () => {
  // @ts-ignore
  let key = import.meta.env.VITE_API_KEY;
  if (!key) {
    try {
      // @ts-ignore
      key = process.env.API_KEY;
    } catch (e) {}
  }
  if (!key) {
    try {
      // @ts-ignore
      key = import.meta.env.API_KEY;
    } catch (e) {}
  }

  if (!key) {
    console.error("⛔ FATAL: No se encontró ninguna API Key válida en el entorno.");
    return null;
  }

  return new GoogleGenAI({ apiKey: key });
};

const ai = getClient();

// --- SEGURIDAD TEXTO ---
const TEXT_SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

const cleanJsonText = (text: string | undefined): string => {
  if (!text) return '{}';
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
};

// --- GENERAR COPY ---
const generateVariantCopy = async (state: WizardState, settings: BusinessSettings, angleDescription: string): Promise<{ copy: string, hashtags: string[] }> => {
  const { platform, productData } = state;
  const audience = productData.targetAudience || settings.targetAudience || 'General';

  const prompt = `
    ROL: Copywriter experto.
    TAREA: Escribir un caption para redes sociales.
    PRODUCTO: "${productData.name}" (${productData.benefit}).
    
    DATOS:
    - Plataforma: ${platform}
    - Tono: ${settings.tone}
    - Audiencia: ${audience}
    - Estilo: ${angleDescription}

    SALIDA JSON OBLIGATORIA:
    { "copy": "texto...", "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"] }
  `;

  try {
    if (!ai) throw new Error("Cliente IA no inicializado");

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash', 
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        safetySettings: TEXT_SAFETY_SETTINGS,
      }
    });

    const result = JSON.parse(cleanJsonText(response.text));
    return {
      copy: result.copy || `${productData.name} 🔥\n\n${productData.benefit}`,
      hashtags: result.hashtags || ["#sellfy", "#promo"]
    };
  } catch (error) {
    return {
      copy: `¡Descubre ${productData.name}! ✨\n\n${productData.benefit}.`,
      hashtags: ["#nuevo", "#trend"]
    };
  }
};

// --- GENERAR IMAGEN ---
const generateVariantImage = async (state: WizardState, settings: BusinessSettings, angleDescription: string, plan: PlanTier): Promise<string | null> => {
  const { contentType, platform, visualStyle, productData } = state;
  
  if (!platform) return null;

  // 1. Definición del Prompt
  let promptText = `
    Professional product photography of "${productData.name}".
    Feature: ${productData.benefit}.
    Style: ${visualStyle}, ${contentType}.
    Composition: ${angleDescription}.
    Colors: ${settings.primaryColor}, ${settings.secondaryColor}.
    Lighting: Professional studio lighting, photorealistic.
  `;
  
  if (platform.includes('Stories') || platform.includes('Catalog')) {
     promptText += " Vertical 9:16 aspect ratio.";
  } else {
     promptText += " Square 1:1 aspect ratio.";
  }

  const parts: any[] = [];
  if (productData.baseImage) {
    const matches = productData.baseImage.match(/^data:([^;]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      parts.push({
        inlineData: { mimeType: matches[1], data: matches[2] }
      });
      promptText = `Use reference image. ${promptText}`;
    }
  }
  parts.push({ text: promptText });

  // 2. Función auxiliar interna
  const tryGenerate = async (model: string): Promise<string | null> => {
    try {
      if (!ai) return null;
      
      const isProModel = model.includes('pro');
      const config = isProModel ? { imageConfig: { imageSize: '1K' } } : {};

      console.log(`🎨 Generando (${model})...`);
      
      const response = await ai.models.generateContent({
        model: model,
        contents: { parts },
        // @ts-ignore
        config: config
      });

      if (response.candidates && response.candidates.length > 0) {
        const candidate = response.candidates[0];
        if (candidate.content && candidate.content.parts) {
          for (const part of candidate.content.parts) {
            if (part.inlineData && part.inlineData.data) {
              return `data:image/png;base64,${part.inlineData.data}`;
            }
          }
        }
      }
      return null;
    } catch (error: any) {
      // Lanzamos el error para que el orquestador sepa si fue un 429
      throw error;
    }
  };

  // 3. Estrategia de Selección de Modelo
  const primaryModel = plan === 'pro' ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';
  const fallbackModel = 'gemini-2.5-flash-image';

  try {
    return await tryGenerate(primaryModel);
  } catch (error: any) {
    // Si es un error de cuota (429), lo lanzamos arriba para activar el Circuit Breaker
    if (error.message?.includes('429') || error.message?.includes('quota') || error.message?.includes('RESOURCE_EXHAUSTED')) {
        throw new Error("QUOTA_EXCEEDED");
    }

    // Si es otro error y el modelo primario no era el fallback, intentamos fallback
    if (primaryModel !== fallbackModel) {
      try {
        console.log("🔄 Fallback a Flash...");
        return await tryGenerate(fallbackModel);
      } catch (fallbackError: any) {
        if (fallbackError.message?.includes('429')) throw new Error("QUOTA_EXCEEDED");
      }
    }
  }
  
  return null;
};

// --- ORQUESTADOR INTELIGENTE (CIRCUIT BREAKER) ---
export const generateCampaign = async (state: WizardState, settings: BusinessSettings, plan: PlanTier): Promise<CampaignResult> => {
  const angles = [
    "Studio Hero Shot",
    "Lifestyle Context",
    "Creative Lighting",
    "Detail Macro"
  ];

  console.log(`🚀 Iniciando Campaña...`);

  const variants: ContentVariant[] = [];
  let circuitBreakerTripped = false; // Si esto es true, dejamos de pedir imágenes

  for (let i = 0; i < angles.length; i++) {
    const angle = angles[i];
    
    // Pausa dinámica: 5 segundos para la API gratuita
    if (i > 0) {
       await wait(5000); 
    }

    let imageResult: string | null = null;
    let textResult = { copy: "Cargando...", hashtags: [] as string[] };

    // 1. Intentamos generar COPY (Barato, rara vez falla)
    textResult = await generateVariantCopy(state, settings, angle);

    // 2. Intentamos generar IMAGEN (Solo si no ha saltado el disyuntor)
    if (!circuitBreakerTripped) {
      try {
        imageResult = await generateVariantImage(state, settings, angle, plan);
      } catch (error: any) {
        if (error.message === "QUOTA_EXCEEDED") {
          console.warn("⚠️ Límite de cuota alcanzado. Deteniendo generación de imágenes restantes.");
          circuitBreakerTripped = true; // ACTIVAR CIRCUIT BREAKER
        } else {
          console.error(`Error imagen var ${i}:`, error);
        }
      }
    } else {
        console.log(`⏩ Saltando imagen ${i} por límite de cuota.`);
    }

    variants.push({
      id: `var-${Date.now()}-${i}`,
      // Si hay imagen, la usa. Si no, usa el placeholder bonito.
      image: imageResult || `https://placehold.co/1080x1350/1e293b/6366f1?text=${encodeURIComponent(state.productData.name)}`,
      copy: textResult.copy,
      hashtags: textResult.hashtags,
      angle: angle
    });
  }

  // Si no se generó ninguna variante (caso extremo), añadimos una de error
  if (variants.length === 0) {
      variants.push({
          id: 'fatal',
          image: `https://placehold.co/1080x1350/ef4444/ffffff?text=Error+Total`,
          copy: "Hubo un problema de conexión. Intenta de nuevo más tarde.",
          hashtags: ["#error"],
          angle: "System Error"
      });
  }

  return {
    id: `camp-${Date.now()}`,
    timestamp: Date.now(),
    platform: state.platform!,
    variants: variants
  };
};