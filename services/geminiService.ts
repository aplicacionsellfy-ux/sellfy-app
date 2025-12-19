import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { WizardState, CampaignResult, ContentVariant, BusinessSettings, PlanTier } from "../types";

// --- INICIALIZACIÓN ROBUSTA DEL CLIENTE ---
const getClient = () => {
  // 1. Intentar leer la variable estándar de Vite (La más segura en frontend)
  // @ts-ignore
  let key = import.meta.env.VITE_API_KEY;

  // 2. Si no existe, intentar leer process.env (Polyfill)
  if (!key) {
    try {
      // @ts-ignore
      key = process.env.API_KEY;
    } catch (e) {}
  }

  // 3. Si aún no existe, buscar claves alternativas comunes
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

  // Inicializar cliente
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
  const modelName = isPro ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';
  
  console.log(`🎨 Generando imagen con: ${modelName}`);

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

  try {
    if (!ai) throw new Error("Cliente IA no inicializado (Falta Key)");

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

    // Configuración específica para evitar error 400 en flash-image
    let requestConfig = {};
    if (isPro) {
        requestConfig = {
            imageConfig: { imageSize: '1K' }
        };
    }

    const response = await ai.models.generateContent({
      model: modelName,
      contents: { parts },
      // @ts-ignore
      config: requestConfig
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
    
    console.warn("⚠️ IA respondió sin imagen.");

  } catch (error: any) {
    console.error(`❌ Error Generación Imagen (${modelName}):`, error);
  }
  
  return null;
};

// --- ORQUESTADOR ---
export const generateCampaign = async (state: WizardState, settings: BusinessSettings, plan: PlanTier): Promise<CampaignResult> => {
  const angles = [
    "Studio Hero Shot",
    "Lifestyle Context",
    "Creative Lighting",
    "Detail Macro"
  ];

  console.log(`🚀 Iniciando Campaña...`);

  const promises = angles.map(async (angle, index) => {
    try {
      const [img, txt] = await Promise.all([
        generateVariantImage(state, settings, angle, plan),
        generateVariantCopy(state, settings, angle)
      ]);

      return {
        id: `var-${Date.now()}-${index}`,
        image: img || `https://placehold.co/1080x1350/1e293b/6366f1?text=${encodeURIComponent(state.productData.name || 'Error')}`,
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
          image: `https://placehold.co/1080x1350/ef4444/ffffff?text=Error+API`,
          copy: "Por favor verifica tu API Key en el archivo .env",
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