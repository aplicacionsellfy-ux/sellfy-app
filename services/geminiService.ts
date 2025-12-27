
import { supabase } from "../lib/supabase";
import { WizardState, CampaignResult, ContentVariant, BusinessSettings, PlanTier, ContentType, Platform } from "../types";

// --- HELPER: Invocador Seguro con Reintentos ---

const invokeAI = async (action: string, payload: any, retries = 1) => {
  try {
    const { data, error } = await supabase.functions.invoke('sellfy-api', {
      body: { action, ...payload }
    });

    if (error) {
      console.error(`Edge Function Network Error (${action}):`, error);
      // Si es un error de red, reintentamos una vez
      if (retries > 0) {
          console.log(`Reintentando ${action}...`);
          await new Promise(r => setTimeout(r, 2000));
          return invokeAI(action, payload, retries - 1);
      }
      throw new Error("El servidor de IA está tardando en responder.");
    }

    // Si la función devuelve un error explícito en el JSON (Status 200 pero logical error)
    if (data && data.error) {
      console.warn(`API Logic Error (${action}):`, data.error);
      throw new Error(data.error);
    }

    return data;
  } catch (e: any) {
      // Manejo final de excepción
      throw e;
  }
};

// --- GENERADORES ---

export const generateVariantCopy = async (
  state: WizardState, 
  settings: BusinessSettings, 
  angleDescription: string,
  plan: PlanTier
): Promise<{ copy: string, hashtags: string[] }> => {
  try {
    const result = await invokeAI('generate_copy', {
      productData: state.productData,
      platform: state.platform,
      settings,
      angle: angleDescription,
      plan 
    });
    return result;
  } catch (error) {
    console.warn("Fallback local (copy):", error);
    return { 
      copy: `¡Descubre ${state.productData.name}! 🔥\n\n✅ ${state.productData.benefit}\n\n👇 ¡No te lo pierdas!`, 
      hashtags: ["#fyp", "#parati", "#nuevo", "#viral", "#promo"]
    };
  }
};

export const regenerateCopyOnly = async (
  productName: string, 
  platform: string, 
  tone: string,
  plan: PlanTier = 'free'
): Promise<string> => {
  try {
    const { text } = await invokeAI('regenerate_copy', { 
      productName, 
      platform, 
      tone,
      plan 
    });
    return text;
  } catch (e: any) {
    console.error("Error regenerando texto:", e);
    return `¡Nuevo texto para ${productName}! Próximamente más detalles.`;
  }
};

// 3. Animación de Video (Veo) - Polling Robusto
export const animateImageWithVeo = async (imageBase64: string): Promise<string | null> => {
  try {
    console.log("🎥 Intentando generar video...");
    
    // Iniciar operación
    const response = await invokeAI('animate_image', {
      image: imageBase64
    });

    if (!response || !response.operationName) {
        throw new Error(response?.error || "No se pudo iniciar el servicio de video.");
    }
    
    const { operationName } = response;
    console.log(`Video iniciado (${operationName}).`);

    // Veo puede tardar 1-2 minutos. Aumentamos intentos y tiempo de espera.
    let attempts = 0;
    const maxAttempts = 30; // 30 intentos
    const interval = 5000; // 5 segundos
    
    while (attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, interval));
        attempts++;
        
        try {
            // Consultar estado
            const status = await invokeAI('get_video_operation', { operationName });
            
            if (status.done) {
                if (status.videoUri) {
                    return status.videoUri;
                } else {
                    console.error("Video marcado como listo pero sin URL", status);
                    throw new Error("El video se generó pero no se pudo recuperar la URL.");
                }
            }
            
            // Si el backend devuelve debugError (error manejado), solo logueamos
            if (status.debugError) {
                console.log(`Polling wait (Backend handled error): ${status.debugError}`);
            }

        } catch (pollError: any) {
            console.warn(`Polling network warning (intento ${attempts}):`, pollError);
            // No lanzamos error aquí, seguimos intentando en el siguiente loop
        }
        
        console.log(`⏳ Procesando video... ${attempts}/${maxAttempts}`);
    }

    throw new Error("El video está tardando demasiado en procesarse.");

  } catch (e: any) {
    console.error("❌ Animation Error:", e);
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
    let textData = { copy: "", hashtags: [] as string[] };

    try {
        // Ejecutar en paralelo la generación de imagen y texto
        const [mediaResponse, copyResponse] = await Promise.all([
            invokeAI('generate_visual', {
                index,
                angle,
                state,
                settings,
                plan 
            }),
            generateVariantCopy(state, settings, angle, plan)
        ]);

        // Procesar respuesta de imagen
        if (mediaResponse.error) {
             console.warn(`⚠️ Error visual reportado: ${mediaResponse.error}`);
             // Fallback local visual
             const primaryColor = settings.primaryColor.replace('#', '');
             const secondaryColor = settings.secondaryColor.replace('#', '');
             mediaUrl = mediaResponse.url || `https://placehold.co/1080x1350/${primaryColor}/${secondaryColor}?text=${encodeURIComponent(productData.name)}`;
        } else {
             mediaUrl = mediaResponse.url;
             isVideoResult = mediaResponse.isVideo || false;
        }

        textData = copyResponse;

    } catch (e: any) {
        console.error(`❌ Fallo total en variante ${index}:`, e);
        
        // Fallback completo de emergencia
        const primaryColor = settings.primaryColor.replace('#', '');
        const secondaryColor = settings.secondaryColor.replace('#', '');
        mediaUrl = `https://placehold.co/1080x1350/${primaryColor}/${secondaryColor}?text=${encodeURIComponent(productData.name)}`;
        textData = { 
            copy: `¡Atención! 🚨\n\n${productData.name}\n\n✅ ${productData.benefit}\n\n👇 ¡Descúbrelo ahora!`,
            hashtags: ["#nuevo", "#fyp", "#viral", "#promo", "#shop"]
        };
    }

    return {
        id: `var-${Date.now()}-${index}`,
        image: mediaUrl || "",
        isVideo: isVideoResult,
        copy: textData.copy || productData.name,
        hashtags: textData.hashtags || [],
        angle: angle
    };
};

export const generateCampaign = async (
  state: WizardState, 
  settings: BusinessSettings, 
  plan: PlanTier
): Promise<CampaignResult> => {
  
  console.log(`🚀 Iniciando generación de campaña (Plan: ${plan})...`);
  
  const isVideo = state.contentType === ContentType.VIDEO_REEL || 
                  state.platform === Platform.TIKTOK || 
                  state.platform === Platform.IG_REELS;
  
  const angles = isVideo 
      ? ["Dynamic Reveal", "Lifestyle Usage", "Cinematic Mood", "Product Details"] 
      : ["Hero Shot (Centered)", "Lifestyle Context", "Creative Angle", "Close-up Detail"];

  const variants: ContentVariant[] = [];
  
  // Generar variantes secuencialmente para evitar saturar la API
  for (let i = 0; i < angles.length; i++) {
      console.log(`📝 Generando variante ${i + 1}/${angles.length}: ${angles[i]}`);
      const variant = await generateVariantContent(i, angles[i], state, settings, plan);
      variants.push(variant);
      
      // Pequeña pausa entre variantes para dar respiro al servidor
      if (i < angles.length - 1) {
          await new Promise(r => setTimeout(r, 500));
      }
  }

  return {
    id: `camp-${Date.now()}`,
    timestamp: Date.now(),
    platform: state.platform!,
    variants: variants
  };
};
