
// @ts-nocheck
import { GoogleGenAI, Type } from "https://esm.sh/@google/genai";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('API_KEY');
    if (!apiKey) throw new Error("Falta API Key");
    const ai = new GoogleGenAI({ apiKey });
    
    let payload;
    try {
        const rawBody = await req.text();
        if (rawBody.length > 20 * 1024 * 1024) throw new Error("Payload muy grande (Max 20MB)");
        payload = JSON.parse(rawBody);
    } catch (e) {
        throw new Error("JSON Inválido o Body muy grande: " + e.message);
    }
    
    const { action, ...data } = payload;

    // --- 1. ANALIZAR IMAGEN ---
    if (action === 'analyze_image') {
        const { imageBase64 } = data;
        let cleanBase64 = imageBase64;
        let mimeType = 'image/jpeg';
        if (imageBase64.includes(',')) {
            const parts = imageBase64.split(',');
            mimeType = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
            cleanBase64 = parts[1];
        }

        const prompt = "Describe main product, material and color. Concise.";
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ inlineData: { mimeType, data: cleanBase64 } }, { text: prompt }] }
        });

        return new Response(JSON.stringify({ analysis: response.text || "Producto detectado." }), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
    }

    // --- 2. GENERAR IMAGEN ---
    if (action === 'generate_visual') {
        const { state, angle } = data;
        const { productData, visualStyle } = state;

        if (!productData.baseImage) throw new Error("Se requiere imagen base.");

        const parts = productData.baseImage.split(',');
        const mimeType = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
        const imageBase64 = parts[1];

        // Prompt Simplificado para evitar bloqueos
        const promptText = `
          Generate a product photography image.
          Subject: ${productData.aiAnalysis || 'A product'}
          Setting: ${productData.userPrompt}
          Style: ${visualStyle}, ${angle}
          
          Important: The product must be the main focus. High quality, photorealistic.
        `;

        // Intentamos generar con gemini-2.5-flash-image
        // NOTA: Para imagen-a-imagen simple sin máscara, pasamos la imagen como referencia
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: { parts: [
                    { inlineData: { mimeType, data: imageBase64 } },
                    { text: promptText }
                ] },
                config: {
                    temperature: 0.3
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
                return new Response(JSON.stringify({ 
                    url: `data:image/png;base64,${b64}`,
                    isVideo: false,
                    debugPrompt: promptText 
                }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }
        } catch (genError) {
            console.error("Gemini Image Gen failed:", genError);
            // Fallthrough to error return
        }
        
        // Si llegamos aquí, falló la generación. Retornamos JSON de error controlado.
        // NO lanzamos throw para que el cliente pueda manejarlo y mostrar placeholder.
        return new Response(JSON.stringify({ 
            error: "La IA no pudo generar la imagen. Posiblemente por filtros de seguridad o complejidad."
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // --- 3. GENERAR COPY ---
    if (action === 'generate_strategic_copy') {
        const { imageBase64, userContext, framework, tone, platform } = data;
        let cleanBase64 = imageBase64;
        let mimeType = 'image/jpeg';
        if (imageBase64.includes(',')) {
            const parts = imageBase64.split(',');
            mimeType = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
            cleanBase64 = parts[1];
        }

        const prompt = `Write a short ${platform} post about ${userContext}. Tone: ${tone}. Use ${framework}. Language: Spanish.`;
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash', 
            contents: { parts: [{ inlineData: { mimeType, data: cleanBase64 } }, { text: prompt }] },
        });

        return new Response(JSON.stringify({ text: response.text }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // --- 4. ANIMAR IMAGEN ---
    if (action === 'animate_image') {
        const { image } = data;
        const parts = image.split(',');
        const mimeType = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
        const imageBytes = parts[1];

        const operation = await ai.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            image: { imageBytes, mimeType },
            prompt: "Cinematic product showcase, slow camera pan, professional lighting, 4k advertising.",
            config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '9:16' }
        });

        return new Response(JSON.stringify({ operationName: operation.name }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    // --- 5. POLLING VIDEO ---
    if (action === 'get_video_operation') {
        const { operationName } = data;
        const operation = await ai.operations.getVideosOperation({ operation: { name: operationName } });
        let videoUri = null;
        let done = false;
        if (operation.done) {
            done = true;
            const vid = operation.response?.generatedVideos?.[0] || operation.result?.generatedVideos?.[0];
            if (vid?.video?.uri) videoUri = `${vid.video.uri}&key=${apiKey}`;
        }
        return new Response(JSON.stringify({ done, videoUri }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: "Acción desconocida" }), { headers: corsHeaders });

  } catch (error) {
    console.error("Server Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 200, // Return 200 so client can parse JSON error
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
