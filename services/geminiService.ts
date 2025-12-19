import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { WizardState, CampaignResult, ContentVariant, BusinessSettings, PlanTier } from "../types";

// --- 1. CONFIGURACIÓN SEGURA DE LA API KEY ---
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

// --- CONFIGURACIÓN DE SEGURIDAD (CRÍTICO) ---
// Esto evita que la IA bloquee productos como "suplementos", "bikinis", "cremas", etc.
const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

// --- UTILIDADES ---
const cleanJsonText = (text: string | undefined): string => {
  if (!text) return '{}';
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
};

// --- GENERACIÓN DE COPY (TEXTO) ---
const generateVariantCopy = async (state: WizardState, settings: BusinessSettings, angleDescription: string): Promise<{ copy: string, hashtags: string[] }> => {
  const { platform, productData } = state;
  // Solución TS6133: Usamos la variable audience en el prompt
  const audience = productData.targetAudience || settings.targetAudience || 'General';

  const prompt = `
    Eres un experto en Marketing Digital.
    Genera un caption (texto del post) para el producto: "${productData.name}".
    Beneficio principal: "${productData.benefit}".
    
    Contexto:
    - Marca: ${settings.name} (${settings.industry})
    - Plataforma: ${platform}
    - Tono: ${settings.tone}
    - Audiencia Objetivo: ${audience}
    - Ángulo creativo: ${angleDescription}

    REGLAS OBLIGATORIAS:
    1. Responde SOLAMENTE con un JSON válido.
    2. Usa estructura AIDA (Atención, Interés, Deseo, Acción).
    3. Incluye emojis relevantes.
    4. Incluye 5 hashtags estratégicos.

    FORMATO JSON:
    { "copy": "Tu texto aquí...", "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"] }
  `;

  try {
    if (!apiKey) throw new Error("API Key no encontrada");

    // Usamos 'gemini-2.5-flash' (Nano Banana) estándar para máxima velocidad y obediencia JSON
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash', 
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        safetySettings: SAFETY_SETTINGS,
      }
    });

    const cleanText = cleanJsonText(response.text);
    const result = JSON.parse(cleanText);

    return {
      copy: result.copy || `${productData.name} 🔥\n\n${productData.benefit}\n\n¡Cómpralo ya!`,
      hashtags: result.hashtags || ["#producto", "#oferta", "#nuevo", "#viral", "#tienda"]
    };
  } catch (error) {
    console.error("❌ Error Copy IA:", error);
    return {
      copy: `¡Atención! 🚨\n\nDescubre ${productData.name}, la mejor solución para ti.\n\n✅ ${productData.benefit}\n\n👇 ¡Haz clic en el enlace!`,
      hashtags: ["#fyp", "#parati", "#new", "#promo", "#shop"]
    };
  }
};

// --- GENERACIÓN DE IMAGEN ---
const generateVariantImage = async (state: WizardState, settings: BusinessSettings, angleDescription: string, plan: PlanTier): Promise<string | null> => {
  const { contentType, platform, visualStyle, productData } = state;
  
  if (!platform) return null;

  // Modelo: Usamos 'gemini-2.5-flash-image' (Nano Banana Image).
  const modelName = 'gemini-2.5-flash-image';

  // Solución TS6133: Usamos la variable plan para ajustar palabras clave del prompt
  const qualityKeywords = plan === 'pro' 
    ? 'High definition, 4k, hyper-realistic, commercial advertisement standard' 
    : 'Social media quality, sharp focus, good lighting';
  
  // Prompt diseñado para forzar la salida de imagen
  let promptText = `
    Generate a photorealistic product image of "${productData.name}".
    Key Benefit/Feature to visualize: ${productData.benefit}.
    
    Style Guidelines:
    - Type: ${contentType}
    - Aesthetic: ${visualStyle}
    - Composition: ${angleDescription}
    - Brand Colors: ${settings.primaryColor} and ${settings.secondaryColor}
    - Quality: ${qualityKeywords}
    
    IMPORTANT: The image must be high quality and suitable for social media advertising.
  `;
  
  if (platform.includes('Stories') || platform.includes('Catalog')) {
     promptText += " Aspect Ratio: Vertical (9:16). Center the subject.";
  } else {
     promptText += " Aspect Ratio: Square (1:1).";
  }

  try {
    if (!apiKey) throw new Error("API Key no detectada");

    const parts: any[] = [];

    // 1. Imagen base si existe
    if (productData.baseImage) {
      const matches = productData.baseImage.match(/^data:([^;]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        parts.push({
          inlineData: {
            mimeType: matches[1],
            data: matches[2]
          }
        });
        promptText = `Use the attached image as a strict reference for the product. ${promptText}`;
      }
    }

    // 2. Texto del prompt
    parts.push({ text: promptText });

    const response = await ai.models.generateContent({
      model: modelName,
      contents: { parts },
      config: {
        safetySettings: SAFETY_SETTINGS, // CRUCIAL: Desactivar filtros
        // imageConfig NO es soportado por Nano Banana (2.5 flash image), no lo incluimos.
      }
    });

    // 3. Buscar la imagen en todas las partes de la respuesta
    if (response.candidates && response.candidates.length > 0) {
      const candidate = response.candidates[0];
      
      // Verificar si fue bloqueado
      if (candidate.finishReason === 'SAFETY') {
        console.error("⚠️ Imagen bloqueada por filtros de seguridad de Google.");
        return null;
      }

      if (candidate.content && candidate.content.parts) {
        for (const part of candidate.content.parts) {
          if (part.inlineData && part.inlineData.data) {
            return `data:image/png;base64,${part.inlineData.data}`;
          }
        }
      }
    }
    
    console.warn("⚠️ La IA respondió pero no devolvió datos de imagen (posiblemente devolvió texto).");
  } catch (error) {
    console.error(`❌ Error Imagen IA (${modelName}):`, error);
  }
  
  return null;
};

// --- ORQUESTADOR PRINCIPAL ---
export const generateCampaign = async (state: WizardState, settings: BusinessSettings, plan: PlanTier): Promise<CampaignResult> => {
  const angles = [
    "Product Hero: Centered, clean background, focus on details",
    "Lifestyle: In use, natural environment, human element",
    "Creative/Artistic: Dramatic lighting, abstract background elements",
    "Minimalist: Solid color background matching brand identity"
  ];

  console.log("🚀 Iniciando campaña con Safety Settings OFF...");

  // Paralelismo seguro
  const promises = angles.map(async (angle, index) => {
    try {
      const [img, txt] = await Promise.all([
        generateVariantImage(state, settings, angle, plan),
        generateVariantCopy(state, settings, angle)
      ]);

      return {
        id: `var-${Date.now()}-${index}`,
        // Placeholder SOLO si falla la imagen real
        image: img || `https://placehold.co/1080x1350/1e293b/6366f1?text=${encodeURIComponent(state.productData.name || 'Error')}`,
        copy: txt.copy,
        hashtags: txt.hashtags,
        angle: angle
      } as ContentVariant;

    } catch (e) {
      console.error(`Error variante ${index}:`, e);
      return null;
    }
  });

  const results = await Promise.all(promises);
  const validVariants = results.filter((v): v is ContentVariant => v !== null);

  // Fallback de emergencia
  if (validVariants.length === 0) {
      validVariants.push({
          id: 'fatal-error',
          image: `https://placehold.co/1080x1350/ef4444/ffffff?text=Error+Total`,
          copy: "No pudimos conectar con los servicios de IA. Por favor verifica tu API Key.",
          hashtags: ["#error", "#ayuda"],
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