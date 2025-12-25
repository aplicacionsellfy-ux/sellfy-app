
import { supabase } from "../lib/supabase";
import { WizardState, CampaignResult, ContentVariant, BusinessSettings, PlanTier, ContentType, Platform } from "../types";

// --- HELPER: Invocador Seguro ---

const invokeAI = async (action: string, payload: any) => {
  // Llama a la Edge Function 'sellfy-api' desplegada en Supabase
  const { data, error } = await supabase.functions.invoke('sellfy-api', {
    body: { action, ...payload }
  });

  if (error) {
    console.error(`Edge Function Network Error (${action}):`, error);
    // Si ocurre un error de red real (Edge Function crasheada o timeout de red)
    throw new Error("El servidor de IA está ocupado. Por favor intenta de nuevo en unos segundos.");
  }

  // Si la función ejecutó pero devolvió un error lógico
  if (data && data.error) {
    // Loguear pero lanzar error limpio
    console.warn(`API Error (${action}):`, data.error);
    throw new Error(data.error);
  }

  return data;
};

// --- GENERADORES ---

// 1. Generar Textos (Copy)
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
    console.warn("Usando fallback de texto local:", error);
    return { 
      copy: `${state.productData.name} - ${state.productData.benefit} 🔥`, 
      hashtags: ["#sellfy"] 
    };
  }
};

// 2. Regenerar solo texto
export const regenerateCopyOnly = async (productName: string, platform: string, tone: string): Promise<string> => {
  try {
    const { text } = await invokeAI('regenerate_copy', {
      productName,
      platform,
      tone
    });
    return text;
  } catch (e: any) {
    return "Error regenerando texto.";
  }
};

// 3. Animación de Video (Veo)
export const animateImageWithVeo = async (imageBase64: string): Promise<string | null> => {
  try {
    console.log("🎥 Solicitando video a Veo...");
    
    // Paso 1: Iniciar operación
    const response = await invokeAI('animate_image', {
      image: imageBase64
    });

    if (!response || !response.operationName) {
        throw new Error("No se pudo iniciar la generación de video.");
    }
    
    const { operationName } = response;
    console.log(`Video iniciado (${operationName}). Esperando renderizado...`);

    // Paso 2: Polling (Preguntar estado)
    // Aumentamos los intentos porque Veo puede tardar 1-2 minutos
    let attempts = 0;
    const maxAttempts = 60; // 5 minutos aprox (5s * 60)
    
    while (attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 5000)); // Esperar 5s
        attempts++;
        
        try {
            const status = await invokeAI('get_video_operation', { operationName });
            
            if (status.done) {
                if (status.videoUri) {
                    console.log("¡Video listo!");
                    return status.videoUri;
                } else {
                    console.error("Video marcado como listo pero sin URL", status);
                    throw new Error("Error recuperando el archivo de video.");
                }
            }
            // Si devuelve done: false, simplemente seguimos esperando
            
        } catch (pollError) {
            // Si el polling falla (red, etc), lo ignoramos y seguimos intentando
            console.warn(`Polling warning (intento ${attempts}):`, pollError);
        }
        
        console.log(`Renderizando video... ${Math.round((attempts/maxAttempts)*100)}%`);
    }

    throw new Error("El video está tardando demasiado. Intenta más tarde.");

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
        // Si hay error explícito en la respuesta de imagen
        if (mediaResponse.error) {
             console.warn("Error visual detectado:", mediaResponse.error);
             mediaUrl = `https://placehold.co/1080x1350/1e293b/ffffff?text=${encodeURIComponent(productData.name)}+Error`;
        }

        isVideoResult = mediaResponse.isVideo;
        textData = copyResponse;

    } catch (e) {
        console.error(`Fallo total en variante ${index}:`, e);
        mediaUrl = `https://placehold.co/1080x1350/1e293b/ffffff?text=Error+Generando`;
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

  console.log(`🚀 Iniciando campaña...`);

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
