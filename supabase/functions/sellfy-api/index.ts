
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

    // --- C. Generar Imagen Visual (FIDELIDAD MEJORADA) ---
    if (action === 'generate_visual') {
        const { angle, state, settings } = data;
        const { productData, visualStyle } = state;

        const parts = [];
        let hasImage = false;

        if (state.productData.baseImage) {
            try {
                // Parsing robusto de Base64 (split por coma es más seguro que regex complejo)
                const partsBase64 = state.productData.baseImage.split(',');
                if (partsBase64.length === 2) {
                    const mimeMatch = partsBase64[0].match(/:(.*?);/);
                    const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
                    const data64 = partsBase64[1];

                    if (data64) {
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
           // Prompt de Edición Estricto para evitar alucinaciones
           promptText = `
             You are a professional product photo editor.
             INPUT: The image provided is the REAL PRODUCT.
             TASK: Keep the product EXACTLY as it is (pixels, logo, shape, color). Do not redraw it.
             ACTION: Change the background to a "${visualStyle}" style.
             LIGHTING: Use ${settings.primaryColor} and ${settings.secondaryColor} hints.
             CONTEXT: ${productData.benefit}.
             ANGLE: ${angle}.
             OUTPUT: A photorealistic product shot.
           `;
        } else {
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
            throw new Error("No se generó imagen en la respuesta.");

        } catch (e) {
            console.error("Image Gen Error:", e);
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
            const partsBase64 = image.split(',');
            if (partsBase64.length !== 2) throw new Error("Formato de imagen inválido");
            
            const mimeMatch = partsBase64[0].match(/:(.*?);/);
            const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
            const data64 = partsBase64[1];

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

    // --- E. Polling Video (CORREGIDO) ---
    if (action === 'get_video_operation') {
        const { operationName } = data;
        
        if (!operationName) {
             return new Response(JSON.stringify({ done: false, error: "Missing operationName" }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        try {
            // USAMOS getVideosOperation ESPECÍFICO PARA VEO
            // Pasamos el objeto con la propiedad 'name' correctamente según el SDK
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
            console.error("Polling Exception:", e);
            // Devolvemos el error en debugInfo para que el cliente sepa qué pasó
            // Pero mantenemos done: false para que siga reintentando si es un error transitorio
            return new Response(JSON.stringify({ 
                done: false, 
                debugError: e.message,
                debugStack: e.stack 
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
    }

    return new Response(JSON.stringify({ error: `Unknown action` }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error: any) {
    console.error("GLOBAL SERVER ERROR:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
