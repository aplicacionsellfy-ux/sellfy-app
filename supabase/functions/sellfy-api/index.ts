
// @ts-nocheck
import { GoogleGenAI, Type } from "@google/genai";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  // 1. Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 2. Obtener API Key de forma segura
    const apiKey = Deno.env.get('API_KEY');
    if (!apiKey) {
      throw new Error("Server Misconfiguration: Missing API_KEY in Edge Function secrets.");
    }

    const ai = new GoogleGenAI({ apiKey });
    const { action, ...payload } = await req.json();

    // --- RUTAS DE LA API ---

    // A. Generar Texto (Copywriting)
    if (action === 'generate_copy') {
        const { productData, platform, settings, angle } = payload;
        
        const prompt = `
          ROLE: Social Media Copywriter for ${settings.industry}.
          TASK: Write a caption for "${productData.name}".
          CONTEXT: Platform: ${platform}. Angle: ${angle}. Tone: ${settings.tone}.
          DETAILS: Benefit: ${productData.benefit}.
          REQUIREMENTS: Spanish. AIDA framework. 3-5 hashtags. Emojis.
        `;

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
        
        return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    // B. Regenerar Texto
    if (action === 'regenerate_copy') {
        const { productName, platform, tone } = payload;
        const prompt = `Rewrite caption for "${productName}". Platform: ${platform}. Tone: ${tone}. Spanish. Short.`;
        
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
        });
        
        return new Response(JSON.stringify({ text: response.text }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    // C. Generar Imagen Visual - LÓGICA DE FIDELIDAD Y BRANDING
    if (action === 'generate_visual') {
        const { angle, state, settings } = payload;
        const { productData, visualStyle } = state;

        const parts = [];
        let promptText = "";

        // Si hay una imagen base, usamos un prompt de COMPOSICIÓN estricta
        if (state.productData.baseImage) {
           promptText = `
             TASK: Professional Product Photography Compositing.
             
             INSTRUCTION FOR THE PRODUCT (FOREGROUND):
             - **DO NOT REDRAW THE PRODUCT**.
             - **DO NOT ALTER THE LABEL OR SHAPE**.
             - Use the object in the input image EXACTLY as it is pixel-by-pixel.
             
             INSTRUCTION FOR THE BACKGROUND:
             1. **BRAND COLORS**: You MUST incorporate the brand colors into the lighting, shadows, or background props.
                - Primary Color: ${settings.primaryColor} (Use as main ambient light or background surface).
                - Secondary Color: ${settings.secondaryColor} (Use for rim lighting or small details).
             
             2. **MOOD & ATMOSPHERE**: Use the text "${productData.benefit}" ONLY to define the vibe (e.g. energetic, calm, luxury), NOT to change the product appearance.
             
             3. **SCENE**: ${visualStyle} style. ${angle} perspective.
             
             OUTPUT: 4K Photorealistic Image. High fidelity.
           `;
        } else {
           // Si NO hay imagen base, permitimos generación creativa, pero con branding forzado
           promptText = `
             Create a photorealistic product shot for "${productData.name}".
             
             BRANDING GUIDELINES:
             - Dominant Color: ${settings.primaryColor}
             - Accent Color: ${settings.secondaryColor}
             
             SCENE DETAILS:
             - Style: ${visualStyle}
             - Angle: ${angle}
             - Vibe: ${productData.benefit}
             
             Quality: 4k, Commercial Photography.
           `;
        }

        parts.push({ text: promptText });

        if (state.productData.baseImage) {
            const matches = state.productData.baseImage.match(/^data:([^;]+);base64,(.+)$/);
            if (matches) {
                parts.push({
                    inlineData: {
                        mimeType: matches[1],
                        data: matches[2]
                    }
                });
            }
        }

        try {
            // Usamos Gemini 3 Pro. Es el mejor modelo para seguir instrucciones complejas de color y composición.
            const response = await ai.models.generateContent({
                model: 'gemini-3-pro-image-preview', 
                contents: { parts: parts },
                config: {
                    imageConfig: {
                        aspectRatio: "1:1",
                    }
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
                return new Response(JSON.stringify({ url: `data:image/png;base64,${b64}`, isVideo: false }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
            throw new Error("No image generated.");
        } catch (e) {
            console.error("Image gen failed:", e);
            return new Response(JSON.stringify({ 
                url: `https://placehold.co/1080x1080/1e293b/ffffff?text=${encodeURIComponent(productData.name)}+Error`, 
                isVideo: false,
                error: e.message
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
    }

    // D. Animar Imagen (Video - Veo)
    if (action === 'animate_image') {
        const { image } = payload; 
        const matches = image.match(/^data:([^;]+);base64,(.+)$/);
        
        if (!matches) throw new Error("Invalid image format");

        try {
            const operation = await ai.models.generateVideos({
                model: 'veo-3.1-fast-generate-preview',
                prompt: "Cinematic slow motion, commercial product lighting, 4k.",
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

            return new Response(JSON.stringify({ operationName: operation.name }), {
                 headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        } catch (e) {
            console.error("Video creation failed:", e);
            throw new Error(`Video init failed: ${e.message}`);
        }
    }

    // E. Consultar Estado del Video (Polling)
    if (action === 'get_video_operation') {
        const { operationName } = payload;
        
        try {
            // CORRECCIÓN PARA ERROR 500:
            // Usamos el método genérico `getOperation` pasando el nombre como objeto.
            // Esto es más estable que `getVideosOperation` en ciertas versiones del SDK.
            const operation = await ai.operations.getOperation({ name: operationName });
            
            let videoUri = null;
            
            if (operation.done) {
                 // La estructura de respuesta puede variar según el endpoint, revisamos ambas posibilidades
                 // @ts-ignore
                 const rawUri = operation.response?.generatedVideos?.[0]?.video?.uri;
                 // @ts-ignore
                 const resultUri = operation.result?.generatedVideos?.[0]?.video?.uri; // Fallback común

                 const finalUri = rawUri || resultUri;

                 if (finalUri) {
                     // Adjuntar API Key es vital para que el frontend pueda descargar el video
                     videoUri = `${finalUri}&key=${apiKey}`;
                 }
            }

            return new Response(JSON.stringify({ done: operation.done, videoUri }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });

        } catch (e) {
            console.error("Polling crash avoided:", e);
            
            // IMPORTANTE: Devolvemos 200 OK con un JSON de error.
            // Esto evita que el browser muestre "500 Internal Server Error" y permite al frontend manejarlo.
            return new Response(JSON.stringify({ 
                done: false, 
                error: `Polling Error: ${e.message || 'Unknown'}` 
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
    }

    throw new Error(`Unknown action: ${action}`);

  } catch (error: any) {
    // Catch-all global
    return new Response(JSON.stringify({ error: error.message }), {
      status: 200, // Devolvemos 200 para que el cliente pueda leer el mensaje de error
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
