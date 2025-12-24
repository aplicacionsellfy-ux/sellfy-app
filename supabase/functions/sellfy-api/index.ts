
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

    // A. Generar Texto (Copywriting) - Gemini 3 Flash
    if (action === 'generate_copy') {
        const { productData, platform, settings, angle } = payload;
        
        const prompt = `
          ROLE: Expert Social Media Copywriter for ${settings.industry}.
          TASK: Write a high-converting caption for product "${productData.name}".
          CONTEXT: Platform: ${platform}. Angle: ${angle}. Tone: ${settings.tone}.
          DETAILS: Benefit: ${productData.benefit}. Offer: ${productData.promoDetails || 'None'}.
          
          REQUIREMENTS:
          1. Use the AIDA framework.
          2. Language: Spanish (Español).
          3. Include 3-5 relevant hashtags.
          4. Use emojis.
          5. Return JSON format.
        `;

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
        
        return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    // B. Regenerar Texto - Gemini 3 Flash
    if (action === 'regenerate_copy') {
        const { productName, platform, tone } = payload;
        const prompt = `Rewrite a caption for product "${productName}" for ${platform}. Tone: ${tone}. Language: Spanish. Keep it short and punchy. Return raw text only.`;
        
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
        });
        
        return new Response(JSON.stringify({ text: response.text }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    // C. Generar Imagen Visual - Gemini 3 Pro (Fidelidad Estricta)
    if (action === 'generate_visual') {
        const { angle, state, settings } = payload;
        const { productData, visualStyle } = state;

        const parts = [];

        // Prompt optimizado para evitar "alucinaciones" (inventar otro producto)
        // Usamos palabras clave como "Composite", "Insert", "Keep unchanged"
        let promptText = `
          TASK: You are a professional product photographer.
          ACTION: Insert the PRODUCT shown in the reference image into a new background.
          
          STRICT CONSTRAINTS (CRITICAL):
          1. **IDENTITY LOCK**: The object in the input image is the "Hero". You MUST preserve its exact shape, logo, text, label, and colors. Do NOT redraw the bottle/package. Do NOT invent a new design.
          2. **SCENE**: Create a realistic, high-quality background environment: ${visualStyle}.
          3. **COMPOSITION**: ${angle}.
          4. **LIGHTING**: Cinematic studio lighting that matches the product's perspective.
          5. **BRANDING**: Subtle hints of ${settings.primaryColor} in the environment (light or props), NOT on the product itself.
          
          OUTPUT: 4k Photorealistic Image.
        `;
        
        if (!state.productData.baseImage) {
           promptText = `Create a high-quality product photography for a product named "${productData.name}". Style: ${visualStyle}. Angle: ${angle}. Brand colors: ${settings.primaryColor}.`;
        }

        // Importante: Enviar el texto primero, luego la imagen para contexto
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
            // Usamos Gemini 3 Pro Image Preview. Es el modelo más capaz para seguir instrucciones complejas.
            const response = await ai.models.generateContent({
                model: 'gemini-3-pro-image-preview', 
                contents: { parts: parts },
                config: {
                    imageConfig: {
                        aspectRatio: "1:1",
                    }
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
            throw new Error("No image generated in response parts");
        } catch (e) {
            console.error("Image gen failed:", e);
            return new Response(JSON.stringify({ 
                url: `https://placehold.co/1080x1080/1e293b/ffffff?text=${encodeURIComponent(productData.name)}+Error`, 
                isVideo: false,
                error: e.message
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
    }

    // D. Animar Imagen (Video - Veo 3.1)
    if (action === 'animate_image') {
        const { image } = payload; 
        const matches = image.match(/^data:([^;]+);base64,(.+)$/);
        
        if (!matches) throw new Error("Invalid image format");

        try {
            const operation = await ai.models.generateVideos({
                model: 'veo-3.1-fast-generate-preview',
                prompt: "Cinematic product motion, professional commercial lighting, slow motion 60fps, 4k resolution, highly detailed.",
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
        
        try {
            // CORRECCIÓN CRÍTICA:
            // Usamos 'ai.operations.getOperation' que es el método genérico y seguro.
            // 'getVideosOperation' a veces falla dependiendo de la versión del SDK o espera argumentos anidados complejos.
            const operation = await ai.operations.getOperation({ name: operationName });
            
            let videoUri = null;
            if (operation.done) {
                 // La respuesta viene anidada en 'response'
                 // @ts-ignore
                 const rawUri = operation.response?.generatedVideos?.[0]?.video?.uri;
                 
                 // Fallback: A veces viene en result
                 // @ts-ignore
                 const resultUri = operation.result?.generatedVideos?.[0]?.video?.uri;

                 const finalUri = rawUri || resultUri;

                 if (finalUri) {
                     // Adjuntar API Key para permitir la descarga segura
                     videoUri = `${finalUri}&key=${apiKey}`;
                 }
            }

            return new Response(JSON.stringify({ done: operation.done, videoUri }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        } catch (e) {
            console.error("Polling error details:", e);
            // Retornamos 200 con el error en JSON para que el frontend pueda manejarlo sin mostrar un error 500
            return new Response(JSON.stringify({ done: false, error: `Polling failed: ${e.message}` }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
    }

    throw new Error(`Unknown action: ${action}`);

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
