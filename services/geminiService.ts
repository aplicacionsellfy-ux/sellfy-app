
import { supabase } from "../lib/supabase";
import { WizardState, CampaignResult, ContentVariant, BusinessSettings, PlanTier, ContentType, Platform } from "../types";

// --- HELPER: Invocador Seguro ---

const invokeAI = async (action: string, payload: any) => {
  // Llama a la Edge Function 'sellfy-api' desplegada en Supabase
  const { data, error } = await supabase.functions.invoke('sellfy-api', {
    body: { action, ...payload }
  });

  if (error) {
    console.error(`Edge Function Error (${action}):`, error);
    // Si es un error de red o timeout
    throw new Error("Error de conexión con la IA. Verifica tu internet.");
  }

  // Si la función devuelve un error explícito en el JSON (manejado por nuestro try-catch global en el backend)
  if (data && data.error) {
    console.error(`API Logic Error (${action}):`, data.error);
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
    console.warn("Fallo en generación de copy, usando fallback local:", error);
    return { 
      copy: `${state.productData.name} - ${state.productData.benefit} 🔥\n\n${state.productData.description || ''}`, 
      hashtags: ["#sellfy", "#viral", "#trending"] 
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
  } catch (e) {
    console.error(e);
    return "Error al regenerar texto.";
  }
};

// 3. Animación de Video (Veo)
export const animateImageWithVeo = async (imageBase64: string): Promise<string | null> => {
  try {
    console.log("🎥 Iniciando animación en servidor...");
    
    // Paso 1: Iniciar operación
    const response = await invokeAI('animate_image', {
      image: imageBase64
    });

    if (!response || !response.operationName) {
        throw new Error("No se recibió ID de operación del servidor.");
    }
    
    const { operationName } = response;
    console.log(`Operación iniciada: ${operationName}`);

    // Paso 2: Polling (Preguntar estado)
    let attempts = 0;
    const maxAttempts = 60; // Aumentado a 5 minutos (5s * 60) para dar tiempo a Veo
    
    while (attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 5000)); // Esperar 5s
        attempts++;
        
        console.log(`Verificando video (Intento ${attempts}/${maxAttempts})...`);
        const status = await invokeAI('get_video_operation', { operationName });
        
        if (status.done) {
            if (status.videoUri) {
                console.log("¡Video completado!");
                return status.videoUri;
            } else {
                console.error("Operación terminada pero sin URI de video", status);
                throw new Error("Video generado pero URL no encontrada.");
            }
        }
        
        // Si hay un error de depuración en el backend, lo logueamos pero seguimos intentando
        if (status.debugError) {
             console.warn("Polling warning:", status.debugError);
        }
    }

    throw new Error("Tiempo de espera agotado generando video.");

  } catch (e: any) {
    console.error("Animation Error:", e);
    // Propagar el mensaje de error para que el Toast lo muestre
    throw new Error(e.message || "Error generando video");
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
        // Ejecutar generación visual y textual en paralelo
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
        // Si devuelve error explícito en la imagen
        if (mediaResponse.error) {
             console.error("Error visual:", mediaResponse.error);
             mediaUrl = `https://placehold.co/1080x1350/1e293b/ffffff?text=${encodeURIComponent(productData.name)}+Error`;
        }

        isVideoResult = mediaResponse.isVideo;
        textData = copyResponse;

    } catch (e) {
        console.error("Fallo generando variante:", e);
        mediaUrl = `https://placehold.co/1080x1350/1e293b/ffffff?text=${encodeURIComponent(productData.name)}`;
        textData = await generateVariantCopy(state, settings, angle).catch(() => ({ copy: productData.name, hashtags: [] }));
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
  
  // Generación secuencial
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
