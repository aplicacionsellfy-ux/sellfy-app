
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
    const apiKey = Deno.env.get('API_KEY');
    if (!apiKey) {
      console.error("❌ API_KEY no encontrada en variables de entorno");
      // Devolvemos 200 con error JSON para que el frontend lo muestre bonito, no un 500 genérico
      return new Response(JSON.stringify({ error: "Falta API Key en el servidor (Supabase Secrets)." }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const ai = new GoogleGenAI({ apiKey });
    
    let payload;
    try {
        payload = await req.json();
    } catch (e) {
        return new Response(JSON.stringify({ error: "JSON inválido en el body" }), { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
    }
    
    const { action, plan = 'free', ...data } = payload;
    console.log(`[Sellfy API] Action: ${action} | Plan: ${plan}`);

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
            // Usamos Gemini 3 Flash por ser el más rápido y eficiente para texto
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
            
            // Limpieza extra por si acaso el modelo devuelve markdown
            const cleanText = (response.text || '{}').replace(/```json/g, '').replace(/```/g, '').trim();
            const result = JSON.parse(cleanText);
            
            return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        } catch (e) {
            console.error("Error Copy:", e);
            // Fallback en caso de error de IA
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
            // PROMPT CRÍTICO PARA FIDELIDAD
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
            
            // Añadir imagen y texto al request (Multimodal)
            parts.push({ inlineData: { mimeType, data: imageData } });
            parts.push({ text: promptText });
        } else {
            // Fallback: Generación pura (si el usuario no subió foto)
            promptText = `
              Create a professional product photography shot.
              Product Name: "${productData.name}".
              Context: ${productData.benefit}.
              Style: ${visualStyle}.
              Colors: ${settings.primaryColor}.
              Angle: ${angle}.
              Quality: Photorealistic, 4k, Commercial.
            `;
            parts.push({ text: promptText });
        }

        try {
            // IMPORTANTE: Usamos 'gemini-2.5-flash-image' porque respeta la imagen de entrada (inpainting/compositing)
            // 'imagen-3.0' a menudo "alucina" el producto.
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: { parts: parts },
                // No usamos responseMimeType aquí porque este modelo devuelve binarios inline
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
                    isVideo: false
                }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }
            
            throw new Error("El modelo no devolvió datos de imagen.");

        } catch (e) {
            console.error("Image Gen Error:", e);
            // Devolvemos la imagen original si falla la generación, para no romper la UI
            const fallbackUrl = productData.baseImage || `https://placehold.co/1080x1350/000000/FFF?text=${encodeURIComponent(productData.name)}`;
            return new Response(JSON.stringify({ 
                url: fallbackUrl,
                isVideo: false,
                note: "Error generando imagen nueva. Mostrando original."
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

            // Iniciar operación de video asíncrona
            const operation = await ai.models.generateVideos({
                model: 'veo-3.1-fast-generate-preview',
                image: { imageBytes, mimeType },
                prompt: "Cinematic slow motion product reveal, professional lighting, 4k resolution, smooth camera movement.",
                config: {
                    numberOfVideos: 1,
                    resolution: '720p',
                    aspectRatio: '9:16' // Formato vertical para redes
                }
            });

            // Devolvemos el nombre de la operación para hacer polling
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

    // --- E. POLLING VIDEO (BLINDADO CONTRA 500) ---
    if (action === 'get_video_operation') {
        const { operationName } = data;
        if (!operationName) return new Response(JSON.stringify({ error: "No operation name provided" }), { headers: corsHeaders });

        try {
            // Consultamos el estado de la operación
            const operation = await ai.operations.getVideosOperation({ 
                operation: { name: operationName } 
            });
            
            let videoUri = null;
            let done = false;

            if (operation.done) {
                done = true;
                // Intentamos sacar la URI del video de varios lugares posibles en la respuesta
                const vid = operation.response?.generatedVideos?.[0] || operation.result?.generatedVideos?.[0];
                if (vid?.video?.uri) {
                    // Adjuntamos la API Key porque la URL de descarga la requiere
                    videoUri = `${vid.video.uri}&key=${apiKey}`;
                }
            }

            return new Response(JSON.stringify({ done, videoUri }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });

        } catch (e) {
            // SI GOOGLE FALLA EN EL POLLING (ej. timeout o error temporal), NO LANZAMOS ERROR 500.
            // Devolvemos done: false para que el frontend siga intentando.
            console.warn("Polling Check Error (Handled):", e.message);
            return new Response(JSON.stringify({ 
                done: false, 
                debugError: e.message 
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
    }

    return new Response(JSON.stringify({ error: "Acción desconocida" }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error: any) {
    console.error("CRITICAL SERVER ERROR:", error);
    // IMPORTANTE: Devolvemos status 200 con un JSON de error.
    // Esto evita que el cliente (React) reciba una excepción de red y pueda mostrar el mensaje de error amigablemente.
    return new Response(JSON.stringify({ error: "Server Error: " + error.message }), {
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
