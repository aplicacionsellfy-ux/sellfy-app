
// @ts-nocheck
import { GoogleGenAI } from "https://esm.sh/@google/genai";

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
        if (rawBody.length > 10 * 1024 * 1024) throw new Error("Payload muy grande (Max 10MB)");
        payload = JSON.parse(rawBody);
    } catch (e) {
        throw new Error("JSON Inválido: " + e.message);
    }
    
    const { action, ...data } = payload;

    // --- 1. GENERAR IMAGEN (NANO BANANA - PRESERVACIÓN ESTRICTA) ---
    if (action === 'generate_visual') {
        const { state, settings, angle } = data;
        const { productData, visualStyle } = state;

        if (!productData.baseImage) throw new Error("Se requiere imagen base.");

        const parts = productData.baseImage.split(',');
        const mimeType = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
        const imageBase64 = parts[1];

        // Prompt de Ingeniería Inversa para evitar "alucinación"
        // Le decimos al modelo que NO dibuje el producto, sino que lo "recorte y pegue".
        const promptText = `
          TASK: Product Photography Compositing.
          
          INPUT: The attached image contains the REFERENCE PRODUCT.
          STRICT CONSTRAINT: PRESERVE THE PRODUCT OBJECT EXACTLY AS IS. DO NOT REDRAW IT. DO NOT HALLUCINATE NEW DETAILS.
          
          INSTRUCTIONS:
          1. Keep the main product from the input image unchanged.
          2. Generate a NEW BACKGROUND behind the product based on this description: "${productData.userPrompt}".
          3. Style: ${visualStyle}.
          4. Lighting: Match the product's lighting to the new background (Professional Studio Lighting).
          5. Composition: ${angle}.
          6. Marketing Vibe: High-end commercial photography, sharp focus on the product.
          
          ${productData.promoOption ? `7. ADDITION: Place a realistic 3D badge/tag next to the product that says "${productData.promoOption}".` : ""}
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image', // Nano Banana optimizado para tareas multimodales rápidas
            contents: { parts: [
                { inlineData: { mimeType, data: imageBase64 } },
                { text: promptText }
            ] },
            config: {
                temperature: 0.4 // Temperatura baja para ser más fiel a la imagen input
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
        throw new Error("La IA no devolvió una imagen válida.");
    }

    // --- 2. GENERAR COPY ESTRATÉGICO ---
    if (action === 'generate_strategic_copy') {
        const { imageBase64, userContext, framework, tone, platform } = data;
        
        // Limpieza robusta del base64
        let cleanBase64 = imageBase64;
        let mimeType = 'image/jpeg';
        
        if (imageBase64.includes(',')) {
            const parts = imageBase64.split(',');
            mimeType = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
            cleanBase64 = parts[1];
        }

        const prompt = `
          Eres un experto Copywriter de Respuesta Directa.
          
          TAREA: Escribe un post para ${platform} analizando la IMAGEN PROPORCIONADA.
          
          DETALLES:
          - Producto/Oferta: ${userContext}
          - Framework Psicológico: ${framework} (Sigue esta estructura estrictamente)
          - Tono de Voz: ${tone}
          
          FORMATO DE SALIDA:
          - No incluyas introducciones como "Aquí tienes el copy".
          - Usa párrafos cortos y espaciados.
          - Incluye emojis relevantes pero no excesivos.
          - Termina con 5-7 hashtags estratégicos.
          - Idioma: Español Neutro.
        `;

        // Usamos gemini-2.5-flash-image porque acepta imagenes de input y es rápido
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview', 
            contents: { parts: [
                { inlineData: { mimeType: mimeType, data: cleanBase64 } },
                { text: prompt }
            ] },
        });

        const text = response.text || "No se pudo generar el texto.";

        return new Response(JSON.stringify({ text: text }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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
            prompt: "Cinematic camera movement, subtle product motion, high quality, 4k, advertising style.",
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
    console.error("Server Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 200, // Retornamos 200 para que el cliente maneje el error JSON
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
