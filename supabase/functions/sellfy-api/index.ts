
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
        if (rawBody.length > 8 * 1024 * 1024) throw new Error("Payload muy grande");
        payload = JSON.parse(rawBody);
    } catch (e) {
        throw new Error("JSON Inválido: " + e.message);
    }
    
    const { action, ...data } = payload;

    // --- 1. GENERAR IMAGEN (NANO BANANA - EDICIÓN PURA) ---
    if (action === 'generate_visual') {
        const { state, settings, angle } = data;
        const { productData, visualStyle, contentType } = state;

        console.log("🎨 Nano Banana: Edición Estricta");

        if (!productData.baseImage) throw new Error("Se requiere imagen base.");

        const parts = productData.baseImage.split(',');
        const mimeType = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
        const imageBase64 = parts[1];

        // Definir Intención de Marketing según ContentType
        let marketingIntentInstructions = "";
        switch (contentType) {
            case 'Lanzamiento':
                marketingIntentInstructions = "INTENT: PRODUCT LAUNCH. Make the lighting dramatic and exciting (like a reveal). Add subtle particle effects or light beams to make it feel new and important.";
                break;
            case 'Promoción / Descuento':
                marketingIntentInstructions = "INTENT: SALE PROMO. Ensure there is some negative space or clean areas in the background where text could be added later. The vibe should be urgent but attractive.";
                break;
            case 'Testimonio':
                marketingIntentInstructions = "INTENT: TRUST & REVIEW. Use very soft, trustworthy lighting. Warm tones. Make it feel authentic and established.";
                break;
            case 'Foto Lifestyle':
                marketingIntentInstructions = "INTENT: LIFESTYLE USAGE. The background should feel lived-in and real (depth of field), not just a sterile studio. Focus on context.";
                break;
            default:
                marketingIntentInstructions = "INTENT: HIGH END PRODUCT SHOT. Focus on clarity, sharpness and perfect studio lighting.";
        }

        // Construcción del Prompt
        let promptText = `
          ROLE: Precision Photo Editor (Inpainting/Compositing).
          
          INPUT IMAGE: Contains the MAIN PRODUCT.
          CRITICAL RULE: DO NOT redraw, distort, or change the product object itself. PRESERVE PIXELS of the object.
          
          ACTION:
          1. Segment the main product.
          2. Replace the background completely.
          3. New Background Description: ${productData.userPrompt}
          4. Style: ${visualStyle}.
          5. Marketing Context: ${marketingIntentInstructions}
          6. Variation: ${angle} (Subtle change in lighting/perspective of background only).
          7. Lighting: Professional studio lighting compatible with '${settings.primaryColor}' accents.
        `;

        if (productData.promoOption) {
           promptText += `
             8. MARKETING ADD-ON: Integrate a stylish, high-quality 3D text badge or sticker into the composition (next to the product) that says EXACTLY: "${productData.promoOption}". Make it look like a professional advertisement element, not a flat overlay.
           `;
        } else {
            promptText += `
             8. No text overlays. Clean image.
            `;
        }
          
        promptText += `\nOUTPUT: High-quality photorealistic image. Product perfectly integrated into new background.`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image', // Nano Banana
            contents: { parts: [
                { inlineData: { mimeType, data: imageBase64 } },
                { text: promptText }
            ] },
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
        throw new Error("Falló la generación de imagen.");
    }

    // --- 2. GENERAR COPY ESTRATÉGICO ---
    if (action === 'generate_strategic_copy') {
        const { imageBase64, userContext, framework, tone, platform } = data;
        const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;

        const prompt = `
          Actúa como un Copywriter de clase mundial especializado en Conversión.
          
          TAREA: Analiza la imagen del producto adjunta y escribe un texto de venta para ${platform}.
          
          INFORMACIÓN DE CONTEXTO DADA POR EL USUARIO: "${userContext}"
          
          ESTRUCTURA OBLIGATORIA: ${framework}
          TONO: ${tone}
          IDIOMA: Español (Neutro/Latinoamérica)
          
          Salida: Solo el texto del copy, listo para pegar. Usa emojis con moderación. Incluye 5 hashtags al final.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: { parts: [
                { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } },
                { text: prompt }
            ] },
        });

        return new Response(JSON.stringify({ text: response.text }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // --- 3. ANIMAR IMAGEN (VEO) ---
    if (action === 'animate_image') {
        const { image } = data;
        const parts = image.split(',');
        const mimeType = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
        const imageBytes = parts[1];

        const operation = await ai.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            image: { imageBytes, mimeType },
            prompt: "Cinematic product reveal, slow motion, professional lighting.",
            config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '9:16' }
        });

        return new Response(JSON.stringify({ operationName: operation.name }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    // --- 4. POLLING VIDEO ---
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
    return new Response(JSON.stringify({ error: error.message }), {
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
