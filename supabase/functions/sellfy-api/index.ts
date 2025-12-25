
// @ts-nocheck
import { GoogleGenAI, Type } from "https://esm.sh/@google/genai";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  // 1. Manejo de CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Falta API Key en el servidor." }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const ai = new GoogleGenAI({ apiKey });
    
    // Parseo seguro del body
    let payload;
    try {
        payload = await req.json();
    } catch (e) {
        return new Response(JSON.stringify({ error: "Invalid JSON body" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    const { action, ...data } = payload;
    console.log(`[Sellfy API] Action: ${action}`);

    // --- A. Generar Texto (Copy) ---
    if (action === 'generate_copy') {
        const { productData, platform, settings, angle } = data;
        const prompt = `
          ROLE: Social Media Expert.
          TASK: Write a caption for "${productData.name}".
          PLATFORM: ${platform}. ANGLE: ${angle}. TONE: ${settings.tone}.
          BENEFIT: ${productData.benefit}.
          OUTPUT: JSON with 'copy' and 'hashtags'. Spanish.
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
            const result = JSON.parse(response.text || '{"copy": "", "hashtags": []}');
            return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        } catch (e) {
            return new Response(JSON.stringify({ copy: productData.name, hashtags: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
    }

    // --- B. Regenerar Texto ---
    if (action === 'regenerate_copy') {
        const { productName, platform, tone } = data;
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Rewrite caption for "${productName}". Platform: ${platform}. Tone: ${tone}. Spanish.`,
        });
        return new Response(JSON.stringify({ text: response.text }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // --- C. Generar Imagen Visual (FIDELIDAD EXTREMA) ---
    if (action === 'generate_visual') {
        const { angle, state, settings } = data;
        const { productData, visualStyle } = state;

        const parts = [];
        let hasImage = false;

        // 1. Procesar Imagen Base (Reference Image)
        if (state.productData.baseImage) {
            try {
                // Limpieza agresiva del base64 para evitar corrupción
                const rawBase64 = state.productData.baseImage;
                // Extraer solo la data, quitando el header (data:image/xyz;base64,)
                const matches = rawBase64.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
                
                if (matches && matches.length === 3) {
                    hasImage = true;
                    parts.push({
                        inlineData: {
                            mimeType: matches[1], 
                            data: matches[2] // La data limpia
                        }
                    });
                }
            } catch (err) {
                console.error("Error procesando imagen base64:", err);
            }
        }

        // 2. Prompt de "Composición" en lugar de "Generación"
        let promptText = "";
        if (hasImage) {
           // Estrategia: Instruir a la IA que esto es una edición/composición, no un dibujo nuevo.
           promptText = `
             TASK: Product Photography Compositing.
             INSTRUCTION: Retain the input product image EXACTLY as is. Do not alter the product's shape, logo, or details.
             ACTION: Place the product in a new environment.
             
             ENVIRONMENT SETTINGS:
             - Style: ${visualStyle}.
             - Colors: Use ${settings.primaryColor} and ${settings.secondaryColor} for lighting/background accents.
             - Context: ${productData.benefit}.
             - Angle: Match the camera angle of the product (${angle}).
             
             QUALITY: Photorealistic, 4k, professional commercial photography.
           `;
        } else {
           promptText = `
             Create a professional product photo for "${productData.name}".
             Style: ${visualStyle}.
             Colors: ${settings.primaryColor}, ${settings.secondaryColor}.
             Context: ${productData.benefit}.
             Angle: ${angle}.
             High quality, photorealistic.
           `;
        }
        
        // El texto va DESPUÉS de la imagen para que la imagen sea el contexto principal
        parts.push({ text: promptText });

        try {
            // Usamos gemini-2.5-flash-image que es específico para edición/generación de imágenes
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image', 
                contents: { parts: parts },
                config: {
                    // No usamos schemas ni mimetypes JSON para imágenes, es raw text + inlineData
                }
            });

            // Buscar la parte de imagen en la respuesta
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
            throw new Error("No se generó imagen.");

        } catch (e) {
            console.error("Image Gen Error:", e);
            // Devolver placeholder en vez de fallar
            return new Response(JSON.stringify({ 
                url: `https://placehold.co/1080x1080/1e293b/ffffff?text=${encodeURIComponent(productData.name)}+Error`, 
                isVideo: false,
                error: e.message 
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
    }

    // --- D. Animar Imagen (Video - Veo) ---
    if (action === 'animate_image') {
        const { image } = data; 
        
        try {
            const matches = image.match(/^data:([^;]+);base64,(.+)$/);
            if (!matches) throw new Error("Imagen inválida");

            // Paso 1: Iniciar operación de video
            const operation = await ai.models.generateVideos({
                model: 'veo-3.1-fast-generate-preview',
                prompt: "Cinematic product showcase, slow motion, 4k commercial.",
                image: { 
                    imageBytes: matches[2], 
                    mimeType: matches[1] 
                },
                config: { 
                    numberOfVideos: 1,
                    resolution: '720p',
                    aspectRatio: '9:16'
                }
            });

            // Veo devuelve un nombre de operación tipo "projects/.../operations/..."
            return new Response(JSON.stringify({ operationName: operation.name }), {
                 headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });

        } catch (e) {
            console.error("Video Init Error:", e);
            return new Response(JSON.stringify({ error: e.message }), {
                 headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
    }

    // --- E. Polling Video (BLINDADO) ---
    if (action === 'get_video_operation') {
        const { operationName } = data;
        
        if (!operationName) {
             return new Response(JSON.stringify({ done: false, error: "No operationName" }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        try {
            // Usamos getOperation genérico. 
            // IMPORTANTE: Envolvemos en try/catch específico para esta llamada.
            // Si la operación no está lista o falla internamente en Google, no queremos que la Edge Function muera.
            const operation = await ai.operations.getOperation({ name: operationName });
            
            let videoUri = null;
            let done = false;

            // Verificar status
            if (operation.done) {
                done = true;
                // Buscar URI en multiples lugares posibles según versión de API
                const generatedVideo = operation.response?.generatedVideos?.[0] || operation.result?.generatedVideos?.[0];
                const rawUri = generatedVideo?.video?.uri;
                
                if (rawUri) {
                    videoUri = `${rawUri}&key=${apiKey}`;
                }
            }

            return new Response(JSON.stringify({ done, videoUri }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });

        } catch (e) {
            console.error("Polling Error (Ignored):", e);
            // Si falla el polling, NO devolvemos error 500.
            // Devolvemos done: false para que el cliente siga esperando.
            // Muchas veces Google devuelve 404 temporalmente mientras procesa.
            return new Response(JSON.stringify({ 
                done: false, 
                debugInfo: "Polling retry" 
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error: any) {
    // Catch-all absoluto para evitar 500 HTML standard
    console.error("CRITICAL SERVER ERROR:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
      status: 200, // Status 200 para que el cliente pueda leer el JSON
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
