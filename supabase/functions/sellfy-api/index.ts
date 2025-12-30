
// @ts-nocheck
import { GoogleGenAI } from "https://esm.sh/@google/genai";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('API_KEY');
    if (!apiKey) throw new Error("Falta API Key del servidor");
    
    const ai = new GoogleGenAI({ apiKey });
    
    // Parse Payload
    let payload;
    try {
        const rawBody = await req.text();
        payload = JSON.parse(rawBody);
    } catch (e) {
        throw new Error("Error parseando body JSON: " + e.message);
    }
    
    const { action, ...data } = payload;

    // -----------------------------------------------------------
    // 1. GENERAR IMAGEN (IMAGE-TO-IMAGE REAL)
    // -----------------------------------------------------------
    if (action === 'generate_visual') {
        const { state, angle } = data;
        const { productData, visualStyle } = state;

        if (!productData.baseImage) throw new Error("Falta la imagen base del producto.");

        // Limpiar Base64 (remover header data:image/...)
        let imageBase64 = productData.baseImage;
        let mimeType = 'image/jpeg';
        if (imageBase64.includes(',')) {
            const parts = imageBase64.split(',');
            mimeType = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
            imageBase64 = parts[1];
        }

        // Prompt Directo y Claro
        const context = productData.userPrompt || "Professional studio lighting";
        const prompt = `
            Generate a high-quality, photorealistic product image based on the input image provided.
            The product is: ${productData.name || 'the item in the image'}.
            
            Action: Place this exact product into a new environment.
            Environment: ${context}, ${visualStyle} style.
            Camera Angle: ${angle}.
            Lighting: Professional, cinematic, high contrast.
            
            Important: Maintain the visual identity of the product but upgrade the quality and background.
            Output: A single high-resolution image.
        `;

        try {
            // Llamada a Gemini 2.5 Flash Image (Multimodal In -> Multimodal Out)
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: {
                    parts: [
                        { text: prompt },
                        { inlineData: { mimeType, data: imageBase64 } } // Enviamos la foto original
                    ]
                },
                config: {
                    // Importante: No ponemos responseMimeType: 'application/json' porque queremos una imagen binaria en la respuesta
                    temperature: 0.3, // Baja temperatura para mantener fidelidad al producto
                }
            });

            // Extraer la imagen de la respuesta
            let generatedImageBase64 = null;
            
            // La respuesta puede traer texto Y/O imagen. Iteramos para encontrar la imagen.
            const candidates = response.candidates;
            if (candidates && candidates.length > 0) {
                const parts = candidates[0].content.parts;
                for (const part of parts) {
                    if (part.inlineData && part.inlineData.data) {
                        generatedImageBase64 = part.inlineData.data;
                        break; // Encontramos la imagen
                    }
                }
            }

            if (!generatedImageBase64) {
                 // Si Gemini devolvió solo texto (explicando por qué no pudo, o alucinando), lo loggeamos
                 const textResponse = candidates?.[0]?.content?.parts?.[0]?.text || "No content";
                 console.log("Gemini devolvió texto en vez de imagen:", textResponse);
                 throw new Error("La IA no generó imagen visual. Respuesta: " + textResponse.substring(0, 100));
            }

            return new Response(JSON.stringify({ 
                url: `data:image/png;base64,${generatedImageBase64}`,
                isVideo: false
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

        } catch (genError) {
            console.error("Error en Gemini Generation:", genError);
            throw new Error("Fallo en generación visual: " + genError.message);
        }
    }

    // -----------------------------------------------------------
    // 2. ANALIZAR IMAGEN (VISION)
    // -----------------------------------------------------------
    if (action === 'analyze_image') {
        const { imageBase64 } = data;
        let cleanBase64 = imageBase64.split(',')[1] || imageBase64;
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash', // Modelo solo texto para analisis
            contents: { 
                parts: [
                    { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } }, 
                    { text: "Analyze this product image. Return 1 sentence describing the product type, material, and color for a prompt." } 
                ] 
            }
        });
        
        return new Response(JSON.stringify({ analysis: response.text }), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
    }

    // -----------------------------------------------------------
    // 3. GENERAR TEXTO (COPY)
    // -----------------------------------------------------------
    if (action === 'generate_strategic_copy') {
        const { userContext, framework, tone, platform } = data;
        const prompt = `Write a ${platform} caption for ${userContext} using ${framework} framework. Tone: ${tone}. Language: Spanish. Include hashtags.`;
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: prompt }] }
        });

        return new Response(JSON.stringify({ text: response.text }), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
    }

    // -----------------------------------------------------------
    // 4. ANIMAR (VIDEO)
    // -----------------------------------------------------------
    if (action === 'animate_image') {
        const { image } = data;
        const cleanBase64 = image.split(',')[1] || image;
        
        const operation = await ai.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            image: { imageBytes: cleanBase64, mimeType: 'image/png' },
            prompt: "Cinematic product showcase, slow motion, 4k lighting",
            config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '9:16' }
        });

        return new Response(JSON.stringify({ operationName: operation.name }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    if (action === 'get_video_operation') {
        const { operationName } = data;
        const operation = await ai.operations.getVideosOperation({ operation: { name: operationName } });
        let videoUri = null;
        
        if (operation.done) {
             const vid = operation.response?.generatedVideos?.[0] || operation.result?.generatedVideos?.[0];
             if (vid?.video?.uri) videoUri = `${vid.video.uri}&key=${apiKey}`;
        }
        return new Response(JSON.stringify({ done: operation.done, videoUri }), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
    }

    throw new Error("Acción no reconocida");

  } catch (error) {
    console.error("API Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 200, // Devolvemos 200 con error JSON para que el frontend lo parsee
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
