
import { supabase } from "../lib/supabase";
import { WizardState, CampaignResult, ContentVariant, BusinessSettings, PlanTier, ContentType, Platform, CopyFramework } from "../types";

// --- HELPER: Invocador Seguro ---

const invokeAI = async (action: string, payload: any, retries = 1) => {
  try {
    const { data, error } = await supabase.functions.invoke('sellfy-api', {
      body: { action, ...payload }
    });

    if (error) {
      console.error(`Edge Function Network Error (${action}):`, error);
      if (retries > 0) {
          await new Promise(r => setTimeout(r, 2000));
          return invokeAI(action, payload, retries - 1);
      }
      throw new Error("El servidor de IA está tardando en responder.");
    }

    if (data && data.error) {
      console.warn(`API Logic Error (${action}):`, data.error);
      throw new Error(data.error);
    }

    return data;
  } catch (e: any) {
      throw e;
  }
};

// --- GENERADORES ---

// 1. Copy Estratégico (Nuevo)
export const generateStrategicCopy = async (
    imageBase64: string, 
    userContext: string,
    framework: CopyFramework,
    tone: string,
    platform: Platform
): Promise<string> => {
    try {
        const { text } = await invokeAI('generate_strategic_copy', {
            imageBase64,
            userContext,
            framework,
            tone,
            platform
        });
        return text;
    } catch (e) {
        console.error(e);
        return "Error generando el copy estratégico.";
    }
};

export const regenerateCopyOnly = async (
  productName: string, 
  platform: string, 
  tone: string,
  plan: PlanTier = 'free'
): Promise<string> => {
    return "Esta función se ha movido al generador estratégico.";
};

// 2. Animación de Video (Veo)
export const animateImageWithVeo = async (imageBase64: string): Promise<string | null> => {
  try {
    console.log("🎥 Intentando generar video...");
    const response = await invokeAI('animate_image', { image: imageBase64 });

    if (!response || !response.operationName) throw new Error("No se pudo iniciar video.");
    
    const { operationName } = response;
    let attempts = 0;
    const maxAttempts = 30;
    
    while (attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 5000));
        attempts++;
        const status = await invokeAI('get_video_operation', { operationName });
        if (status.done && status.videoUri) return status.videoUri;
    }
    throw new Error("Timeout video.");
  } catch (e: any) {
    console.error("Animation Error:", e);
    throw e;
  }
};

// --- ORQUESTADOR PRINCIPAL ---

const generateVariantContent = async (
  index: number, 
  angle: string, 
  state: WizardState, 
  settings: BusinessSettings, 
  plan: PlanTier
): Promise<ContentVariant> => {
    const { productData } = state;

    let mediaUrl: string | null = null;
    let isVideoResult = false;
    let debugPromptResult = "";

    try {
        // Solo llamamos a la generación visual.
        const mediaResponse = await invokeAI('generate_visual', {
            index,
            angle,
            state,
            settings,
            plan 
        });

        if (mediaResponse.error) {
             console.warn(`⚠️ Error visual: ${mediaResponse.error}`);
             mediaUrl = `https://placehold.co/1080x1350/000?text=Error`;
        } else {
             mediaUrl = mediaResponse.url;
             isVideoResult = mediaResponse.isVideo || false;
             debugPromptResult = mediaResponse.debugPrompt || "";
        }

    } catch (e: any) {
        console.error(`❌ Fallo en variante ${index}:`, e);
        mediaUrl = `https://placehold.co/1080x1350/000?text=ErrorConnection`;
        debugPromptResult = "Error de conexión.";
    }

    return {
        id: `var-${Date.now()}-${index}`,
        image: mediaUrl || "",
        isVideo: isVideoResult,
        copy: "Usa el generador de copy abajo 👇", // Placeholder limpio
        hashtags: [],
        angle: angle,
        debugPrompt: debugPromptResult
    };
};

export const generateCampaign = async (
  state: WizardState, 
  settings: BusinessSettings, 
  plan: PlanTier
): Promise<CampaignResult> => {
  
  console.log(`🚀 Iniciando campaña simple (Solo Imagen)...`);
  
  const isVideo = state.contentType === ContentType.VIDEO_REEL || 
                  state.platform === Platform.TIKTOK || 
                  state.platform === Platform.IG_REELS;
  
  const angles = isVideo 
      ? ["Variation 1", "Variation 2", "Variation 3", "Variation 4"] 
      : ["Variation 1", "Variation 2", "Variation 3", "Variation 4"];

  const variants: ContentVariant[] = [];
  
  for (let i = 0; i < angles.length; i++) {
      const variant = await generateVariantContent(i, angles[i], state, settings, plan);
      variants.push(variant);
      if (i < angles.length - 1) await new Promise(r => setTimeout(r, 200));
  }

  return {
    id: `camp-${Date.now()}`,
    timestamp: Date.now(),
    platform: state.platform!,
    variants: variants
  };
};
