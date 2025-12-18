import { GoogleGenAI } from "@google/genai";
import { WizardState, CampaignResult, ContentVariant, BusinessSettings, PlanTier } from "../types";

// Inicialización del cliente usando la variable de entorno
// @ts-ignore
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const cleanJsonText = (text: string | undefined): string => {
  if (!text) return '{}';
  // Eliminar bloques de código markdown ```json y ``` si existen
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
};

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
    1. Use AIDA structure (Attention, Interest, Desire, Action).
    2. Use emojis naturally.
    3. Include exactly 5 hashtags.
    4. NO markdown formatting in the output JSON.
    5. Language: Spanish (Español).

    Output Schema (JSON only):
    { 
      "copy": "The full caption text here", 
      "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"] 
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-latest', // Modelo rápido y eficiente para texto
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      }
    });

    const cleanText = cleanJsonText(response.text);
    const result = JSON.parse(cleanText);

    return {
      copy: result.copy || `¡Descubre ${productData.name}! ✨\n\n${productData.benefit}\n\n¡Haz tu pedido hoy mismo!`,
      hashtags: result.hashtags || ["#emprendimiento", "#producto", "#oferta", "#novedad", "#sellfy"]
    };
  } catch (error) {
    console.error("Error generating copy:", error);
    // Fallback básico si falla la IA
    return {
      copy: `✨ ${productData.name.toUpperCase()} ✨\n\n${productData.benefit}.\n\nUna opción perfecta para ${audience}.\n\n👇 ¡Consíguelo ahora!`,
      hashtags: ["#promo", "#nuevo", "#tendencia", "#calidad", "#tiendaonline"]
    };
  }
};

const generateVariantImage = async (state: WizardState, settings: BusinessSettings, angleDescription: string, plan: PlanTier): Promise<string | null> => {
  const { contentType, platform, visualStyle, productData } = state;
  
  if (!platform) return null;

  // Selección de modelo basada en el plan (Priorizamos calidad)
  // gemini-2.5-flash-image es muy rápido y bueno.
  const modelName = 'gemini-2.5-flash-image'; 
  
  // Ajuste de calidad basado en el plan (Uso de la variable 'plan' para corregir error TS6133)
  const qualityBoost = plan === 'pro' 
    ? "Masterpiece, 8k resolution, ultra-detailed, ray tracing, cinematic lighting" 
    : "High quality, professional lighting, sharp focus, 4k";

  // Prompt de Imagen Altamente Detallado
  let promptText = `
    Professional advertising photography of ${productData.name}.
    
    VISUAL SETTINGS:
    - Shot Type: ${angleDescription}
    - Style: ${visualStyle} aesthetic.
    - Context: ${contentType}.
    - Quality: ${qualityBoost}.
    
    BRANDING & COLORS (CRITICAL):
    - Primary Color: ${settings.primaryColor} (Use in props, background accents, or lighting).
    - Secondary Color: ${settings.secondaryColor} (Subtle details).
    - The image must feel cohesive with the brand "${settings.name}".

    LIGHTING & QUALITY:
    - Professional studio lighting, soft shadows, highly detailed, photorealistic.
    - Focus: Sharp focus on the product: ${productData.name}.
    - Vibe: ${settings.tone}.
  `;
  
  // Ajuste de aspecto según plataforma
  if (platform.includes('Stories') || platform.includes('Catalog')) {
     promptText += " Vertical aspect ratio (9:16), ensure product is centered vertically.";
  } else {
     promptText += " Square aspect ratio (1:1), perfect framing.";
  }

  // Si hay imagen base, modificamos el prompt
  const parts: any[] = [];
  if (productData.baseImage) {
    const matches = productData.baseImage.match(/^data:([^;]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      parts.push({
        inlineData: {
          mimeType: matches[1],
          data: matches[2]
        }
      });
      promptText = `Product Reference Included. Transform this product into a ${visualStyle} professional shot. KEEP the product recognizable but improve lighting and background using brand colors ${settings.primaryColor} and ${settings.secondaryColor}. ${promptText}`;
    }
  }

  parts.push({ text: promptText });

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: { parts },
      config: {
        // No configuramos imageConfig para flash-image ya que a veces causa conflictos con ciertos params
      }
    });

    // Buscar la parte de la imagen en la respuesta
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
  } catch (error) {
    console.error(`Error generating image (${modelName}):`, error);
  }
  return null;
};

export const generateCampaign = async (state: WizardState, settings: BusinessSettings, plan: PlanTier): Promise<CampaignResult> => {
  // Definimos 4 ángulos distintos para variedad real
  const angles = [
    "Hero shot: Frontal, centered, minimalist background matching brand colors",
    "Lifestyle: The product being used in a realistic environment",
    "Creative: Artistic composition with dynamic lighting and shadows",
    "Detail: Close-up macro shot emphasizing quality and texture"
  ];

  // Generamos en paralelo para velocidad, pero manejamos errores individualmente
  const promises = angles.map(async (angle, index) => {
    try {
      const [img, txt] = await Promise.all([
        generateVariantImage(state, settings, angle, plan),
        generateVariantCopy(state, settings, angle)
      ]);

      return {
        id: `var-${Date.now()}-${index}`,
        image: img || `https://placehold.co/1080x1350/1e293b/ffffff?text=${encodeURIComponent(state.productData.name || 'Error Gen')}`,
        copy: txt.copy,
        hashtags: txt.hashtags,
        angle: angle
      } as ContentVariant;
    } catch (e) {
      console.error("Error in variant generation", e);
      return null;
    }
  });

  const results = await Promise.all(promises);
  
  // Filtramos nulos por si acaso
  const validVariants = results.filter((v): v is ContentVariant => v !== null);

  return {
    id: `camp-${Date.now()}`,
    timestamp: Date.now(),
    platform: state.platform!,
    variants: validVariants
  };
};