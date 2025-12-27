
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
        // Leemos el texto primero para evitar errores de parseo silenciosos
        const rawBody = await req.text();
        console.log(`📦 Payload Size: ${(rawBody.length / 1024 / 1024).toFixed(2)} MB`);
        
        if (rawBody.length > 5.5 * 1024 * 1024) {
             throw new Error("La imagen es demasiado grande para procesar (Límite 5MB). Intenta con una más pequeña.");
        }
        
        payload = JSON.parse(rawBody);
    } catch (e) {
        console.error("❌ Error parseando JSON o Payload muy grande:", e);
        return new Response(JSON.stringify({ error: "Error de datos: " + e.message }), { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
    }
    
    const { action, plan = 'free', ...data } = payload;
    console.log(`⚡ Action: ${action} | Plan: ${plan}`);

    // --- A. GENERAR TEXTO (COPY) ---
    if (action === 'generate_copy') {
        const { productData, platform, settings, angle } = data;
        
        const prompt = `
          Eres un experto copywriter de e-commerce.
          Producto: "${productData.name}".
          Beneficio Clave: "${productData.benefit}".
          Audiencia: "${settings.targetAudience}".
          Plataforma: ${platform}.
          Tono: ${settings.tone}.
          Ángulo Creativo: ${angle}.
          
          Tu tarea: Escribe un caption persuasivo usando el método AIDA.
          Requisitos:
          1. Incluye emojis relevantes.
          2. Genera 5-7 hashtags estratégicos.
          3. Responde ESTRICTAMENTE en JSON.
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
            
            const cleanText = (response.text || '{}').replace(/```json/g, '').replace(/```/g, '').trim();
            const result = JSON.parse(cleanText);
            
            return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        } catch (e) {
            console.error("Error Copy:", e);
            return new Response(JSON.stringify({ 
              copy: `¡Descubre ${productData.name}! ✨\n\n${productData.benefit}\n\nConsíguelo ahora. 👇`,
              hashtags: ["#fyp", "#viral", "#nuevo"]
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
    }

    // --- B. REGENERAR TEXTO ---
    if (action === 'regenerate_copy') {
        const { productName, platform, tone } = data;
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: `Reescribe un caption corto y atractivo para "${productName}" en ${platform}. Tono: ${tone}.`,
            });
            return new Response(JSON.stringify({ text: response.text }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        } catch (e) {
            return new Response(JSON.stringify({ text: "Error regenerando texto." }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
    }

    // --- C. EDITAR IMAGEN (FIDELIDAD EXTREMA) ---
    if (action === 'generate_visual') {
        const { angle, state, settings } = data;
        const { productData, visualStyle } = state;

        console.log("🎨 Generando imagen con Gemini 2.5 Flash Image...");

        // 1. Preparar Imagen Base
        let imageData = null;
        let mimeType = 'image/png';

        if (productData.baseImage) {
            try {
                const parts = productData.baseImage.split(',');
                if (parts.length === 2) {
                    const match = parts[0].match(/:(.*?);/);
                    if (match) mimeType = match[1];
                    imageData = parts[1];
                }
            } catch (e) { console.error("Error parseando base64", e); }
        }

        const parts = [];
        let promptText = "";

        // 2. Construir Prompt según si hay imagen o no
        if (imageData) {
            // --- PROMPT QUE PUEDES VER EN LOGS ---
            promptText = `
              Role: Professional Product Photographer & Editor.
              
              INPUT IMAGE: The image provided is the HERO product.
              STRICT RULE: DO NOT modify, warp, or redraw the product itself. Keep the logo, shape, and text of the product EXACTLY as is.
              
              TASK: Composite this product into a new environment.
              STYLE: ${visualStyle}.
              LIGHTING: Professional studio lighting with accents of ${settings.primaryColor}.
              ANGLE: ${angle}.
              OUTPUT: A generic photorealistic background that matches the product perspective. High resolution.
            `;
            
            console.log("📜 --- PROMPT USADO PARA IMAGEN ---");
            console.log(promptText);
            console.log("📜 ------------------------------");

            // Añadir imagen y texto al request (Multimodal)
            parts.push({ inlineData: { mimeType, data: imageData } });
            parts.push({ text: promptText });
        } else {
            promptText = `
              Create a professional product photography shot.
              Product Name: "${productData.name}".
              Context: ${productData.benefit}.
              Style: ${visualStyle}.
              Colors: ${settings.primaryColor}.
              Angle: ${angle}.
              Quality: Photorealistic, 4k, Commercial.
            `;
            console.log("📜 --- PROMPT (SIN IMAGEN) ---");
            console.log(promptText);
            parts.push({ text: promptText });
        }

        try {
            // Usamos gemini-2.5-flash-image
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: { parts: parts },
            });

            // 3. Extraer Imagen de la respuesta
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
                    debugPrompt: promptText // <--- DEVOLVEMOS EL PROMPT AL FRONTEND
                }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }
            
            throw new Error("El modelo no devolvió datos de imagen. Posible bloqueo de seguridad.");

        } catch (e) {
            console.error("Image Gen Error:", e);
            const fallbackUrl = productData.baseImage || `https://placehold.co/1080x1350/000000/FFF?text=${encodeURIComponent(productData.name)}`;
            return new Response(JSON.stringify({ 
                url: fallbackUrl,
                isVideo: false,
                note: "Error generando imagen nueva. Mostrando original.",
                debugError: e.message,
                debugPrompt: promptText
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
    }

    // --- D. ANIMAR IMAGEN (VEO 3.1) ---
    if (action === 'animate_image') {
        const { image } = data;
        
        try {
            const parts = image.split(',');
            const mimeType = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
            const imageBytes = parts[1];

            console.log("🎬 Iniciando generación de video con Veo...");

            const operation = await ai.models.generateVideos({
                model: 'veo-3.1-fast-generate-preview',
                image: { imageBytes, mimeType },
                prompt: "Cinematic slow motion product reveal, professional lighting, 4k resolution, smooth camera movement.",
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
            console.error("Veo Init Error:", e);
            return new Response(JSON.stringify({ error: "Error iniciando video: " + e.message }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
    }

    // --- E. POLLING VIDEO ---
    if (action === 'get_video_operation') {
        const { operationName } = data;
        if (!operationName) return new Response(JSON.stringify({ error: "No operation name provided" }), { headers: corsHeaders });

        try {
            const operation = await ai.operations.getVideosOperation({ 
                operation: { name: operationName } 
            });
            
            let videoUri = null;
            let done = false;

            if (operation.done) {
                done = true;
                const vid = operation.response?.generatedVideos?.[0] || operation.result?.generatedVideos?.[0];
                if (vid?.video?.uri) {
                    videoUri = `${vid.video.uri}&key=${apiKey}`;
                }
            }

            return new Response(JSON.stringify({ done, videoUri }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });

        } catch (e) {
            console.warn("Polling Check Error (Handled):", e.message);
            return new Response(JSON.stringify({ done: false, debugError: e.message }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
    }

    return new Response(JSON.stringify({ error: "Acción desconocida" }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error: any) {
    console.error("CRITICAL SERVER ERROR:", error);
    return new Response(JSON.stringify({ error: "Server Error: " + error.message }), {
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
