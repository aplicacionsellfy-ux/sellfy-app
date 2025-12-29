
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
        // Aumentamos límite de seguridad mentalmente, aunque Deno tiene sus propios límites
        if (rawBody.length > 15 * 1024 * 1024) throw new Error("Payload muy grande (Max 15MB)");
        payload = JSON.parse(rawBody);
    } catch (e) {
        throw new Error("JSON Inválido o Body muy grande: " + e.message);
    }
    
    const { action, ...data } = payload;

    // --- 1. ANALIZAR IMAGEN (NUEVO: Real AI Vision) ---
    if (action === 'analyze_image') {
        const { imageBase64 } = data;
        
        let cleanBase64 = imageBase64;
        let mimeType = 'image/jpeg';
        
        if (imageBase64.includes(',')) {
            const parts = imageBase64.split(',');
            mimeType = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
            cleanBase64 = parts[1];
        }

        const prompt = `
            Describe this product image concisely for a professional photographer.
            Identify:
            1. The main object (what is it?).
            2. Material and color.
            3. Camera angle/perspective.
            
            Return the response in plain text, concise. Example: "A red leather sneaker, side view, white rubber sole."
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash', // Multimodal model for analysis
            contents: { parts: [
                { inlineData: { mimeType: mimeType, data: cleanBase64 } },
                { text: prompt }
            ] }
        });

        const analysis = response.text || "Producto no identificado claramente.";

        return new Response(JSON.stringify({ analysis }), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
    }

    // --- 2. GENERAR IMAGEN (Edición Estricta con Contexto) ---
    if (action === 'generate_visual') {
        const { state, angle } = data;
        const { productData, visualStyle } = state;

        if (!productData.baseImage) throw new Error("Se requiere imagen base.");

        const parts = productData.baseImage.split(',');
        const mimeType = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
        const imageBase64 = parts[1];

        // Construimos el prompt usando el ANÁLISIS PREVIO si existe
        const context = productData.aiAnalysis 
            ? `The product is: ${productData.aiAnalysis}.` 
            : "The product is the main object in the foreground.";

        const promptText = `
          Photo Editing Task.
          
          ${context}
          
          Instruction: CHANGE THE BACKGROUND.
          1. KEEP THE PRODUCT (${productData.aiAnalysis || 'Foreground object'}) EXACTLY AS IS. Do not warp it.
          2. Place it in this setting: "${productData.userPrompt}".
          3. Style: ${visualStyle}.
          4. Composition: ${angle}.
          5. Blend the product naturally with realistic lighting and shadows cast on the new background.
          
          ${productData.promoOption ? `6. (Optional) If it fits naturally, include a minimal text element saying: "${productData.promoOption}"` : ""}
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image', // Modelo especializado en edición/generación de imagen
            contents: { parts: [
                { inlineData: { mimeType, data: imageBase64 } },
                { text: promptText }
            ] },
            config: {
                temperature: 0.4, 
                topK: 32
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
        
        throw new Error("La IA no generó imagen. Intenta otra vez.");
    }

    // --- 3. GENERAR COPY ESTRATÉGICO ---
    if (action === 'generate_strategic_copy') {
        const { imageBase64, userContext, framework, tone, platform } = data;
        
        let cleanBase64 = imageBase64;
        let mimeType = 'image/jpeg';
        if (imageBase64.includes(',')) {
            const parts = imageBase64.split(',');
            mimeType = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
            cleanBase64 = parts[1];
        }

        const prompt = `
          Actúa como un Copywriter Senior experto en ${platform}.
          TAREA: Escribe un texto persuasivo para vender el producto que ves en la imagen.
          CONTEXTO DEL PRODUCTO: ${userContext}
          FRAMEWORK DE VENTAS: ${framework}
          TONO DE VOZ: ${tone}
          
          REGLAS: Español Neutro. Emojis estratégicos. Formato legible. Añade hashtags.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash', 
            contents: { parts: [
                { inlineData: { mimeType: mimeType, data: cleanBase64 } },
                { text: prompt }
            ] },
        });

        return new Response(JSON.stringify({ text: response.text }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // --- 4. ANIMAR IMAGEN (VEO) ---
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
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
