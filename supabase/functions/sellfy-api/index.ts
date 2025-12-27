
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
          ROLE: Expert Social Media Copywriter (Spanish).
          TASK: Create a high-converting caption for "${productData.name}".
          DETAILS: Platform=${platform}, Angle=${angle}, Tone=${settings.tone}, Benefit=${productData.benefit}.
          OUTPUT: JSON { "copy": "string", "hashtags": ["string"] }.
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
            contents: `Rewrite caption for "${productName}" in Spanish. Platform: ${platform}. Tone: ${tone}. Keep it punchy.`,
        });
        return new Response(JSON.stringify({ text: response.text }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // --- C. Generar Imagen Visual (FIDELIDAD EXTREMA - GEMINI 2.5) ---
    if (action === 'generate_visual') {
        const { angle, state, settings } = data;
        const { productData, visualStyle } = state;

        const parts = [];
        let hasImage = false;

        // Validación y limpieza de Base64
        if (state.productData.baseImage) {
            try {
                // Soportar data URIs directas
                const partsBase64 = state.productData.baseImage.split(',');
                
                if (partsBase64.length === 2) {
                    const mimeMatch = partsBase64[0].match(/:(.*?);/);
                    const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
                    const data64 = partsBase64[1];

                    // Check de sanidad básico
                    if (data64 && data64.length > 100) { 
                        hasImage = true;
                        parts.push({
                            inlineData: {
                                mimeType: mimeType, 
                                data: data64
                            }
                        });
                    }
                }
            } catch (err) {
                console.error("Error parsing base64:", err);
            }
        }

        let promptText = "";
        if (hasImage) {
           // Prompt ESPECÍFICO para que Gemini 2.5 respete la imagen
           // "DO NOT MODIFY THE PRODUCT" es la clave
           promptText = `
             You are a professional product photographer editing a photo.
             
             INPUT IMAGE: This is the HERO product. 
             CRITICAL RULE: Keep the product EXACTLY as it is. Do not redraw it. Do not change the logo or packaging.
             
             TASK: Place this exact product in a new environment.
             STYLE: ${visualStyle}.
             LIGHTING: ${settings.primaryColor} accents.
             ANGLE: ${angle}.
             OUTPUT: High quality, photorealistic, 4k.
           `;
        } else {
           // Fallback si no hay imagen (Generación pura)
           promptText = `
             Create a professional product photo for "${productData.name}".
             Style: ${visualStyle}.
             Colors: ${settings.primaryColor}, ${settings.secondaryColor}.
             Context: ${productData.benefit}.
             Angle: ${angle}.
             High quality, photorealistic, 4k.
           `;
        }
        
        parts.push({ text: promptText });

        try {
            // Usamos gemini-2.5-flash-image porque es MULTIMODAL (entiende la imagen de entrada)
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
                return new Response(JSON.stringify({ url: `data:image/png;base64,${b64}`, isVideo: false }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
            
            throw new Error("El modelo no generó imagen visual.");

        } catch (e) {
            console.error("Image Gen Error:", e);
            return new Response(JSON.stringify({ 
                error: "Fallo en generación de imagen: " + e.message,
                // Placeholder de error visual
                url: `https://placehold.co/1080x1350/1e293b/ffffff?text=Error+Generando` 
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
    }

    // --- D. Animar Imagen (Video - VEO 3.1) ---
    if (action === 'animate_image') {
        const { image } = data; 
        
        try {
            const partsBase64 = image.split(',');
            if (partsBase64.length !== 2) throw new Error("Formato de imagen inválido");
            
            const mimeMatch = partsBase64[0].match(/:(.*?);/);
            const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
            const data64 = partsBase64[1];

            // Iniciar generación de video con Veo
            const operation = await ai.models.generateVideos({
                model: 'veo-3.1-fast-generate-preview',
                prompt: "Cinematic commercial, slow motion, 4k, professional lighting.",
                image: { 
                    imageBytes: data64, 
                    mimeType: mimeType 
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
            console.error("Video Init Error:", e);
            return new Response(JSON.stringify({ error: e.message }), {
                 headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
    }

    // --- E. Polling Video (BLINDADO CONTRA 500) ---
    if (action === 'get_video_operation') {
        const { operationName } = data;
        
        if (!operationName) {
             return new Response(JSON.stringify({ done: false, error: "Missing operationName" }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        try {
            // Usamos getVideosOperation específico para Veo
            // IMPORTANTÍSIMO: Envolvemos en try/catch para que si falla Google, NO falle nuestro servidor
            const operation = await ai.operations.getVideosOperation({ 
                operation: { name: operationName } 
            });
            
            let videoUri = null;
            let done = false;

            if (operation.done) {
                done = true;
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
            console.error("Polling Exception (Handled):", e);
            // Si hay un error al consultar el estado (ej. 404 not found temporal),
            // devolvemos done: false para que el cliente siga esperando en vez de explotar con un 500.
            return new Response(JSON.stringify({ 
                done: false, 
                debugError: "Polling wait..." 
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
    }

    return new Response(JSON.stringify({ error: `Unknown action` }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error: any) {
    console.error("CRITICAL SERVER ERROR:", error);
    // Devolvemos 200 con JSON de error para evitar la pantalla de la muerte en el cliente
    return new Response(JSON.stringify({ error: "Server Error: " + error.message }), {
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
