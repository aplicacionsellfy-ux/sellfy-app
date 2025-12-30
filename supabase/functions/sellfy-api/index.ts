
// @ts-nocheck
import { GoogleGenAI } from "https://esm.sh/@google/genai";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('API_KEY');
    if (!apiKey) {
      console.error("Missing API_KEY");
      throw new Error("Falta API Key del servidor");
    }
    
    const ai = new GoogleGenAI({ apiKey });
    
    // Parse Payload safely
    let payload;
    try {
        const rawBody = await req.text();
        if (!rawBody) throw new Error("Empty body");
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

        // Limpiar Base64
        let imageBase64 = productData.baseImage;
        let mimeType = 'image/jpeg';
        if (imageBase64.includes(',')) {
            const parts = imageBase64.split(',');
            mimeType = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
            imageBase64 = parts[1];
        }

        const context = productData.userPrompt || "Professional studio photography";
        const prompt = `
            Task: Product Photography Editing.
            Input: Reference image of a product.
            Output: High-end commercial photograph of this product in a new environment.
            
            Product Context: ${productData.name || 'The product in the image'}.
            New Environment: ${context}, ${visualStyle} aesthetic.
            Angle: ${angle}.
            Lighting: Cinematic, high quality.
            
            Constraint: Keep the product looking exactly like the reference, but seamlessly integrated into the new background.
        `;

        try {
            // Using 'gemini-2.5-flash-image' for image editing/generation
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: {
                    parts: [
                        { text: prompt },
                        { inlineData: { mimeType, data: imageBase64 } }
                    ]
                },
                config: {
                    temperature: 0.3,
                    // No responseMimeType for image generation
                }
            });

            // Extract Image
            let generatedImageBase64 = null;
            const candidates = response.candidates;
            
            if (candidates && candidates.length > 0) {
                const parts = candidates[0].content.parts;
                for (const part of parts) {
                    if (part.inlineData && part.inlineData.data) {
                        generatedImageBase64 = part.inlineData.data;
                        break;
                    }
                }
            }

            if (!generatedImageBase64) {
                 const textResponse = candidates?.[0]?.content?.parts?.[0]?.text || "No content";
                 console.warn("Gemini Text Response (No Image):", textResponse);
                 // If the model refuses to generate image, we throw to trigger fallback
                 throw new Error("IA devolvió texto en lugar de imagen: " + textResponse.substring(0, 100));
            }

            return new Response(JSON.stringify({ 
                url: `data:image/png;base64,${generatedImageBase64}`,
                isVideo: false
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

        } catch (genError) {
            console.error("Gemini Visual Gen Error:", genError);
            throw new Error("Fallo en generación visual: " + genError.message);
        }
    }

    // -----------------------------------------------------------
    // 2. ANALIZAR IMAGEN (VISION)
    // -----------------------------------------------------------
    if (action === 'analyze_image') {
        const { imageBase64 } = data;
        let cleanBase64 = imageBase64;
        if (imageBase64.includes(',')) cleanBase64 = imageBase64.split(',')[1];
        
        // Use 'gemini-3-flash-preview' for analysis (Multimodal)
        // Avoid 'gemini-2.5-flash' which might be invalid
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview', 
            contents: { 
                parts: [
                    { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } }, 
                    { text: "Analyze this product. 1 sentence description of material, color and type." } 
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
    // Unificamos las llamadas de texto aquí
    if (action === 'generate_strategic_copy') {
        const { userContext, framework, tone, platform } = data;
        const prompt = `Write a ${platform} caption for ${userContext} using ${framework} framework. Tone: ${tone}. Language: Spanish. Include 5 hashtags.`;
        
        // Use 'gemini-3-flash-preview' for text generation
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
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
        let cleanBase64 = image;
        if (image.includes(',')) cleanBase64 = image.split(',')[1];
        
        const operation = await ai.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            image: { imageBytes: cleanBase64, mimeType: 'image/png' },
            prompt: "Cinematic slow motion product reveal, professional lighting",
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

    return new Response(JSON.stringify({ error: "Acción no reconocida: " + action }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    console.error("Global API Error:", error);
    // Always return 200 with error field so client doesn't get generic 500
    return new Response(JSON.stringify({ error: error.message || "Error interno del servidor" }), {
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
