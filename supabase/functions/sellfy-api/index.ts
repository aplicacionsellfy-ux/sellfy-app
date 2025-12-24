
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

    // C. Generar Imagen Visual - Gemini 3 Pro Image (Mayor fidelidad)
    if (action === 'generate_visual') {
        const { angle, state, settings } = payload;
        const { productData, visualStyle } = state;

        const parts = [];

        // Prompt reforzado para fidelidad
        let promptText = `
          TASK: Create a professional product photograph compositing the PRODUCT provided in the image into a new background.
          
          STRICT VISUAL RULES:
          1. **DO NOT ALTER THE PRODUCT**: The object in the input image MUST remain exactly the same (same logo, label, shape, color). Do not hallucinate a new bottle or packaging.
          2. **BACKGROUND**: Place the product in a ${visualStyle} environment.
          3. **COMPOSITION**: ${angle}.
          4. **BRANDING**: Subtly integrate the brand color ${settings.primaryColor} into the lighting or props.
          
          OUTPUT: High resolution, photorealistic, 4k.
        `;
        
        if (!state.productData.baseImage) {
           promptText += `\n(NOTE: No reference image provided. Create a generic product matching name: ${productData.name})`;
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
            // Usamos Gemini 3 Pro Image Preview para mejor obediencia al prompt de "no cambiar el producto"
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
                prompt: "Cinematic product motion, professional commercial lighting, slow motion 60fps.",
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
            // CORRECCIÓN: La SDK espera la propiedad 'operation' con un objeto que tenga 'name'.
            // Esto corrige el error 500 "invalid argument" o crash interno.
            const operation = await ai.operations.getVideosOperation({ 
                operation: { name: operationName } 
            });
            
            let videoUri = null;
            if (operation.done) {
                 // @ts-ignore
                 const rawUri = operation.response?.generatedVideos?.[0]?.video?.uri;
                 if (rawUri) {
                     // Adjuntar API Key para descargar
                     videoUri = `${rawUri}&key=${apiKey}`;
                 }
            }

            return new Response(JSON.stringify({ done: operation.done, videoUri }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        } catch (e) {
            console.error("Polling error details:", e);
            // Retornamos 200 con el error en JSON para que el frontend pueda manejarlo sin explotar
            return new Response(JSON.stringify({ done: false, error: e.message }), {
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
