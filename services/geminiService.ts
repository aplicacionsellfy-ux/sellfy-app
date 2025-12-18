import { GoogleGenAI } from "@google/genai";
import { WizardState, CampaignResult, ContentVariant, BusinessSettings, PlanTier } from "../types";

// --- 1. CONFIGURACIÓN SEGURA DE LA API KEY ---
const getApiKey = () => {
  let key = '';
  
  // Opción A: Vite estándar (Recomendado)
  try {
    // @ts-ignore
    if (import.meta.env?.VITE_API_KEY) key = import.meta.env.VITE_API_KEY;
    // @ts-ignore
    else if (import.meta.env?.API_KEY) key = import.meta.env.API_KEY;
  } catch (e) {}

  // Opción B: Compatibilidad con process.env (si Vite hace el replace)
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

// --- UTILIDADES ---
const cleanJsonText = (text: string | undefined): string => {
  if (!text) return '{}';
  // Limpia bloques de código Markdown que la IA suele añadir
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
};

// --- GENERACIÓN DE COPY (TEXTO) ---
const generateVariantCopy = async (state: WizardState, settings: BusinessSettings, angleDescription: string): Promise<{ copy: string, hashtags: string[] }> => {
  const { platform, productData } = state;
  const audience = productData.targetAudience || settings.targetAudience;

  // Prompt simplificado para evitar errores de Schema
  const prompt = `
    Actúa como experto en Copywriting para la marca "${settings.name}" (${settings.industry}).
    Escribe un caption para: "${productData.name}".
    Ángulo: ${angleDescription}.
    
    Contexto:
    - Plataforma: ${platform}
    - Tono: ${settings.tone}
    - Audiencia: ${audience}
    - Beneficio Clave: ${productData.benefit}
    ${productData.price ? `- Precio: ${productData.price}` : ''}
    ${productData.promoDetails ? `- Promo: ${productData.promoDetails}` : ''}

    REGLAS:
    1. Usa estructura AIDA.
    2. Usa emojis.
    3. Incluye exactamente 5 hashtags.
    4. Idioma: Español.
    5. RESPONDE SOLO CON UN JSON VÁLIDO. NO uses Markdown.

    Formato JSON esperado:
    { "copy": "texto del post aquí", "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"] }
  `;

  try {
    if (!apiKey) throw new Error("API Key no detectada. Revisa tu archivo .env");

    // Usamos gemini-2.5-flash-latest por ser extremadamente rápido y estable para JSON
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-latest', 
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      }
    });

    const cleanText = cleanJsonText(response.text);
    const result = JSON.parse(cleanText);

    return {
      copy: result.copy || `¡Descubre ${productData.name}! ✨\n\n${productData.benefit}\n\n¡Haz tu pedido hoy! 👇`,
      hashtags: result.hashtags || ["#emprendimiento", "#nuevo", "#oferta", "#calidad", "#sellfy"]
    };
  } catch (error) {
    console.error("❌ Error en Copy IA:", error);
    // Fallback elegante
    return {
      copy: `✨ ${productData.name.toUpperCase()} ✨\n\n${productData.benefit}.\n\nUna opción perfecta para ${audience}.\n\n👇 ¡Consíguelo ahora!`,
      hashtags: ["#promo", "#nuevo", "#tendencia", "#calidad", "#tiendaonline"]
    };
  }
};

// --- GENERACIÓN DE IMAGEN ---
const generateVariantImage = async (state: WizardState, settings: BusinessSettings, angleDescription: string, plan: PlanTier): Promise<string | null> => {
  const { contentType, platform, visualStyle, productData } = state;
  
  if (!platform) return null;

  // Selección de Modelo:
  // gemini-2.5-flash-image es el estándar actual (Nano Banana).
  const modelName = 'gemini-2.5-flash-image';
  
  // Ajuste de calidad en el prompt según el plan
  const qualityKeywords = plan === 'pro' 
    ? "Award winning photography, 8k resolution, highly detailed, cinematic lighting, masterpiece" 
    : "Professional product photography, high quality, sharp focus, studio lighting";

  let promptText = `
    Professional photography of ${productData.name}.
    Context: ${contentType}.
    Style: ${visualStyle}, ${angleDescription}.
    Feature: ${productData.benefit}.
    Brand Colors: ${settings.primaryColor}, ${settings.secondaryColor}.
    Vibe: ${settings.industry}, ${settings.tone}.
    Quality: ${qualityKeywords}.
  `;
  
  // Aspect Ratio via Prompt (Nano Banana no siempre respeta config paramétrica)
  if (platform.includes('Stories') || platform.includes('Catalog')) {
     promptText += " Compose for Vertical (9:16) aspect ratio. Product centered.";
  } else {
     promptText += " Compose for Square (1:1) aspect ratio.";
  }

  try {
    if (!apiKey) throw new Error("API Key no detectada");

    const parts: any[] = [];

    // 1. Si el usuario subió una imagen base, la añadimos primero
    if (productData.baseImage) {
      const matches = productData.baseImage.match(/^data:([^;]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        parts.push({
          inlineData: {
            mimeType: matches[1],
            data: matches[2]
          }
        });
        // Instrucción multimodal
        promptText = `Reference image provided. Create a new professional photo of this product in a ${visualStyle} style. ${promptText}`;
      }
    }

    // 2. Añadimos el texto del prompt
    parts.push({ text: promptText });

    const response = await ai.models.generateContent({
      model: modelName,
      contents: { parts },
      // Configuración minimalista para evitar conflictos
      config: {} 
    });

    // 3. Extraer la imagen de la respuesta
    if (response.candidates && response.candidates[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    
    console.warn("⚠️ La IA no devolvió datos de imagen (inlineData).");
  } catch (error) {
    console.error(`❌ Error en Imagen IA (${modelName}):`, error);
  }
  
  return null;
};

// --- ORQUESTADOR PRINCIPAL ---
export const generateCampaign = async (state: WizardState, settings: BusinessSettings, plan: PlanTier): Promise<CampaignResult> => {
  const angles = [
    "Hero Shot: Frontal, clean background, focus on product",
    "Lifestyle: Product being used in real life context",
    "Creative: Artistic composition with dramatic lighting",
    "Detail: Close-up macro shot emphasizing quality"
  ];

  // Ejecución en paralelo para velocidad
  const promises = angles.map(async (angle, index) => {
    try {
      const [img, txt] = await Promise.all([
        generateVariantImage(state, settings, angle, plan),
        generateVariantCopy(state, settings, angle)
      ]);

      return {
        id: `var-${Date.now()}-${index}`,
        // Si falla la imagen, usamos un placeholder elegante con el nombre del producto
        image: img || `https://placehold.co/1080x1350/1e293b/6366f1?text=${encodeURIComponent(state.productData.name || 'Producto')}`,
        copy: txt.copy,
        hashtags: txt.hashtags,
        angle: angle
      } as ContentVariant;

    } catch (e) {
      console.error(`Error generando variante ${index}:`, e);
      return null;
    }
  });

  const results = await Promise.all(promises);
  
  // Filtrar nulos
  const validVariants = results.filter((v): v is ContentVariant => v !== null);

  // Si todo falló, devolvemos al menos un placeholder para no romper la UI
  if (validVariants.length === 0) {
      validVariants.push({
          id: 'fallback-error',
          image: `https://placehold.co/1080x1350/ef4444/ffffff?text=Error+Generacion`,
          copy: "Hubo un problema generando el contenido. Por favor verifica tu conexión o intenta de nuevo.",
          hashtags: ["#error", "#tryagain"],
          angle: "Error Fallback"
      });
  }

  return {
    id: `camp-${Date.now()}`,
    timestamp: Date.now(),
    platform: state.platform!,
    variants: validVariants
  };
};