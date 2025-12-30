
import { supabase } from "../lib/supabase";
import { WizardState, CampaignResult, ContentVariant, BusinessSettings, PlanTier, ContentType, Platform, CopyFramework } from "../types";

// --- HELPER: Invocador Seguro ---

const invokeAI = async (action: string, payload: any) => {
  console.log(`📡 Llamando a Edge Function: ${action}`);
  
  // Llama a la Edge Function 'sellfy-api' desplegada en Supabase
  const { data, error } = await supabase.functions.invoke('sellfy-api', {
    body: { action, ...payload }
  });

  if (error) {
    console.error(`Edge Function Error (${action}):`, error);
    // Si el error es de conexión o timeout, damos un mensaje amigable
    throw new Error("Error de conexión con el servidor de IA. Por favor intenta de nuevo.");
  }

  // Si la función devuelve un error explícito en el JSON
  if (data && data.error) {
    throw new Error(data.error);
  }

  return data;
};

// --- HELPER: Image Optimizer ---
const optimizeImageForUpload = async (base64Str: string): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = base64Str;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 800; // Suficiente para referencia de IA
            const scaleSize = MAX_WIDTH / img.width;
            canvas.width = MAX_WIDTH;
            canvas.height = img.height * scaleSize;
            
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
            // Comprimir a JPEG 0.6
            resolve(canvas.toDataURL('image/jpeg', 0.6));
        };
        img.onerror = () => resolve(base64Str); // Fallback a original si falla
    });
};

// --- SERVICIOS ---

// 1. Analizar Imagen (Vision)
export const analyzeProductImage = async (imageBase64: string): Promise<string> => {
    try {
        const optimizedImage = await optimizeImageForUpload(imageBase64);
        const data = await invokeAI('analyze_image', { imageBase64: optimizedImage });
        return data?.analysis || "Producto detectado";
    } catch {
        return "Producto general";
    }
};

// 2. Generar Copy Estratégico (Modal Compartido)
export const generateStrategicCopy = async (
    _imageBase64: string, // Unused but kept for interface compatibility if needed
    userContext: string,
    framework: CopyFramework,
    tone: string,
    platform: Platform
): Promise<string> => {
    try {
        const data = await invokeAI('generate_strategic_copy', {
            // No enviamos imagen para copy para ahorrar ancho de banda
            userContext,
            framework,
            tone,
            platform
        });
        return data?.text || `${userContext} - ¡Disponible ahora!`;
    } catch {
        return `${userContext}. \n\n#fyp #viral`;
    }
};

// 3. Generar Copy para Variante (Wizard) - Adaptado para usar 'generate_strategic_copy'
export const generateVariantCopy = async (state: WizardState, settings: BusinessSettings, angleDescription: string): Promise<{ copy: string, hashtags: string[] }> => {
  try {
    const userContext = `Producto: ${state.productData.name}. Beneficio: ${state.productData.benefit}. Contexto visual: ${angleDescription}`;
    
    const result = await invokeAI('generate_strategic_copy', {
      userContext,
      framework: CopyFramework.AIDA,
      tone: settings.tone,
      platform: state.platform
    });
    
    // El backend ahora devuelve { text: string }, adaptamos a la interfaz esperada
    const fullText = result.text || "";
    // Extracción simple de hashtags si están al final
    const hashtags = fullText.match(/#[a-z0-9_]+/gi) || ["#sellfy", "#viral"];
    const copy = fullText.replace(/#[a-z0-9_]+/gi, "").trim();

    return { copy, hashtags };
  } catch (error) {
    console.warn("Fallo en generación de copy, usando fallback local:", error);
    return { 
      copy: `${state.productData.name} - ${state.productData.benefit} 🔥\n\n${state.productData.description || ''}`, 
      hashtags: ["#sellfy", "#viral", "#trending"] 
    };
  }
};

// 4. Regenerar solo texto - Adaptado
export const regenerateCopyOnly = async (productName: string, platform: string, tone: string): Promise<string> => {
  try {
    const { text } = await invokeAI('generate_strategic_copy', {
      userContext: productName,
      framework: CopyFramework.PAS,
      tone,
      platform
    });
    return text;
  } catch (e) {
    console.error(e);
    return "Error al regenerar texto. Intenta de nuevo.";
  }
};

// 5. Animación de Video (Veo)
export const animateImageWithVeo = async (imageBase64: string): Promise<string | null> => {
  try {
    const optimizedImage = await optimizeImageForUpload(imageBase64);
    
    // Paso 1: Iniciar operación
    const { operationName } = await invokeAI('animate_image', {
      image: optimizedImage
    });

    if (!operationName) throw new Error("No se recibió ID de operación");

    // Paso 2: Polling (Preguntar estado)
    let attempts = 0;
    const maxAttempts = 24; // ~2 minutos (5s intervalo)

    while (attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 5000));
        attempts++;
        
        const status = await invokeAI('get_video_operation', { operationName });
        
        if (status.done && status.videoUri) {
            return status.videoUri; 
        }
    }
    return null;
  } catch (e) {
    console.error("Animation Error:", e);
    return null;
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
        const optimizedBase = await optimizeImageForUpload(state.productData.baseImage || "");

        // Ejecutar generación visual y textual en paralelo
        const [mediaResponse, copyResponse] = await Promise.all([
            invokeAI('generate_visual', {
                state: { ...state, productData: { ...state.productData, baseImage: optimizedBase } },
                angle,
                plan,
                isVideoRequest
            }),
            generateVariantCopy(state, settings, angle)
        ]);

        mediaUrl = mediaResponse.url;
        isVideoResult = mediaResponse.isVideo;
        textData = copyResponse;

    } catch (e) {
        console.error("Fallo generando variante:", e);
        // Fallback visual si falla la IA
        mediaUrl = `https://placehold.co/1080x1350/1e293b/ffffff?text=${encodeURIComponent(productData.name || 'Error')}`;
        
        // Intentamos recuperar texto aunque falle la imagen
        textData = await generateVariantCopy(state, settings, angle).catch(() => ({ copy: productData.name || "Producto", hashtags: [] }));
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
