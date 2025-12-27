
// @ts-nocheck
import { GoogleGenAI, Type } from "https://esm.sh/@google/genai";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  // Manejo de Preflight request (CORS)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log("🔥 [Sellfy API] Inicio de la función...");

    const apiKey = Deno.env.get('API_KEY');
    if (!apiKey) {
      console.error("❌ API_KEY no encontrada en variables de entorno");
      return new Response(JSON.stringify({ error: "Falta API Key en el servidor (Supabase Secrets)." }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const ai = new GoogleGenAI({ apiKey });
    
    let payload;
    try {
        const rawBody = await req.text();
        // Límite de seguridad
        if (rawBody.length > 6 * 1024 * 1024) {
             throw new Error("La imagen es demasiado grande (Límite 6MB).");
        }
        payload = JSON.parse(rawBody);
    } catch (e) {
        return new Response(JSON.stringify({ error: "Error de datos: " + e.message }), { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
    }
    
    const { action, plan = 'free', ...data } = payload;

    // --- A. GENERAR TEXTO (COPY) ---
    if (action === 'generate_copy') {
        const { productData, platform, settings, angle } = data;
        
        const prompt = `
          Eres un experto copywriter.
          Producto: "${productData.name}".
          Beneficio: "${productData.benefit}".
          Plataforma: ${platform}.
          Tono: ${settings.tone}.
          
          Tarea: Escribe un caption CORTO y persuasivo.
          Formato JSON:
          { "copy": "texto", "hashtags": ["#tag1", "#tag2"] }
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
            const result = JSON.parse(response.text);
            return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        } catch (e) {
            return new Response(JSON.stringify({ 
              copy: `${productData.name} - ${productData.benefit}`,
              hashtags: ["#fyp"]
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
    }

    // --- B. REGENERAR TEXTO ---
    if (action === 'regenerate_copy') {
        const { productName, platform, tone } = data;
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: `Reescribe un caption corto para "${productName}" en ${platform}. Tono: ${tone}.`,
            });
            return new Response(JSON.stringify({ text: response.text }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        } catch (e) {
            return new Response(JSON.stringify({ text: "Error regenerando texto." }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
    }

    // --- C. EDITAR IMAGEN (NANO BANANA / GEMINI FLASH IMAGE) ---
    if (action === 'generate_visual') {
        const { angle, state, settings } = data;
        const { productData, visualStyle } = state;

        console.log("🎨 Generando imagen con Nano Banana...");

        let imageData = null;
        let mimeType = 'image/png';

        if (productData.baseImage) {
            const parts = productData.baseImage.split(',');
            if (parts.length === 2) {
                const match = parts[0].match(/:(.*?);/);
                if (match) mimeType = match[1];
                imageData = parts[1];
            }
        }

        const parts = [];
        let promptText = "";

        if (imageData) {
            // PROMPT ESTRICTO PARA EDICIÓN DE FONDO (PRESERVANDO OBJETO)
            promptText = `
              TASK: Product Photography Post-Processing.
              
              INSTRUCTIONS:
              1. DETECT the main product object in the input image. 
              2. PRESERVE the product pixels exactly. Do NOT redraw, generate, or alter the product itself.
              3. REMOVE the existing background entirely.
              4. GENERATE a new professional background behind the product.
              
              BACKGROUND SPECS:
              - Style: ${visualStyle}.
              - Setting context (for background only): ${angle}.
              - Brand Colors for Lighting/Props: ${settings.primaryColor}.
              - Product Context (for mood only): "${productData.name} - ${productData.description}".
              
              OUTPUT: The EXACT original product cutout placed on the new background.
            `;
            
            parts.push({ inlineData: { mimeType, data: imageData } });
            parts.push({ text: promptText });
        } else {
            // Fallback si no hay imagen (Generación desde cero)
            promptText = `
              Create a professional product shot.
              Subject: ${productData.name}.
              Context: ${productData.benefit}.
              Style: ${visualStyle}.
              Setting: ${angle}.
              Lighting: Studio with ${settings.primaryColor} accents.
              High quality, commercial photography.
            `;
            parts.push({ text: promptText });
        }

        try {
            // Usamos gemini-2.5-flash-image (Nano Banana)
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: { parts: parts },
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
            throw new Error("No se generó imagen.");

        } catch (e) {
            console.error("Error Gen:", e);
            const fallbackUrl = productData.baseImage || `https://placehold.co/1080x1350/000?text=${encodeURIComponent(productData.name)}`;
            return new Response(JSON.stringify({ 
                url: fallbackUrl,
                isVideo: false,
                debugPrompt: "Error en generación: " + e.message
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
    }

    // --- D. ANIMAR IMAGEN (VEO) ---
    if (action === 'animate_image') {
        const { image } = data;
        try {
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
        } catch (e) {
            return new Response(JSON.stringify({ error: e.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
    }

    // --- E. POLLING VIDEO ---
    if (action === 'get_video_operation') {
        const { operationName } = data;
        try {
            const operation = await ai.operations.getVideosOperation({ operation: { name: operationName } });
            let videoUri = null;
            let done = false;
            if (operation.done) {
                done = true;
                const vid = operation.response?.generatedVideos?.[0] || operation.result?.generatedVideos?.[0];
                if (vid?.video?.uri) videoUri = `${vid.video.uri}&key=${apiKey}`;
            }
            return new Response(JSON.stringify({ done, videoUri }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        } catch (e) {
            return new Response(JSON.stringify({ done: false }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
    }

    return new Response(JSON.stringify({ error: "Acción desconocida" }), { headers: corsHeaders });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
