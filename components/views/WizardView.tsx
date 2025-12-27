
import React, { useState, useEffect } from 'react';
import { Camera, ChevronRight, ChevronLeft, Upload, Sparkles, RefreshCw, CheckCircle, Lock, Zap, Smartphone, Monitor, Tag, Type } from 'lucide-react';
import QRCode from 'react-qr-code';
import { CONTENT_OPTIONS, PLATFORM_OPTIONS, STYLE_OPTIONS, CREDIT_COSTS } from '../../constants';
import { WizardState, ContentType, Platform, VisualStyle, CampaignResult, BusinessSettings, UserSubscription } from '../../types';
import { generateCampaign } from '../../services/geminiService';
import { SelectionCard, VariantCard } from '../Shared';
import { useToast } from '../ui/Toast';
import { supabase } from '../../lib/supabase';

interface WizardViewProps {
  businessSettings: BusinessSettings;
  onCampaignCreated: (campaign: CampaignResult) => void;
  onViewImage: (img: string) => void;
  subscription: UserSubscription;
  onDecrementCredit: (amount: number) => void;
}

export const WizardView: React.FC<WizardViewProps> = ({ 
  businessSettings, 
  onCampaignCreated, 
  onViewImage, 
  subscription,
  onDecrementCredit
}) => {
  const { addToast } = useToast();
  
  const [state, setState] = useState<WizardState>({
    step: 0,
    contentType: null,
    platform: null,
    visualStyle: null,
    productData: {
      name: '',
      description: '', 
      benefit: '',
      targetAudience: '',
      price: '',
      promoDetails: '',
    }
  });

  const [result, setResult] = useState<CampaignResult | null>(null);
  
  const [uploadMethod, setUploadMethod] = useState<'desktop' | 'mobile'>('desktop');
  const [qrSessionId, setQrSessionId] = useState<string | null>(null);

  const isVideo = 
    state.contentType === ContentType.VIDEO_REEL || 
    state.platform === Platform.TIKTOK || 
    state.platform === Platform.IG_REELS;

  const currentCost = isVideo ? CREDIT_COSTS.VIDEO : CREDIT_COSTS.IMAGE;

  useEffect(() => {
    return () => {
      if (qrSessionId) {
        supabase.removeAllChannels();
      }
    };
  }, [qrSessionId]);

  const nextStep = () => setState(prev => ({ ...prev, step: prev.step + 1 }));
  const prevStep = () => setState(prev => ({ ...prev, step: prev.step - 1 }));

  const updateProductData = (field: string, value: string) => {
    setState(prev => ({
      ...prev,
      productData: { ...prev.productData, [field]: value }
    }));
  };

  // --- FUNCIÓN DE COMPRESIÓN DE IMAGEN ---
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // 1. Validación inicial
      if (file.size > 15 * 1024 * 1024) { // 15MB límite absoluto crudo
        addToast("La imagen es demasiado pesada. Usa una menor a 15MB.", "error");
        return;
      }

      addToast("Optimizando imagen para IA...", "info");

      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          // 2. Redimensionar y Comprimir en Canvas
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Límite de 1280px es suficiente para Gemini y evita payloads gigantes
          const MAX_SIZE = 1280; 

          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            
            // 3. Exportar como JPEG con calidad 0.8 (Reduce tamaño ~80%)
            const optimizedBase64 = canvas.toDataURL('image/jpeg', 0.8);
            
            console.log(`📉 Imagen comprimida: ${Math.round(optimizedBase64.length / 1024)}KB`);
            updateProductData('baseImage', optimizedBase64);
            addToast("Imagen lista.", "success");
          }
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const initMobileUpload = async () => {
    setUploadMethod('mobile');
    if (qrSessionId) return; 

    try {
        const { data, error } = await supabase
            .from('upload_sessions')
            .insert({})
            .select()
            .single();

        if (error) throw error;
        
        const newSessionId = data.id;
        setQrSessionId(newSessionId);

        supabase.channel(`upload-${newSessionId}`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'upload_sessions', filter: `id=eq.${newSessionId}` },
                async (payload) => {
                    if (payload.new.status === 'completed' && payload.new.image_url) {
                        addToast("¡Imagen recibida del celular!", "success");
                        try {
                            const res = await fetch(payload.new.image_url);
                            const blob = await res.blob();
                            // También comprimimos la imagen que viene del celular
                            const reader = new FileReader();
                            reader.onloadend = () => {
                                // Reusamos la lógica de compresión simulando un evento si es necesario, 
                                // pero por simplicidad aquí asumimos que el mobile upload ya maneja tamaños razonables
                                // o implementamos una compresión rápida:
                                const img = new Image();
                                img.onload = () => {
                                    const canvas = document.createElement('canvas');
                                    const MAX = 1280;
                                    let w = img.width, h = img.height;
                                    if (w > h) { if (w > MAX) { h *= MAX/w; w = MAX; } }
                                    else { if (h > MAX) { w *= MAX/h; h = MAX; } }
                                    canvas.width = w; canvas.height = h;
                                    canvas.getContext('2d')?.drawImage(img, 0, 0, w, h);
                                    updateProductData('baseImage', canvas.toDataURL('image/jpeg', 0.8));
                                };
                                img.src = reader.result as string;
                            };
                            reader.readAsDataURL(blob);
                        } catch(e) {
                            console.error("Error fetching image", e);
                            addToast("Error procesando imagen remota", "error");
                        }
                    }
                }
            )
            .subscribe();

    } catch (e) {
        console.error(e);
        addToast("Error iniciando sesión remota", "error");
        setUploadMethod('desktop');
    }
  };

  const handleGenerate = async () => {
    if (subscription.credits < currentCost) {
        addToast(`Necesitas ${currentCost} créditos. Tienes ${subscription.credits}.`, "error");
        return;
    }

    nextStep(); 
    
    try {
      console.log("🚀 Enviando petición al servidor...");
      const generated = await generateCampaign(state, businessSettings, subscription.plan);
      setResult(generated);
      onCampaignCreated(generated); 
      onDecrementCredit(currentCost); 
      setState(prev => ({ ...prev, step: 6 })); 
      addToast("¡Contenido generado!", "success");
      
      console.log("✅ Mira la consola arriba para ver 'DEBUG PROMPT' y leer lo que usó Gemini.");
      
    } catch (e: any) {
      console.error(e);
      addToast("Error generando contenido. Revisa tu conexión o intenta con otra imagen.", "error");
      prevStep();
    }
  };

  const resetApp = () => {
    setState({
      step: 1,
      contentType: null,
      platform: null,
      visualStyle: null,
      productData: { ...state.productData, baseImage: undefined } 
    });
    setResult(null);
    setQrSessionId(null);
    setUploadMethod('desktop');
  };

  if (state.step === 0) {
     return (
      <div className="min-h-screen flex flex-col relative overflow-hidden bg-[#020617]">
        <div className="flex-1 flex flex-col justify-center items-center p-8 text-center max-w-md mx-auto z-10 animate-in fade-in duration-700">
          <div className="w-24 h-24 bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-3xl flex items-center justify-center shadow-[0_0_30px_rgba(99,102,241,0.4)] mb-8 transform rotate-3 border border-white/10">
            <Camera size={48} className="text-white drop-shadow-md" />
          </div>
          <h1 className="text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-white via-indigo-100 to-indigo-300 mb-2 tracking-tighter">sellfy</h1>
          <p className="text-xs uppercase tracking-[0.3em] text-indigo-400 font-bold mb-6">Crea, publica, vende</p>
          <p className="text-lg text-slate-400 mb-10 leading-relaxed font-light">
             Powered by <span className="text-indigo-400 font-semibold">Sellfy AI</span> para máxima fidelidad visual.
          </p>
          
          <div className="space-y-4 w-full">
            <button 
                onClick={nextStep}
                className="group w-full relative bg-indigo-600 hover:bg-indigo-500 text-white text-lg font-semibold py-4 px-8 rounded-2xl shadow-[0_0_20px_rgba(79,70,229,0.4)] transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2 overflow-hidden"
            >
                <span className="relative z-10 flex items-center gap-2">Comenzar Ahora <ChevronRight size={20} /></span>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`max-w-2xl mx-auto pt-6 pb-32 ${state.step === 6 ? 'max-w-[1400px]' : ''}`}>
      {state.step > 0 && state.step < 6 && (
          <div className="w-full mb-10 shrink-0 relative z-40">
            <div className="h-1.5 bg-white/5 w-full rounded-full overflow-hidden border border-white/5 backdrop-blur-sm">
              <div 
                className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.6)] transition-all duration-700 ease-out"
                style={{ width: `${(state.step / 5) * 100}%` }}
              />
            </div>
          </div>
      )}

      {/* Steps 1-3 ... (Same as before, abbreviated for clarity) */}
      {state.step === 1 && (
        <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
          <div className="mb-8"><h2 className="text-3xl font-bold text-white tracking-tight mb-2">¿Qué vamos a crear?</h2><p className="text-slate-500">Selecciona el tipo de contenido para hoy</p></div>
          <div className="grid grid-cols-2 gap-4">{CONTENT_OPTIONS.map((opt) => (<SelectionCard key={opt.id} title={opt.label} description={opt.desc} icon={opt.icon} selected={state.contentType === opt.id} onClick={() => setState(prev => ({ ...prev, contentType: opt.id as ContentType }))}/>))}</div>
        </div>
      )}

      {state.step === 2 && (
        <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
          <div className="mb-8"><h2 className="text-3xl font-bold text-white tracking-tight mb-2">¿Dónde publicarás?</h2><p className="text-slate-500">Optimizaremos la relación de aspecto</p></div>
          <div className="space-y-3">{PLATFORM_OPTIONS.map((opt) => (<div key={opt.id} onClick={() => setState(prev => ({ ...prev, platform: opt.id as Platform }))} className={`group flex items-center p-5 rounded-2xl border cursor-pointer transition-all duration-300 ${state.platform === opt.id ? 'border-indigo-500/50 bg-indigo-500/10 shadow-[0_0_20px_-5px_rgba(99,102,241,0.25)]' : 'border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/10'}`}><div className={`p-3 rounded-xl mr-5 transition-colors ${state.platform === opt.id ? 'bg-indigo-500 text-white' : 'bg-white/5 text-slate-400 group-hover:text-white'}`}><opt.icon size={24} /></div><div className="flex-1"><h3 className={`font-semibold text-base ${state.platform === opt.id ? 'text-white' : 'text-slate-300 group-hover:text-white'}`}>{opt.label}</h3><p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p></div>{state.platform === opt.id && <CheckCircle className="text-indigo-400 drop-shadow-[0_0_5px_rgba(129,140,248,0.5)]" size={24} />}</div>))}</div>
        </div>
      )}

      {state.step === 3 && (
        <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
          <div className="mb-8"><h2 className="text-3xl font-bold text-white tracking-tight mb-2">Elige el estilo visual</h2><p className="text-slate-500">Define la personalidad de la imagen</p></div>
          <div className="grid grid-cols-2 gap-4">{STYLE_OPTIONS.map((opt) => (<SelectionCard key={opt.id} title={opt.label} icon={opt.icon} selected={state.visualStyle === opt.id} onClick={() => setState(prev => ({ ...prev, visualStyle: opt.id as VisualStyle }))} extraClass={opt.color}/>))}</div>
        </div>
      )}

      {state.step === 4 && (
        <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-white tracking-tight mb-2">Detalles del Producto</h2>
            <p className="text-slate-500">Nuestra IA de Visión analizará esto para máxima fidelidad</p>
          </div>

          <div className="bg-white/5 backdrop-blur-lg p-8 rounded-3xl border border-white/10 space-y-6 shadow-2xl">
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wide">Nombre del Producto</label>
              <input type="text" className="w-full p-4 bg-slate-900/50 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all" value={state.productData.name} onChange={(e) => updateProductData('name', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wide">Descripción del Producto</label>
              <textarea className="w-full p-4 bg-slate-900/50 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:ring-2 focus:ring-indigo-500/50 outline-none h-20 resize-none" value={state.productData.description} onChange={(e) => updateProductData('description', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wide">Beneficio Principal</label>
              <textarea className="w-full p-4 bg-slate-900/50 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:ring-2 focus:ring-indigo-500/50 outline-none h-20 resize-none" value={state.productData.benefit} onChange={(e) => updateProductData('benefit', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4 pt-2">
                <div><label className="flex items-center gap-2 text-xs font-bold text-indigo-400 mb-2 uppercase tracking-wide"><Tag size={12} /> Oferta / Descuento</label><input type="text" placeholder="Ej: 20% OFF" className="w-full p-4 bg-slate-900/50 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all" value={state.productData.promoDetails || ''} onChange={(e) => updateProductData('promoDetails', e.target.value)} /></div>
                <div><label className="flex items-center gap-2 text-xs font-bold text-emerald-400 mb-2 uppercase tracking-wide"><Type size={12} /> Texto Extra / Precio</label><input type="text" placeholder="Ej: Solo hoy $19.99" className="w-full p-4 bg-slate-900/50 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all" value={state.productData.price || ''} onChange={(e) => updateProductData('price', e.target.value)} /></div>
            </div>

            <div className="pt-2">
              <label className="block text-xs font-bold text-slate-400 mb-4 uppercase tracking-wide">Foto de referencia</label>
              <div className="flex bg-slate-900/50 p-1 rounded-xl mb-4 border border-white/5 w-fit">
                <button onClick={() => setUploadMethod('desktop')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${uploadMethod === 'desktop' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}><Monitor size={14} /> Desktop</button>
                <button onClick={() => initMobileUpload()} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${uploadMethod === 'mobile' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}><Smartphone size={14} /> Celular / QR</button>
              </div>

              {uploadMethod === 'desktop' && (
                  <div className="relative group animate-in fade-in duration-300">
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" id="file-upload"/>
                    <label htmlFor="file-upload" className="flex items-center justify-center w-full p-8 border border-dashed border-white/10 rounded-2xl bg-slate-900/30 cursor-pointer hover:bg-slate-800/50 hover:border-indigo-500/30 transition-all">
                      {state.productData.baseImage ? (
                        <div className="relative w-full h-40 overflow-hidden rounded-xl shadow-lg"><img src={state.productData.baseImage} alt="Preview" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" /><div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity"><span className="text-white text-xs font-medium bg-black/50 px-3 py-1 rounded-full border border-white/20">Cambiar imagen</span></div></div>
                      ) : (
                        <div className="flex flex-col items-center text-slate-500 group-hover:text-indigo-400 transition-colors"><div className="bg-white/5 p-4 rounded-full mb-3 group-hover:bg-indigo-500/20 transition-colors"><Upload size={24} /></div><span className="text-sm font-medium">Subir foto desde PC</span></div>
                      )}
                    </label>
                  </div>
              )}

              {uploadMethod === 'mobile' && (
                  <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-6 flex flex-col items-center text-center animate-in zoom-in-95 duration-300">
                     {state.productData.baseImage ? (
                         <div className="w-full"><div className="flex items-center justify-center gap-2 text-emerald-400 mb-4 bg-emerald-500/10 py-2 rounded-lg"><CheckCircle size={16} /> <span className="text-sm font-bold">¡Imagen recibida!</span></div><div className="relative w-full h-48 overflow-hidden rounded-xl border border-white/10"><img src={state.productData.baseImage} className="w-full h-full object-cover" /></div><button onClick={initMobileUpload} className="mt-4 text-xs text-slate-400 underline hover:text-white">Escanear otro código</button></div>
                     ) : (
                        <>{qrSessionId ? (<><div className="bg-white p-4 rounded-xl mb-4 shadow-[0_0_30px_rgba(255,255,255,0.1)]"><QRCode value={`${window.location.origin}/?mobile_upload=${qrSessionId}`} size={160} /></div><h4 className="text-white font-bold mb-1 flex items-center gap-2"><Smartphone size={16} className="text-indigo-400" /> Escanea con tu celular</h4><p className="text-xs text-slate-400 max-w-[200px]">Abre la cámara de tu teléfono y escanea para subir la foto instantáneamente.</p><div className="mt-4 flex items-center gap-2 text-[10px] text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full animate-pulse"><div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>Esperando conexión...</div></>) : (<div className="py-10"><div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto"></div></div>)}</>
                     )}
                  </div>
              )}
            </div>
          </div>
        </div>
      )}

      {state.step === 5 && (
        <div className="h-full flex flex-col items-center justify-center text-center space-y-8 animate-in fade-in duration-700 mt-20">
          <div className="relative">
            <div className="w-40 h-40 rounded-full border-2 border-indigo-500/20"></div>
            <div className="absolute top-0 left-0 w-40 h-40 rounded-full border-t-2 border-indigo-500 animate-spin shadow-[0_0_40px_rgba(99,102,241,0.4)]"></div>
            <Sparkles className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-indigo-400 animate-pulse drop-shadow-[0_0_10px_rgba(129,140,248,0.8)]" size={48} />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">Creando Magia</h2>
            <p className="text-slate-500 text-lg font-light">
              {isVideo ? "Nuestro motor de video está renderizando..." : "Diseñando imágenes de alta fidelidad..."}
              <br/>
              <span className="text-xs text-indigo-400 mt-2 block">
                 Costo: {currentCost} créditos
              </span>
            </p>
          </div>
        </div>
      )}

      {state.step === 6 && result && (
        <div className="space-y-8 pb-20 animate-in slide-in-from-bottom-8 duration-500">
          <div className="text-center mb-8">
             <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">¡Campaña Lista!</h2>
             <p className="text-slate-400">Generado con IA de última generación para {state.platform}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {result.variants.map((variant) => (
              <VariantCard key={variant.id} variant={variant} onView={onViewImage} showWatermark={subscription.plan === 'free'} />
            ))}
          </div>
        </div>
      )}

      {/* FOOTER */}
      {state.step > 0 && state.step < 5 && (
        <footer className="absolute bottom-0 left-0 right-0 bg-[#020617]/90 backdrop-blur-xl border-t border-white/5 p-6 z-50 animate-in slide-in-from-bottom-4">
          <div className="max-w-2xl mx-auto flex gap-4">
            <button onClick={prevStep} className="px-6 py-4 rounded-xl font-bold text-slate-400 bg-white/5 border border-white/5 hover:bg-white/10 hover:text-white transition-all">
              <ChevronLeft size={24} />
            </button>
            
            {subscription.credits < currentCost && state.step === 4 ? (
               <div className="flex-1 bg-slate-800 border border-red-500/30 rounded-xl p-4 flex items-center justify-between">
                 <div className="flex items-center gap-3">
                   <Lock className="text-red-400" size={20} />
                   <div>
                       <span className="text-sm font-medium text-slate-300 block">Insuficientes créditos</span>
                       <span className="text-xs text-slate-500 block">Requieres {currentCost}, tienes {subscription.credits}</span>
                   </div>
                 </div>
                 <span className="text-xs font-bold text-indigo-400 uppercase tracking-wide">Mejorar Plan</span>
               </div>
            ) : (
                <button 
                onClick={state.step === 4 ? handleGenerate : nextStep}
                disabled={
                    (state.step === 1 && !state.contentType) || 
                    (state.step === 2 && !state.platform) || 
                    (state.step === 3 && !state.visualStyle) ||
                    (state.step === 4 && (!state.productData.name || !state.productData.description || (!state.productData.baseImage && !state.productData.description))) // BaseImage is optional but good check
                }
                className={`
                    flex-1 rounded-xl font-bold text-white text-lg shadow-lg flex items-center justify-center gap-2 transition-all relative overflow-hidden
                    ${((state.step === 1 && !state.contentType) || (state.step === 4 && (!state.productData.name || !state.productData.description))) 
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5' 
                    : 'bg-indigo-600 hover:bg-indigo-500 shadow-[0_0_25px_rgba(79,70,229,0.3)] hover:scale-[1.01]'}
                `}
                >
                {state.step === 4 ? (
                    <span className="flex items-center gap-2">
                        Generar <span className="text-xs bg-black/20 px-2 py-0.5 rounded-full flex items-center gap-1 border border-white/10"><Zap size={10} fill="currentColor"/> -{currentCost}</span>
                    </span>
                ) : 'Continuar'}
                {state.step === 4 ? <Sparkles size={20} className="animate-pulse" /> : <ChevronRight size={24} />}
                </button>
            )}
          </div>
        </footer>
      )}

      {state.step === 6 && (
        <footer className="absolute bottom-0 left-0 right-0 bg-[#020617]/90 backdrop-blur-xl border-t border-white/5 p-4 z-50 animate-in slide-in-from-bottom-4">
           <div className="max-w-2xl mx-auto flex justify-center">
            <button onClick={resetApp} className="group flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-white hover:bg-white/5 px-4 py-2 rounded-full border border-transparent hover:border-white/10 transition-all duration-300">
              <RefreshCw size={14} className="group-hover:rotate-180 transition-transform duration-500" /> 
              <span>Crear Nuevo</span>
            </button>
          </div>
        </footer>
      )}
    </div>
  );
};
