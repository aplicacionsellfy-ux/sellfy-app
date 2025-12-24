
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
    const apiKey = Deno.env.get('API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Server Error: API_KEY missing" }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const ai = new GoogleGenAI({ apiKey });
    const { action, ...payload } = await req.json();

    console.log(`[Sellfy API] Ejecutando acción: ${action}`);

    // --- A. Generar Texto (Copywriting) ---
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
            console.error("Error copy:", e);
            // Fallback seguro
            return new Response(JSON.stringify({ copy: `${productData.name} - ${productData.benefit}`, hashtags: ["#sellfy"] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
    }

    // --- B. Regenerar Texto ---
    if (action === 'regenerate_copy') {
        const { productName, platform, tone } = payload;
        const prompt = `Rewrite caption for "${productName}". Platform: ${platform}. Tone: ${tone}. Spanish. Short.`;
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
        });
        return new Response(JSON.stringify({ text: response.text }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // --- C. Generar Imagen Visual (Alta Fidelidad) ---
    if (action === 'generate_visual') {
        const { angle, state, settings } = payload;
        const { productData, visualStyle } = state;

        const parts = [];

        // 1. IMPORTANTE: La imagen va PRIMERO en el array de partes.
        // Esto le indica al modelo que la imagen es la fuente de verdad primaria.
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

        // 2. Prompt estricto de edición
        let promptText = "";
        if (state.productData.baseImage) {
           promptText = `
             You are a professional product photo editor.
             
             STRICT INSTRUCTION:
             - **DO NOT CHANGE THE PRODUCT**. Use the input image as the absolute reference.
             - Only change the background and lighting.
             
             SCENE:
             - Style: ${visualStyle}.
             - Brand Colors to use in background: ${settings.primaryColor} and ${settings.secondaryColor}.
             - Mood: ${productData.benefit}.
             - Angle: ${angle} (Camera angle relative to the product).
           `;
        } else {
           promptText = `
             Create a professional product photo for "${productData.name}".
             Style: ${visualStyle}.
             Colors: ${settings.primaryColor}, ${settings.secondaryColor}.
             Context: ${productData.benefit}.
             Angle: ${angle}.
             High quality, photorealistic, 4k.
           `;
        }
        parts.push({ text: promptText });

        try {
            // USAMOS GEMINI 2.5 FLASH IMAGE
            // Este modelo respeta mucho mejor la imagen de referencia que el Gemini 3 Pro.
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image', 
                contents: { parts: parts },
                config: {
                    // No usamos responseMimeType aquí porque nano banana no lo soporta bien
                }
            });

            // Buscar la parte de imagen en la respuesta (puede venir mezclada con texto)
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
            throw new Error("La IA no generó una imagen válida.");
        } catch (e) {
            console.error("Image gen failed:", e);
            return new Response(JSON.stringify({ 
                url: null, 
                error: `Image Error: ${e.message}`
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
    }

    // --- D. Animar Imagen (Video - Veo) ---
    if (action === 'animate_image') {
        const { image } = payload; 
        
        try {
            const matches = image.match(/^data:([^;]+);base64,(.+)$/);
            if (!matches) throw new Error("Formato de imagen inválido");

            const operation = await ai.models.generateVideos({
                model: 'veo-3.1-fast-generate-preview',
                prompt: "Cinematic product showcase, slow motion, professional lighting, 4k.",
                image: { 
                    imageBytes: matches[2], 
                    mimeType: matches[1] 
                },
                config: { 
                    numberOfVideos: 1,
                    resolution: '720p', // Veo Fast suele ser mejor en 720p
                    aspectRatio: '9:16'
                }
            });

            return new Response(JSON.stringify({ operationName: operation.name }), {
                 headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        } catch (e) {
            console.error("Video init failed:", e);
            return new Response(JSON.stringify({ error: `Video Init Error: ${e.message}` }), {
                 headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
    }

    // --- E. Consultar Estado Video (Polling) ---
    if (action === 'get_video_operation') {
        const { operationName } = payload;
        
        if (!operationName) {
             return new Response(JSON.stringify({ done: false, error: "Missing operationName" }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        try {
            // CORRECCIÓN CLAVE: Usamos getVideosOperation pasando el objeto operation reconstruido
            // Esto evita el error 500 si getOperation genérico falla.
            const operation = await ai.operations.getVideosOperation({ 
                operation: { name: operationName } 
            });
            
            let videoUri = null;
            
            if (operation.done) {
                 // Estructura de respuesta de Veo
                 const generatedVideo = operation.response?.generatedVideos?.[0] || operation.result?.generatedVideos?.[0];
                 const rawUri = generatedVideo?.video?.uri;
                 
                 if (rawUri) {
                     // Adjuntar API Key es vital
                     videoUri = `${rawUri}&key=${apiKey}`;
                 }
            }

            return new Response(JSON.stringify({ done: operation.done, videoUri }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });

        } catch (e) {
            console.error("Polling error:", e);
            // Devolvemos 200 OK con done: false para que el cliente no crashee y siga intentando
            return new Response(JSON.stringify({ 
                done: false, 
                debugError: e.message 
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
    }

    // Acción desconocida
    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error: any) {
    // CATCH-ALL GLOBAL: Esto previene que la Edge Function devuelva 500 HTML
    console.error("Global Error Handler:", error.message);
    return new Response(JSON.stringify({ error: `System Error: ${error.message}` }), {
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
