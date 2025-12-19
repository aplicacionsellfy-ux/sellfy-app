import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { WizardState, CampaignResult, ContentVariant, BusinessSettings, PlanTier } from "../types";

// --- CONFIGURACIÓN API KEY ---
const getApiKey = () => {
  let key = '';
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    // @ts-ignore
    if (import.meta.env.VITE_API_KEY) key = import.meta.env.VITE_API_KEY;
    // @ts-ignore
    else if (import.meta.env.API_KEY) key = import.meta.env.API_KEY;
  }
  if (!key) {
    try {
      // @ts-ignore
      if (typeof process !== 'undefined' && process.env?.API_KEY) {
        // @ts-ignore
        key = process.env.API_KEY;
      }
    } catch (e) {}
  }
  return key;
};

const apiKey = getApiKey();
// @ts-ignore
const ai = new GoogleGenAI({ apiKey: apiKey || 'no-key-found' });

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
    if (!apiKey) throw new Error("Falta API Key");

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash', // Modelo rápido y obediente para JSON
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
    console.error("❌ Error Copy:", error);
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

  // Selección de modelo
  const isPro = plan === 'pro';
  // Si es Pro usamos el modelo nuevo Preview, si es Free/Starter usamos el Flash Image (Nano Banana)
  const modelName = isPro ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';
  
  console.log(`🎨 Iniciando Imagen con modelo: ${modelName} (Plan: ${plan})`);

  let promptText = `
    Professional product photography of "${productData.name}".
    Main Feature: ${productData.benefit}.
    Style: ${visualStyle}, ${contentType}.
    Composition: ${angleDescription}.
    Colors: ${settings.primaryColor} and ${settings.secondaryColor}.
    Lighting: Professional studio lighting, photorealistic, 8k.
  `;
  
  // Aspect Ratio en el texto del prompt (funciona mejor para modelos Flash)
  if (platform.includes('Stories') || platform.includes('Catalog')) {
     promptText += " FORMAT: Vertical (9:16 aspect ratio).";
  } else {
     promptText += " FORMAT: Square (1:1 aspect ratio).";
  }

  try {
    if (!apiKey) throw new Error("Falta API Key");

    const parts: any[] = [];

    // Imagen base (img2img)
    if (productData.baseImage) {
      const matches = productData.baseImage.match(/^data:([^;]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        parts.push({
          inlineData: { mimeType: matches[1], data: matches[2] }
        });
        promptText = `Use the attached image as STRICT reference. ${promptText}`;
      }
    }

    parts.push({ text: promptText });

    // Configuración:
    // gemini-2.5-flash-image NO acepta 'imageConfig' ni 'safetySettings' complejos.
    // gemini-3-pro-image-preview SÍ acepta 'imageConfig'.
    let requestConfig = {};
    
    if (isPro) {
        requestConfig = {
            imageConfig: { imageSize: '1K' } // Solo para Pro
        };
    }

    const response = await ai.models.generateContent({
      model: modelName,
      contents: { parts },
      // @ts-ignore
      config: requestConfig
    });

    // Búsqueda profunda de la imagen
    if (response.candidates && response.candidates.length > 0) {
      const candidate = response.candidates[0];
      
      // Chequeo de seguridad explícito
      if (candidate.finishReason === 'SAFETY') {
        console.warn("⚠️ Imagen bloqueada por SAFETY filters.");
        return null;
      }

      if (candidate.content && candidate.content.parts) {
        for (const part of candidate.content.parts) {
          if (part.inlineData && part.inlineData.data) {
            console.log("✅ Imagen generada exitosamente.");
            return `data:image/png;base64,${part.inlineData.data}`;
          }
        }
      }
    }
    
    console.warn("⚠️ La API respondió OK pero sin datos de imagen.", response);

  } catch (error: any) {
    // Log detallado para que veas en la consola (F12) qué pasó
    console.error(`❌ ERROR CRÍTICO IMAGEN (${modelName}):`, error);
    if (error.message?.includes('400')) {
        console.error("💡 PISTA: El error 400 suele ser por configuración inválida para el modelo seleccionado.");
    }
  }
  
  return null;
};

// --- ORQUESTADOR ---
export const generateCampaign = async (state: WizardState, settings: BusinessSettings, plan: PlanTier): Promise<CampaignResult> => {
  const angles = [
    "Hero Shot: Clean background, centered product",
    "Lifestyle: Product in context/use",
    "Creative: Artistic lighting and shadows",
    "Detail: Close-up on key features"
  ];

  console.log(`🚀 START CAMPAIGN - ${new Date().toLocaleTimeString()}`);

  const promises = angles.map(async (angle, index) => {
    try {
      const [img, txt] = await Promise.all([
        generateVariantImage(state, settings, angle, plan),
        generateVariantCopy(state, settings, angle)
      ]);

      return {
        id: `var-${Date.now()}-${index}`,
        // Si falla la imagen, usamos un placeholder que lo indique visualmente
        image: img || `https://placehold.co/1080x1350/1e293b/6366f1?text=${encodeURIComponent(state.productData.name || 'Error Gen')}`,
        copy: txt.copy,
        hashtags: txt.hashtags,
        angle: angle
      } as ContentVariant;

    } catch (e) {
      return null;
    }
  });

  const results = await Promise.all(promises);
  const validVariants = results.filter((v): v is ContentVariant => v !== null);

  if (validVariants.length === 0) {
      validVariants.push({
          id: 'fatal',
          image: `https://placehold.co/1080x1350/ef4444/ffffff?text=Error+Total`,
          copy: "Error de conexión. Revisa la consola (F12) para más detalles.",
          hashtags: ["#error"],
          angle: "System Error"
      });
  }

  return {
    id: `camp-${Date.now()}`,
    timestamp: Date.now(),
    platform: state.platform!,
    variants: validVariants
  };
};