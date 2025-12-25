
// @ts-nocheck
import { GoogleGenAI, Type } from "https://esm.sh/@google/genai";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  // 1. Manejo de CORS (Preflight)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 2. Validación de API Key
    const apiKey = Deno.env.get('API_KEY');
    if (!apiKey) {
      console.error("Falta API_KEY en variables de entorno");
      return new Response(JSON.stringify({ error: "Configuración del servidor incompleta (Falta API Key)." }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const ai = new GoogleGenAI({ apiKey });
    
    // 3. Parseo seguro del Body
    let payload;
    try {
        payload = await req.json();
    } catch (e) {
        throw new Error("El cuerpo de la solicitud no es un JSON válido.");
    }
    
    const { action, ...data } = payload;
    console.log(`[Sellfy API] Acción solicitada: ${action}`);

    // --- A. Generar Texto (Copywriting) ---
    if (action === 'generate_copy') {
        const { productData, platform, settings, angle } = data;
        const prompt = `
          ROLE: Expert Social Media Copywriter.
          TASK: Write a spanish caption for "${productData.name}".
          CONTEXT: Platform: ${platform}. Angle: ${angle}. Tone: ${settings.tone}.
          PRODUCT INFO: ${productData.benefit}.
          OUTPUT: JSON with 'copy' (text) and 'hashtags' (array of strings).
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
                        }
                    }
                }
            });
            const result = JSON.parse(response.text || '{"copy": "", "hashtags": []}');
            return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        } catch (e) {
            console.error("Error generando copy:", e);
            // Fallback silencioso
            return new Response(JSON.stringify({ 
                copy: `${productData.name} - ${productData.benefit} 🚀`, 
                hashtags: ["#sellfy", "#promo"] 
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
    }

    // --- B. Regenerar Texto ---
    if (action === 'regenerate_copy') {
        const { productName, platform, tone } = data;
        const prompt = `Reescribe un caption corto para "${productName}". Plataforma: ${platform}. Tono: ${tone}. Español.`;
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
        });
        return new Response(JSON.stringify({ text: response.text }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // --- C. Generar Imagen Visual (Alta Fidelidad) ---
    if (action === 'generate_visual') {
        const { angle, state, settings } = data;
        const { productData, visualStyle } = state;

        const parts = [];
        let hasImage = false;

        // 1. Imagen Base (Reference Image)
        if (state.productData.baseImage) {
            // Limpieza de base64 header si existe
            const matches = state.productData.baseImage.match(/^data:([^;]+);base64,(.+)$/);
            if (matches) {
                hasImage = true;
                parts.push({
                    inlineData: {
                        mimeType: matches[1], // Ej: image/png
                        data: matches[2]      // Base64 raw
                    }
                });
            }
        }

        // 2. Prompt de Ingeniería para Fidelidad
        let promptText = "";
        if (hasImage) {
           promptText = `
             You are a Product Photographer doing post-production.
             
             CRITICAL INSTRUCTION:
             The image provided is the **Reference Product**. 
             You must KEEP the product appearance exactly as it is. Do NOT hallucinate a new product.
             
             TASK:
             Place this exact product in a new background context.
             
             BACKGROUND SETTINGS:
             - Style: ${visualStyle}
             - Lighting Colors: ${settings.primaryColor} and ${settings.secondaryColor}
             - Environment: ${productData.benefit}
             - Camera Angle: ${angle}
             
             Output: High resolution product photography.
           `;
        } else {
           promptText = `
             Create a high-quality product photography for "${productData.name}".
             Style: ${visualStyle}.
             Colors: ${settings.primaryColor}, ${settings.secondaryColor}.
             Context: ${productData.benefit}.
             Angle: ${angle}.
             Professional lighting, 4k resolution.
           `;
        }
        parts.push({ text: promptText });

        try {
            // Usamos gemini-2.5-flash-image (Nano Banana) para mejor coherencia visual
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image', 
                contents: { parts: parts },
                config: {} // Nano banana no soporta muchos configs avanzados, mejor dejar vacío
            });

            // Extraer la imagen de la respuesta
            let b64 = null;
            if (response.candidates?.[0]?.content?.parts) {
                for (const part of response.candidates[0].content.parts) {
                    if (part.inlineData) {
                        b64 = part.inlineData.data;
                        break;
                    }
                }
            }

            if (b64) {
                return new Response(JSON.stringify({ url: `data:image/png;base64,${b64}`, isVideo: false }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
            throw new Error("El modelo no devolvió datos de imagen.");

        } catch (e) {
            console.error("Error generando imagen:", e);
            // No fallamos la petición completa, devolvemos un placeholder y el error
            return new Response(JSON.stringify({ 
                url: `https://placehold.co/1080x1080/1e293b/ffffff?text=Error+Generando+Imagen`, 
                isVideo: false,
                error: e.message 
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
    }

    // --- D. Animar Imagen (Video - Veo) ---
    if (action === 'animate_image') {
        const { image } = data; 
        
        try {
            const matches = image.match(/^data:([^;]+);base64,(.+)$/);
            if (!matches) throw new Error("Formato de imagen inválido para video");

            const operation = await ai.models.generateVideos({
                model: 'veo-3.1-fast-generate-preview',
                prompt: "Cinematic pan, slow motion, professional commercial lighting, 4k.",
                image: { 
                    imageBytes: matches[2], 
                    mimeType: matches[1] 
                },
                config: { 
                    numberOfVideos: 1,
                    resolution: '720p',
                    aspectRatio: '9:16'
                }
            });

            console.log("Video operation started:", operation.name);

            return new Response(JSON.stringify({ operationName: operation.name }), {
                 headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        } catch (e) {
            console.error("Error iniciando video:", e);
            // Devolvemos 200 con error JSON
            return new Response(JSON.stringify({ error: `No se pudo iniciar el video: ${e.message}` }), {
                 headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
    }

    // --- E. Consultar Estado Video (Polling Seguro) ---
    if (action === 'get_video_operation') {
        const { operationName } = data;
        
        if (!operationName) {
             return new Response(JSON.stringify({ done: false, error: "Falta operationName" }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        try {
            // USAMOS getOperation (Genérico) en lugar de getVideosOperation para evitar errores de tipo en runtime
            // Esto es mucho más seguro para polling.
            const operation = await ai.operations.getOperation({ name: operationName });
            
            let videoUri = null;
            
            // Verificamos si terminó
            if (operation.done) {
                 // La estructura de respuesta de Veo puede variar, buscamos el URI con cuidado
                 const responseMetadata = operation.response || operation.result;
                 const generatedVideo = responseMetadata?.generatedVideos?.[0];
                 const rawUri = generatedVideo?.video?.uri;
                 
                 if (rawUri) {
                     // Adjuntar API Key es OBLIGATORIO para descargar el video
                     videoUri = `${rawUri}&key=${apiKey}`;
                 } else {
                     console.warn("Operación terminada pero sin URI de video:", operation);
                 }
            }

            return new Response(JSON.stringify({ done: !!operation.done, videoUri }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });

        } catch (e) {
            console.error("Error en polling de video:", e);
            // IMPORTANTE: Devolvemos 'done: false' en lugar de explotar.
            // Esto permite que el frontend siga intentando un par de veces más.
            return new Response(JSON.stringify({ 
                done: false, 
                debugError: e.message 
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
    }

    return new Response(JSON.stringify({ error: `Acción desconocida: ${action}` }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error: any) {
    // --- CATCH-ALL GLOBAL DE SEGURIDAD ---
    // Atrapa cualquier error síncrono o asíncrono no manejado y devuelve JSON 200
    // para evitar la pantalla de error 500 en el cliente.
    const errorMessage = error instanceof Error ? error.message : "Error desconocido en el servidor";
    console.error("🔥 GLOBAL SERVER CRASH EVITED:", errorMessage);
    
    return new Response(JSON.stringify({ 
        error: `Error interno del sistema: ${errorMessage}` 
    }), {
      status: 200, // Status 200 para que el cliente pueda leer el JSON de error
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
