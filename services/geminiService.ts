
import { supabase } from "../lib/supabase";
import { WizardState, CampaignResult, ContentVariant, BusinessSettings, PlanTier, ContentType, Platform } from "../types";

// --- HELPER: Invocador Seguro ---

const invokeAI = async (action: string, payload: any) => {
  const { data, error } = await supabase.functions.invoke('sellfy-api', {
    body: { action, ...payload }
  });

  if (error) {
    console.error(`Edge Function Network Error (${action}):`, error);
    throw new Error("El servidor de IA no responde. Intenta de nuevo.");
  }

  if (data && data.error) {
    console.warn(`API Error (${action}):`, data.error);
    throw new Error(data.error);
  }

  return data;
};

// --- GENERADORES ---

export const generateVariantCopy = async (state: WizardState, settings: BusinessSettings, angleDescription: string): Promise<{ copy: string, hashtags: string[] }> => {
  try {
    const result = await invokeAI('generate_copy', {
      productData: state.productData,
      platform: state.platform,
      settings,
      angle: angleDescription
    });
    return result;
  } catch (error) {
    console.warn("Fallback local:", error);
    return { 
      copy: `${state.productData.name} - ${state.productData.benefit} 🔥`, 
      hashtags: ["#sellfy"] 
    };
  }
};

export const regenerateCopyOnly = async (productName: string, platform: string, tone: string): Promise<string> => {
  try {
    const { text } = await invokeAI('regenerate_copy', { productName, platform, tone });
    return text;
  } catch (e: any) {
    return "Error regenerando texto.";
  }
};

// 3. Animación de Video (Veo)
export const animateImageWithVeo = async (imageBase64: string): Promise<string | null> => {
  try {
    console.log("🎥 Solicitando video a Veo...");
    
    const response = await invokeAI('animate_image', {
      image: imageBase64
    });

    if (!response || !response.operationName) {
        throw new Error("No se pudo iniciar la generación de video.");
    }
    
    const { operationName } = response;
    console.log(`Video iniciado (${operationName}).`);

    let attempts = 0;
    const maxAttempts = 40; // ~3.5 min
    
    while (attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 5000));
        attempts++;
        
        try {
            const status = await invokeAI('get_video_operation', { operationName });
            
            // Si el servidor reportó un error interno en el polling, lo mostramos
            if (status.debugError) {
                console.warn(`[Polling Server Error - Intento ${attempts}]:`, status.debugError);
            }

            if (status.done) {
                if (status.videoUri) {
                    return status.videoUri;
                } else {
                    console.error("Video marcado como listo pero sin URL", status);
                    throw new Error("Error recuperando el archivo de video.");
                }
            }
        } catch (pollError) {
            console.warn(`Network Polling warning (intento ${attempts}):`, pollError);
        }
    }

    throw new Error("El video está tardando demasiado en procesarse.");

  } catch (e: any) {
    console.error("Animation Error:", e);
    throw e;
  }
};

// --- ORQUESTADOR PRINCIPAL ---

const generateVariantContent = async (index: number, angle: string, state: WizardState, settings: BusinessSettings, plan: PlanTier): Promise<ContentVariant> => {
    const { productData, platform, contentType } = state;
    const isVideoRequest = contentType === ContentType.VIDEO_REEL || platform === Platform.TIKTOK || platform === Platform.IG_REELS;

    let mediaUrl: string | null = null;
    let isVideoResult = false;
    let textData = { copy: "", hashtags: [] as string[] };

    try {
        const [mediaResponse, copyResponse] = await Promise.all([
            invokeAI('generate_visual', {
                index,
                angle,
                state,
                settings,
                plan,
                isVideoRequest
            }),
            generateVariantCopy(state, settings, angle)
        ]);

        mediaUrl = mediaResponse.url;
        if (mediaResponse.error) {
             console.warn("Error visual detectado:", mediaResponse.error);
             mediaUrl = `https://placehold.co/1080x1350/1e293b/ffffff?text=${encodeURIComponent(productData.name)}+Error`;
        }

        isVideoResult = mediaResponse.isVideo;
        textData = copyResponse;

    } catch (e) {
        console.error(`Fallo total en variante ${index}:`, e);
        mediaUrl = `https://placehold.co/1080x1350/1e293b/ffffff?text=Error`;
        textData = { copy: productData.name, hashtags: [] };
    }

    return {
        id: `var-${Date.now()}-${index}`,
        image: mediaUrl || "",
        isVideo: isVideoResult,
        copy: textData.copy || "",
        hashtags: textData.hashtags || [],
        angle: angle
    };
};

export const generateCampaign = async (state: WizardState, settings: BusinessSettings, plan: PlanTier): Promise<CampaignResult> => {
  const isVideo = state.contentType === ContentType.VIDEO_REEL || state.platform === Platform.TIKTOK || state.platform === Platform.IG_REELS;
  
  const angles = isVideo 
      ? ["Dynamic Reveal", "Lifestyle Usage", "Cinematic Mood", "Product Details"] 
      : ["Hero Shot (Centered)", "Lifestyle Context", "Creative Angle", "Close-up Detail"];

  const variants: ContentVariant[] = [];
  
  for (let i = 0; i < angles.length; i++) {
      const variant = await generateVariantContent(i, angles[i], state, settings, plan);
      variants.push(variant);
  }

  return {
    id: `camp-${Date.now()}`,
    timestamp: Date.now(),
    platform: state.platform!,
    variants: variants
  };
};
