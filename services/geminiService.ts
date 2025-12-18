import { GoogleGenAI, Type } from "@google/genai";
import { WizardState, CampaignResult, ContentVariant, BusinessSettings, PlanTier } from "../types";

// --- 1. CONFIGURACIÓN ROBUSTA DE LA API KEY ---
const getApiKey = () => {
  let key = '';
  
  // A. Intentar con import.meta.env (Estándar Vite)
  try {
    // @ts-ignore
    if (import.meta.env?.VITE_API_KEY) key = import.meta.env.VITE_API_KEY;
    // @ts-ignore
    else if (import.meta.env?.API_KEY) key = import.meta.env.API_KEY;
  } catch (e) {}

  // B. Intentar con process.env (Compatibilidad/Define)
  if (!key) {
    try {
      // @ts-ignore
      if (process.env.API_KEY) key = process.env.API_KEY;
    } catch (e) {}
  }

  return key;
};

const apiKey = getApiKey();
// @ts-ignore
const ai = new GoogleGenAI({ apiKey: apiKey || 'no-key-found' });

// --- UTILIDADES ---
const cleanJsonText = (text: string | undefined): string => {
  if (!text) return '{}';
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
};

// --- GENERACIÓN DE COPY (TEXTO) ---
const generateVariantCopy = async (state: WizardState, settings: BusinessSettings, angleDescription: string): Promise<{ copy: string, hashtags: string[] }> => {
  const { platform, productData } = state;
  const audience = productData.targetAudience || settings.targetAudience;

  const prompt = `
    Role: Expert Copywriter for "${settings.name}" (${settings.industry}).
    Task: Write a social media caption for product "${productData.name}".
    Angle: ${angleDescription}.
    
    Context:
    - Platform: ${platform}
    - Tone: ${settings.tone}
    - Audience: ${audience}
    - Key Benefit: ${productData.benefit}
    ${productData.price ? `- Price: ${productData.price}` : ''}
    ${productData.promoDetails ? `- Promo: ${productData.promoDetails}` : ''}

    Requirements:
    1. Use AIDA structure.
    2. Use emojis.
    3. Include exactly 5 hashtags.
    4. Language: Spanish (Español).
    5. Output JSON format only.

    Output Schema:
    { "copy": "string", "hashtags": ["string"] }
  `;

  try {
    if (!apiKey) throw new Error("Falta API Key");

    // Usamos gemini-2.5-flash (estable) en lugar de preview
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash', 
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      }
    });

    const cleanText = cleanJsonText(response.text);
    const result = JSON.parse(cleanText);

    return {
      copy: result.copy || `¡Increíble ${productData.name}! ✨\n\n${productData.benefit}\n\n¡Consíguelo ya! 👇`,
      hashtags: result.hashtags || ["#sellfy", "#business", "#growth", "#viral", "#marketing"]
    };
  } catch (error) {
    console.error("❌ ERROR GENERANDO COPY:", error);
    // Fallback visual para que el usuario sepa que falló la IA
    return {
      copy: `(Error de IA - Usando Fallback) ✨ ${productData.name} ✨\n\n${productData.benefit}.\n\n¡Compra ahora! 🛍️`,
      hashtags: ["#error", "#intentardenuevo", "#shop", "#new", "#trending"]
    };
  }
};

// --- GENERACIÓN DE IMAGEN ---
const generateVariantImage = async (state: WizardState, settings: BusinessSettings, angleDescription: string, plan: PlanTier): Promise<string | null> => {
  const { contentType, platform, visualStyle, productData } = state;
  
  if (!platform) return null;

  // Modelo: Usamos gemini-2.5-flash-image que es rápido y multimodal
  // Si tienes acceso a Imagen 3, podrías cambiarlo a 'imagen-3.0-generate-001'
  const modelName = 'gemini-2.5-flash-image';
  
  const qualityBoost = plan === 'pro' 
    ? "High quality, 4k, studio lighting, detailed texture" 
    : "Professional standard quality";

  let promptText = `
    Professional product photography of ${productData.name}.
    Feature: ${productData.benefit}.
    Style: ${visualStyle}, ${angleDescription}.
    Context: ${contentType}.
    Colors: ${settings.primaryColor}, ${settings.secondaryColor}.
    Vibe: ${settings.industry}, ${settings.tone}.
    Quality: ${qualityBoost}.
  `;
  
  if (platform.includes('Stories') || platform.includes('Catalog')) {
     promptText += " Vertical aspect ratio (9:16).";
  } else {
     promptText += " Square aspect ratio (1:1).";
  }

  try {
    if (!apiKey) throw new Error("Falta API Key");

    const parts: any[] = [];

    // Si hay imagen base, la añadimos al prompt multimodal
    if (productData.baseImage) {
      const matches = productData.baseImage.match(/^data:([^;]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        parts.push({
          inlineData: {
            mimeType: matches[1],
            data: matches[2]
          }
        });
        promptText = `Use this image as reference. Transform it into a ${visualStyle} style photo. ${promptText}`;
      }
    }

    parts.push({ text: promptText });

    const response = await ai.models.generateContent({
      model: modelName,
      contents: { parts },
      // flash-image no soporta configs avanzadas de imagen a veces, lo mantenemos simple
      config: {} 
    });

    // Extraer imagen
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData && part.inlineData.data) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    
    console.warn("⚠️ La IA respondió pero no devolvió imagen (inlineData).");

  } catch (error) {
    console.error(`❌ ERROR GENERANDO IMAGEN (${modelName}):`, error);
  }
  return null;
};

// --- ORQUESTADOR ---
export const generateCampaign = async (state: WizardState, settings: BusinessSettings, plan: PlanTier): Promise<CampaignResult> => {
  const angles = [
    "Front view, centered hero shot",
    "Lifestyle context, product in use",
    "Close-up macro detail shot",
    "Creative artistic composition"
  ];

  console.log("🚀 Iniciando generación de campaña...");

  const variants: ContentVariant[] = [];

  // Generamos secuencialmente para debuggear mejor (puedes cambiar a Promise.all luego)
  for (let i = 0; i < angles.length; i++) {
    const angle = angles[i];
    
    const [img, txt] = await Promise.all([
      generateVariantImage(state, settings, angle, plan),
      generateVariantCopy(state, settings, angle)
    ]);

    variants.push({
      id: `var-${Date.now()}-${i}`,
      image: img || `https://placehold.co/1080x1350/1e293b/ffffff?text=${encodeURIComponent(state.productData.name || 'Error Gen')}`,
      copy: txt.copy,
      hashtags: txt.hashtags,
      angle: angle
    } as ContentVariant);
  }

  return {
    id: `camp-${Date.now()}`,
    timestamp: Date.now(),
    platform: state.platform!,
    variants: variants
  };
};