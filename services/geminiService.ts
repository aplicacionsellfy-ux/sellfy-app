import { supabase } from "../lib/supabase";
import { WizardState, CampaignResult, ContentVariant, BusinessSettings, PlanTier, ContentType, Platform, CopyFramework } from "../types";

// --- HELPER: Image Optimizer ---
// Supabase Functions tienen limite de body size (6MB).
// Redimensionamos la imagen antes de enviarla.
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

// --- HELPER: Invocador Seguro ---

const invokeAI = async (action: string, payload: any, retries = 0): Promise<any> => {
  try {
    const { data, error } = await supabase.functions.invoke('sellfy-api', {
      body: { action, ...payload }
    });

    if (error) {
      console.warn(`Edge Function Warning (${action}):`, error);
      throw new Error("Error de conexión con el servidor de IA.");
    }

    if (data && data.error) {
       throw new Error(data.error);
    }

    return data;
  } catch (e: any) {
      console.error(`Error en ${action}:`, e);
      throw e;
  }
};

// --- SERVICIOS ---

export const analyzeProductImage = async (imageBase64: string): Promise<string> => {
    try {
        const optimizedImage = await optimizeImageForUpload(imageBase64);
        const data = await invokeAI('analyze_image', { imageBase64: optimizedImage });
        return data?.analysis || "Producto detectado";
    } catch {
        return "Producto general";
    }
};

export const generateStrategicCopy = async (
    imageBase64: string, 
    userContext: string,
    framework: CopyFramework,
    tone: string,
    platform: Platform
): Promise<string> => {
    try {
        const data = await invokeAI('generate_strategic_copy', {
            imageBase64: "", // No enviamos imagen para copy para ahorrar ancho de banda, usamos el contexto
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

export const animateImageWithVeo = async (imageBase64: string): Promise<string | null> => {
    try {
        const optimizedImage = await optimizeImageForUpload(imageBase64);
        const response = await invokeAI('animate_image', { image: optimizedImage });
        if (!response?.operationName) return null;
        
        // Polling
        let attempts = 0;
        while (attempts < 15) {
            await new Promise(r => setTimeout(r, 5000));
            attempts++;
            const status = await invokeAI('get_video_operation', { operationName: response.operationName });
            if (status?.done && status?.videoUri) return status.videoUri;
        }
        return null;
    } catch {
        return null;
    }
};

export const regenerateCopyOnly = async (productName: string, platform: string, tone: string): Promise<string> => {
    try {
        const data = await invokeAI('generate_strategic_copy', {
            userContext: productName,
            framework: CopyFramework.PAS,
            tone,
            platform
        });
        return data?.text || "Texto regenerado. Descubre más en nuestro perfil.";
    } catch {
        return "Texto regenerado. Descubre más en nuestro perfil.";
    }
};

// --- GENERADOR PRINCIPAL ---

const generateVariantContent = async (
  index: number, 
  angle: string, 
  state: WizardState, 
  settings: BusinessSettings
): Promise<ContentVariant> => {
    
    let mediaUrl: string;
    
    try {
        // 1. Optimizar imagen base
        const optimizedBase = await optimizeImageForUpload(state.productData.baseImage || "");

        // 2. Llamada REAL a Gemini (Image-to-Image)
        console.log(`Generando visual ${index}...`);
        const visualResponse = await invokeAI('generate_visual', {
            state: { ...state, productData: { ...state.productData, baseImage: optimizedBase } }, // Enviar optimizada
            angle
        });
        
        mediaUrl = visualResponse.url;

    } catch (e) {
        console.error("Fallo generación imagen:", e);
        // Fallback visual de error (texto sobre negro)
        mediaUrl = `https://placehold.co/1080x1350/000000/FFF?text=Error+Generando+Imagen`;
    }

    // 3. Generar Copy (Simple)
    let copyText = "";
    try {
        const copyRes = await invokeAI('generate_strategic_copy', {
            userContext: `${state.productData.name} - ${state.productData.benefit}`,
            framework: CopyFramework.AIDA,
            tone: settings.tone,
            platform: state.platform
        });
        copyText = copyRes.text;
    } catch {
        copyText = `🔥 ${state.productData.name} \n\n${state.productData.benefit}`;
    }

    return {
        id: `var-${Date.now()}-${index}`,
        image: mediaUrl,
        isVideo: false,
        copy: copyText,
        hashtags: ["#trend", "#viral"],
        angle: angle,
        debugPrompt: `Gemini i2i: ${angle}`
    };
};

export const generateCampaign = async (
  state: WizardState, 
  settings: BusinessSettings, 
  plan: PlanTier
): Promise<CampaignResult> => {
  
  const isVideo = state.contentType === ContentType.VIDEO_REEL || 
                  state.platform === Platform.TIKTOK || 
                  state.platform === Platform.IG_REELS;
  
  const angles = isVideo 
      ? ["Cinematic Reveal", "Close Up"] 
      : ["Hero Shot", "Lifestyle Context", "Creative Angle", "Detail Shot"];

  const variants: ContentVariant[] = [];
  
  // Procesamiento secuencial para evitar timeouts multiples y rate limits
  for (let i = 0; i < angles.length; i++) {
      const v = await generateVariantContent(i, angles[i], state, settings);
      variants.push(v);
  }

  return {
    id: `camp-${Date.now()}`,
    timestamp: Date.now(),
    platform: state.platform!,
    variants: variants
  };
};