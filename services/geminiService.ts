import { GoogleGenAI, Type } from "@google/genai";
import { WizardState, CampaignResult, ContentVariant, BusinessSettings, PlanTier } from "../types";

let apiKey = '';
try {
  // @ts-ignore
  if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
     // @ts-ignore
     apiKey = process.env.API_KEY;
  }
} catch (e) {}

const ai = new GoogleGenAI({ apiKey });

const generateVariantCopy = async (state: WizardState, settings: BusinessSettings, angleDescription: string): Promise<{ copy: string, hashtags: string[] }> => {
  const { platform, productData } = state;
  const audience = productData.targetAudience || settings.targetAudience;

  const prompt = `
    You are a World-Class Copywriter for a ${settings.industry} brand named "${settings.name}".
    
    GOAL: Write a caption for "${productData.name}" matching angle: "${angleDescription}".
    
    CONTEXT:
    - Platform: ${platform}
    - Tone: ${settings.tone}
    - Audience: ${audience}
    - Benefit: ${productData.benefit}
    ${productData.price ? `- Price: ${productData.price}` : ''}
    ${productData.promoDetails ? `- Promo: ${productData.promoDetails}` : ''}

    STRICT RULES:
    1. Use AIDA framework.
    2. Use emojis.
    3. 5 EXACT lowercase hashtags.
    4. Optimized length for ${platform}.
    5. No "Attention:", "Interest:" labels.

    Output JSON: { "copy": "string", "hashtags": ["string"] }
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            copy: { type: Type.STRING },
            hashtags: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ['copy', 'hashtags']
        }
      }
    });

    const result = JSON.parse(response.text || '{}');
    return {
      copy: result.copy || `¡Increíble ${productData.name}! ✨\n\n${productData.benefit}\n\n¡Consíguelo ya! 👇`,
      hashtags: result.hashtags || ["#sellfy", "#business", "#growth", "#viral", "#marketing"]
    };
  } catch (error) {
    console.error("Error generating copy variant:", error);
    return {
      copy: `${productData.name} ✨\n\n${productData.benefit}.\n\n¡Compra ahora! 🛍️`,
      hashtags: ["#promo", "#deal", "#shop", "#new", "#trending"]
    };
  }
};

const generateVariantImage = async (state: WizardState, settings: BusinessSettings, angleDescription: string, plan: PlanTier): Promise<string | null> => {
  const { contentType, platform, visualStyle, productData } = state;
  
  if (!platform) return null;

  // CONDITIONAL LOGIC BASED ON PLAN
  // Pro plan gets the high-end model and richer prompt keywords
  const isPro = plan === 'pro';
  
  // Model Selection
  // gemini-3-pro-image-preview handles 4K and complex prompts better
  // gemini-2.5-flash-image is faster and good for standard usage
  const modelName = isPro ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';
  
  // Quality Keywords
  const qualityKeywords = isPro 
    ? "Masterpiece, 8k resolution, highly detailed, ultra-realistic texture, ray tracing, studio lighting" 
    : "Standard resolution, professional lighting, clean focus, web quality";

  let promptText = `Professional product photography of ${productData.name}. 
  Context: ${contentType}. 
  Style: ${visualStyle}. 
  Composition: ${angleDescription}.
  Feature: ${productData.benefit}.
  
  Colors: ${settings.primaryColor}, ${settings.secondaryColor}.
  Vibe: Professional ${settings.industry}.
  Quality Level: ${qualityKeywords}.`;
  
  if (platform.includes('Stories') || platform.includes('Catalog')) {
     promptText += " Vertical 9:16 aspect ratio composition.";
  }

  // Image Config based on Plan
  const imageConfig = isPro 
    ? { imageSize: "1K" } // gemini-3-pro supports setting size, we default to 1K but prompt implies quality
    : {}; // flash models don't support size param as strictly

  try {
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
        promptText = `Transform reference image into ${visualStyle} shot. Colors: ${settings.primaryColor}, ${settings.secondaryColor}. ${promptText}`;
      }
    }

    parts.push({ text: promptText });

    const response = await ai.models.generateContent({
      model: modelName,
      contents: { parts },
      // @ts-ignore - Some configs might be preview specific
      config: isPro ? { imageConfig } : {}
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
  } catch (error) {
    console.error(`Error generating image with model ${modelName}:`, error);
  }
  return null;
};

export const generateCampaign = async (state: WizardState, settings: BusinessSettings, plan: PlanTier): Promise<CampaignResult> => {
  const angles = [
    "Front view, centered hero shot, minimalist",
    "Lifestyle context, product in use",
    "Close-up macro detail shot",
    "Creative artistic composition"
  ];

  const variants: ContentVariant[] = [];

  for (let i = 0; i < angles.length; i++) {
    const angle = angles[i];
    const [img, txt] = await Promise.all([
      generateVariantImage(state, settings, angle, plan),
      generateVariantCopy(state, settings, angle)
    ]);

    variants.push({
      id: `var-${Date.now()}-${i}`,
      image: img || `https://placehold.co/1080x1350/1e293b/ffffff?text=${encodeURIComponent(state.productData.name || 'Producto')}`,
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