import { GoogleGenAI } from "@google/genai";
import { WizardState, CampaignResult, ContentVariant, BusinessSettings, PlanTier } from "../types";

// --- 1. CONFIGURACIÓN SEGURA DE LA API KEY ---
const getApiKey = () => {
  let key = '';
  
  // 1. Intentar VITE_API_KEY (Estándar Vite)
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    // @ts-ignore
    if (import.meta.env.VITE_API_KEY) key = import.meta.env.VITE_API_KEY;
    // @ts-ignore
    else if (import.meta.env.API_KEY) key = import.meta.env.API_KEY;
  }

  // 2. Intentar process.env (Fallback para configuraciones Docker/Node)
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
  // Limpia bloques de código Markdown (```json ... ```) que la IA suele añadir
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
};

// --- GENERACIÓN DE COPY (TEXTO) ---
const generateVariantCopy = async (state: WizardState, settings: BusinessSettings, angleDescription: string): Promise<{ copy: string, hashtags: string[] }> => {
  const { platform, productData } = state;
  const audience = productData.targetAudience || settings.targetAudience;

  // Prompt optimizado para JSON sin usar Schema complejo (más robusto)
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

    REGLAS ESTRICTAS:
    1. Usa estructura AIDA.
    2. Usa emojis.
    3. Incluye exactamente 5 hashtags.
    4. Idioma: Español.
    5. TU RESPUESTA DEBE SER ÚNICAMENTE UN JSON VÁLIDO. No incluyas texto antes ni después.

    Formato JSON esperado:
    { "copy": "texto del post aquí", "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"] }
  `;

  try {
    if (!apiKey) throw new Error("API Key no detectada. Revisa tu archivo .env");

    // Usamos gemini-2.5-flash-latest: Rápido, barato y excelente siguiendo instrucciones JSON
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
    // Fallback visual para que la UI no se rompa
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

  // Modelo: Usamos 'gemini-2.5-flash-image' (Nano Banana).
  // Es el modelo estándar actual para generación de imágenes rápida en Gemini.
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
  
  // Instrucciones de aspecto en el prompt (ya que flash-image ignora a veces el aspectRatio config)
  if (platform.includes('Stories') || platform.includes('Catalog')) {
     promptText += " Compose for Vertical (9:16) aspect ratio. Product centered.";
  } else {
     promptText += " Compose for Square (1:1) aspect ratio.";
  }

  try {
    if (!apiKey) throw new Error("API Key no detectada");

    const parts: any[] = [];

    // 1. Si el usuario subió una imagen base, la añadimos para referencia
    if (productData.baseImage) {
      const matches = productData.baseImage.match(/^data:([^;]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        parts.push({
          inlineData: {
            mimeType: matches[1],
            data: matches[2]
          }
        });
        promptText = `Reference image provided. Create a new professional photo of this product in a ${visualStyle} style. ${promptText}`;
      }
    }

    // 2. Añadimos el texto del prompt
    parts.push({ text: promptText });

    const response = await ai.models.generateContent({
      model: modelName,
      contents: { parts },
      config: {} // Configuración vacía para máxima compatibilidad
    });

    // 3. Extraer la imagen de la respuesta
    if (response.candidates && response.candidates[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    
    console.warn("⚠️ La IA respondió OK pero no devolvió datos de imagen (inlineData). Posible filtro de seguridad.");
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

  console.log("🚀 Iniciando generación de campaña...");

  // Ejecución en paralelo con manejo de errores individual
  const promises = angles.map(async (angle, index) => {
    try {
      const [img, txt] = await Promise.all([
        generateVariantImage(state, settings, angle, plan),
        generateVariantCopy(state, settings, angle)
      ]);

      return {
        id: `var-${Date.now()}-${index}`,
        // Si la imagen falla (null), usamos un placeholder que indica el error visualmente pero mantiene el layout
        image: img || `https://placehold.co/1080x1350/1e293b/6366f1?text=${encodeURIComponent(state.productData.name || 'Error Gen Imagen')}`,
        copy: txt.copy,
        hashtags: txt.hashtags,
        angle: angle
      } as ContentVariant;

    } catch (e) {
      console.error(`Error crítico generando variante ${index}:`, e);
      return null;
    }
  });

  const results = await Promise.all(promises);
  
  // Filtrar nulos (si alguna promesa explotó completamente)
  const validVariants = results.filter((v): v is ContentVariant => v !== null);

  // Fallback final por si todo falló (ej. API Key inválida)
  if (validVariants.length === 0) {
      validVariants.push({
          id: 'fallback-fatal',
          image: `https://placehold.co/1080x1350/ef4444/ffffff?text=Error+de+Conexion`,
          copy: "Hubo un problema conectando con la IA. Por favor verifica tu API KEY y tu conexión.",
          hashtags: ["#error", "#soporte"],
          angle: "Error del Sistema"
      });
  }

  return {
    id: `camp-${Date.now()}`,
    timestamp: Date.now(),
    platform: state.platform!,
    variants: validVariants
  };
};