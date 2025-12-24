
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

    // C. Generar Imagen Visual - Gemini 2.5 Flash Image (Nano Banana)
    if (action === 'generate_visual') {
        const { angle, state, settings, plan } = payload;
        const { productData, visualStyle } = state;

        let promptText = `Professional product photography of ${productData.name}. 
        Style: ${visualStyle}. Composition: ${angle}. 
        Key Feature: ${productData.benefit}.
        Brand Colors: ${settings.primaryColor}.
        Lighting: Studio lighting, high quality, 4k.`;

        try {
            // Usamos Gemini 2.5 Flash Image para generación rápida y alta calidad
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: {
                    parts: [{ text: promptText }],
                },
                config: {
                    imageConfig: {
                        aspectRatio: "1:1",
                    }
                }
            });

            // Iterar para encontrar la parte de la imagen
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
                url: `https://placehold.co/1080x1080/1e293b/ffffff?text=${encodeURIComponent(productData.name)}`, 
                isVideo: false 
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

        const operation = await ai.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            prompt: "Cinematic slow motion product reveal, professional lighting.",
            image: { 
                imageBytes: matches[2], 
                mimeType: matches[1] 
            },
            config: { 
                numberOfVideos: 1,
                resolution: '720p',
                aspectRatio: '9:16' // Optimizado para Reels/TikTok
            }
        });

        return new Response(JSON.stringify({ operationName: operation.name }), {
             headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    // E. Consultar Estado del Video (Polling)
    if (action === 'get_video_operation') {
        const { operationName } = payload;
        
        // @ts-ignore
        const operation = await ai.operations.getVideosOperation({ operation: { name: operationName } });
        
        let videoUri = null;
        if (operation.done) {
             // @ts-ignore
             const rawUri = operation.response?.generatedVideos?.[0]?.video?.uri;
             if (rawUri) {
                 videoUri = `${rawUri}&key=${apiKey}`;
             }
        }

        return new Response(JSON.stringify({ done: operation.done, videoUri }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    throw new Error(`Unknown action: ${action}`);

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
