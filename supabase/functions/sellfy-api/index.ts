
// @ts-nocheck
import { GoogleGenAI, Type } from "@google/genai";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  // 1. Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 2. Obtener API Key de forma segura
    const apiKey = Deno.env.get('API_KEY');
    if (!apiKey) {
      throw new Error("Server Misconfiguration: Missing API_KEY in Edge Function secrets.");
    }

    const ai = new GoogleGenAI({ apiKey });
    const { action, ...payload } = await req.json();

    // --- RUTAS DE LA API ---

    // A. Generar Texto (Copywriting)
    if (action === 'generate_copy') {
        const { productData, platform, settings, angle } = payload;
        
        const prompt = `
          ROLE: Social Media Copywriter for ${settings.industry}.
          TASK: Write a caption for "${productData.name}".
          CONTEXT: Platform: ${platform}. Angle: ${angle}. Tone: ${settings.tone}.
          DETAILS: Benefit: ${productData.benefit}.
          REQUIREMENTS: Spanish. AIDA framework. 3-5 hashtags. Emojis.
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
            // Fallback si falla el JSON
            return new Response(JSON.stringify({ copy: `${productData.name} - ${productData.benefit}`, hashtags: ["#sellfy"] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
    }

    // B. Regenerar Texto
    if (action === 'regenerate_copy') {
        const { productName, platform, tone } = payload;
        const prompt = `Rewrite caption for "${productName}". Platform: ${platform}. Tone: ${tone}. Spanish. Short.`;
        
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
        });
        
        return new Response(JSON.stringify({ text: response.text }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    // C. Generar Imagen Visual - FIDELIDAD MÁXIMA (Gemini 2.5 Flash Image)
    if (action === 'generate_visual') {
        const { angle, state, settings } = payload;
        const { productData, visualStyle } = state;

        const parts = [];
        let promptText = "";

        if (state.productData.baseImage) {
           // ESTRATEGIA DE EDICIÓN (Inpainting/Compositing)
           // Usamos 2.5 Flash Image porque respeta mejor la instrucción de "NO TOCAR EL PRODUCTO".
           promptText = `
             You are a professional product photographer editor.
             
             TASK: Change the background of the image.
             
             CRITICAL RULES:
             1. **KEEP THE PRODUCT EXACTLY AS IS**. Do not redraw it, do not distort it.
             2. Use the provided image as the absolute source of truth for the product.
             
             BACKGROUND INSTRUCTIONS:
             - Style: ${visualStyle}.
             - Colors: Use ${settings.primaryColor} and ${settings.secondaryColor} for lighting and background elements.
             - Mood: ${productData.benefit}.
             - Angle: ${angle} (Apply this to the background perspective only).
           `;
        } else {
           // GENERACIÓN DESDE CERO
           promptText = `
             Create a professional product photo for "${productData.name}".
             
             BRAND COLORS:
             - Main: ${settings.primaryColor}
             - Accent: ${settings.secondaryColor}
             
             DETAILS:
             - Style: ${visualStyle}
             - Angle: ${angle}
             - Context: ${productData.benefit}
             
             High quality, 4k.
           `;
        }

        parts.push({ text: promptText });

        if (state.productData.baseImage) {
            const matches = state.productData.baseImage.match(/^data:([^;]+);base64,(.+)$/);
            if (matches) {
                parts.push({
                    inlineData: {
                        mimeType: matches[1],
                        data: matches[2]
                    }
                });
            }
        }

        try {
            // CAMBIO: Usamos gemini-2.5-flash-image para mejor fidelidad en edición
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image', 
                contents: { parts: parts },
                // Nota: gemini-2.5-flash-image NO soporta aspect ratio configurable dinámicamente en todas las versiones,
                // pero lo intentamos pasar por si acaso, o dejamos default.
                config: {
                    // responseMimeType: "image/jpeg" // No soportado en nano banana
                }
            });

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
            throw new Error("No image generated.");
        } catch (e) {
            console.error("Image gen failed:", e);
            return new Response(JSON.stringify({ 
                url: `https://placehold.co/1080x1080/1e293b/ffffff?text=Error+Generando+Imagen`, 
                isVideo: false,
                error: e.message
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
    }

    // D. Animar Imagen (Video - Veo)
    if (action === 'animate_image') {
        const { image } = payload; 
        const matches = image.match(/^data:([^;]+);base64,(.+)$/);
        
        if (!matches) throw new Error("Invalid image format");

        try {
            const operation = await ai.models.generateVideos({
                model: 'veo-3.1-fast-generate-preview',
                prompt: "Cinematic slow motion, commercial product lighting, 4k resolution.",
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

            return new Response(JSON.stringify({ operationName: operation.name }), {
                 headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        } catch (e) {
            console.error("Video creation failed:", e);
            throw new Error(`Video init failed: ${e.message}`);
        }
    }

    // E. Consultar Estado del Video (Polling)
    if (action === 'get_video_operation') {
        const { operationName } = payload;
        
        if (!operationName) {
             return new Response(JSON.stringify({ done: false, error: "Missing operationName" }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        try {
            // Usamos getVideosOperation específicamente para Veo
            const operation = await ai.operations.getVideosOperation({ name: operationName });
            
            let videoUri = null;
            
            if (operation.done) {
                 // Estructura segura con optional chaining
                 const rawUri = operation.response?.generatedVideos?.[0]?.video?.uri;
                 
                 if (rawUri) {
                     // Adjuntar API Key es vital
                     videoUri = `${rawUri}&key=${apiKey}`;
                 }
            }

            return new Response(JSON.stringify({ done: operation.done, videoUri }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });

        } catch (e) {
            console.error("Polling crash avoided:", e);
            
            // BLINDAJE ANTI-500:
            // Si algo falla aquí, devolvemos 200 OK con un JSON que dice "done: false"
            // Esto permite que el polling continúe o falle suavemente en el cliente, 
            // en lugar de romper la Edge Function.
            return new Response(JSON.stringify({ 
                done: false, 
                // No enviamos 'error' para que el polling intente de nuevo si es un timeout temporal
                debugError: e.message 
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
    }

    throw new Error(`Unknown action: ${action}`);

  } catch (error: any) {
    // Catch-all global
    // Siempre devuelve 200 OK con el error en el cuerpo para evitar que el cliente reciba 500 HTML genérico
    return new Response(JSON.stringify({ error: error.message }), {
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
