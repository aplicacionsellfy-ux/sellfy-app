import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { WizardState, CampaignResult, ContentVariant, BusinessSettings, PlanTier } from "../types";

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
    if (!ai) throw new Error("Cliente IA no inicializado (Falta Key)");

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
    // console.error("❌ Error Copy:", error); // Silenciamos error de copy para no ensuciar consola
    return {
      copy: `¡Descubre ${productData.name}! ✨\n\n${productData.benefit}.`,
      hashtags: ["#nuevo", "#trend"]
    };
  }
};

// --- GENERAR IMAGEN (CON FALLBACK) ---
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

  // 2. Función auxiliar para intentar generar
  const tryGenerate = async (model: string): Promise<string | null> => {
    try {
      if (!ai) return null;
      
      const isProModel = model.includes('pro');
      // Solo enviamos config especial para modelos Pro, los Flash a veces fallan con configs vacías
      const config = isProModel ? { imageConfig: { imageSize: '1K' } } : {};

      console.log(`🎨 Intentando generar con: ${model}`);
      
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
      if (error.message?.includes('429') || error.message?.includes('quota')) {
         console.warn(`⚠️ Cuota excedida en ${model}.`);
      } else {
         console.warn(`⚠️ Error en ${model}:`, error.message);
      }
      throw error; // Relanzar para capturar en el fallback
    }
  };

  // 3. Estrategia de Ejecución
  const primaryModel = plan === 'pro' ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';
  const fallbackModel = 'gemini-2.5-flash-image';

  try {
    return await tryGenerate(primaryModel);
  } catch (error) {
    // Si falla el modelo Pro, intentamos el Flash automáticamente
    if (primaryModel !== fallbackModel) {
      try {
        console.log("🔄 Activando fallback a modelo Flash...");
        return await tryGenerate(fallbackModel);
      } catch (fallbackError) {
        console.error("❌ Falló también el modelo de respaldo.");
      }
    }
  }
  
  return null;
};

// --- ORQUESTADOR (SECUENCIAL PARA EVITAR 429) ---
export const generateCampaign = async (state: WizardState, settings: BusinessSettings, plan: PlanTier): Promise<CampaignResult> => {
  const angles = [
    "Studio Hero Shot",
    "Lifestyle Context",
    "Creative Lighting",
    "Detail Macro"
  ];

  console.log(`🚀 Iniciando Campaña (Modo Secuencial)...`);

  const variants: ContentVariant[] = [];

  // USAMOS FOR LOOP EN VEZ DE PROMISE.ALL PARA NO SATURAR LA API
  for (let i = 0; i < angles.length; i++) {
    const angle = angles[i];
    
    // Pequeña pausa entre peticiones (rate limiting manual)
    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2 segundos de espera
    }

    try {
      // Generamos Copy e Imagen en paralelo para esta variante específica
      const [img, txt] = await Promise.all([
        generateVariantImage(state, settings, angle, plan),
        generateVariantCopy(state, settings, angle)
      ]);

      variants.push({
        id: `var-${Date.now()}-${i}`,
        // Placeholder elegante si falla la imagen
        image: img || `https://placehold.co/1080x1350/1e293b/6366f1?text=${encodeURIComponent(state.productData.name || 'Imagen')}`,
        copy: txt.copy,
        hashtags: txt.hashtags,
        angle: angle
      });

    } catch (e) {
      console.error(`Error procesando variante ${i}`, e);
    }
  }

  // Si todo falló, devolvemos un error controlado
  if (variants.length === 0) {
      variants.push({
          id: 'fatal',
          image: `https://placehold.co/1080x1350/ef4444/ffffff?text=Error+Servidor`,
          copy: "El servicio de IA está saturado en este momento. Por favor intenta en unos segundos.",
          hashtags: ["#error", "#tryagain"],
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