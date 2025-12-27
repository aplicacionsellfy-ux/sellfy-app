
import React, { useState, useEffect } from 'react';
import { Camera, ChevronRight, ChevronLeft, Upload, Sparkles, RefreshCw, CheckCircle, Lock, Zap, Smartphone, Monitor, Wand2, FileText } from 'lucide-react';
import QRCode from 'react-qr-code';
import { CONTENT_OPTIONS, PLATFORM_OPTIONS, STYLE_OPTIONS, CREDIT_COSTS, COPY_FRAMEWORKS } from '../../constants';
import { WizardState, ContentType, Platform, VisualStyle, CampaignResult, BusinessSettings, UserSubscription, CopyFramework } from '../../types';
import { generateCampaign, generateStrategicCopy } from '../../services/geminiService';
import { SelectionCard, VariantCard } from '../Shared';
import { useToast } from '../ui/Toast';
import { supabase } from '../../lib/supabase';

interface WizardViewProps {
  businessSettings: BusinessSettings;
  onCampaignCreated: (campaign: CampaignResult) => void;
  onViewImage: (img: string) => void;
  subscription: UserSubscription;
  onDecrementCredit: (amount: number) => void;
  apiKeyMissing: boolean;
}

export const WizardView: React.FC<WizardViewProps> = ({ 
  businessSettings, 
  onCampaignCreated, 
  onViewImage, 
  subscription,
  onDecrementCredit,
  apiKeyMissing
}) => {
  const { addToast } = useToast();
  
  const [state, setState] = useState<WizardState>({
    step: 0,
    contentType: null,
    platform: null,
    visualStyle: null,
    productData: {
      baseImage: undefined,
      userPrompt: '' // Inicialización limpia sin campos 'name', 'benefit', etc.
    }
  });

  const [result, setResult] = useState<CampaignResult | null>(null);
  
  // Mobile Upload State
  const [uploadMethod, setUploadMethod] = useState<'desktop' | 'mobile'>('desktop');
  const [qrSessionId, setQrSessionId] = useState<string | null>(null);

  // Copy Generation State
  const [selectedFramework, setSelectedFramework] = useState<CopyFramework>(CopyFramework.AIDA);
  const [isGeneratingCopy, setIsGeneratingCopy] = useState(false);
  const [generatedStrategicCopy, setGeneratedStrategicCopy] = useState<string | null>(null);

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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 15 * 1024 * 1024) { 
        addToast("La imagen es demasiado pesada. Usa una menor a 15MB.", "error");
        return;
      }

      addToast("Optimizando imagen para IA...", "info");

      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
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
            const optimizedBase64 = canvas.toDataURL('image/jpeg', 0.8);
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
        setQrSessionId(data.id);

        supabase.channel(`upload-${data.id}`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'upload_sessions', filter: `id=eq.${data.id}` },
                async (payload) => {
                    if (payload.new.status === 'completed' && payload.new.image_url) {
                        addToast("¡Imagen recibida!", "success");
                        try {
                            const res = await fetch(payload.new.image_url);
                            const blob = await res.blob();
                            const reader = new FileReader();
                            reader.onloadend = () => {
                                updateProductData('baseImage', reader.result as string);
                            };
                            reader.readAsDataURL(blob);
                        } catch(e) {
                            addToast("Error procesando imagen remota", "error");
                        }
                    }
                }
            )
            .subscribe();

    } catch (e) {
        addToast("Error iniciando sesión remota", "error");
        setUploadMethod('desktop');
    }
  };

  const handleGenerate = async () => {
    if (apiKeyMissing) {
        addToast("Error de configuración: Falta API Key", "error");
        return;
    }
    if (subscription.credits < currentCost) {
        addToast(`Necesitas ${currentCost} créditos. Tienes ${subscription.credits}.`, "error");
        return;
    }

    nextStep(); // Go to loading
    
    try {
      console.log("🚀 Enviando petición simplificada al servidor...");
      const generated = await generateCampaign(state, businessSettings, subscription.plan);
      setResult(generated);
      onCampaignCreated(generated); 
      onDecrementCredit(currentCost); 
      setState(prev => ({ ...prev, step: 6 })); 
      addToast("¡Visuales generados!", "success");
    } catch (e: any) {
      console.error(e);
      addToast("Error generando contenido. Intenta de nuevo.", "error");
      prevStep();
    }
  };

  const handleStrategicCopy = async () => {
    if (!state.productData.baseImage) return;
    
    setIsGeneratingCopy(true);
    try {
        const text = await generateStrategicCopy(
            state.productData.baseImage,
            state.productData.userPrompt,
            selectedFramework,
            businessSettings.tone,
            state.platform!
        );
        setGeneratedStrategicCopy(text);
        addToast("Copy Estratégico Generado", "success");
    } catch (e) {
        addToast("Error generando copy estratégico", "error");
    } finally {
        setIsGeneratingCopy(false);
    }
  };

  const resetApp = () => {
    setState({
      step: 1,
      contentType: null,
      platform: null,
      visualStyle: null,
      productData: { baseImage: undefined, userPrompt: '' } 
    });
    setResult(null);
    setQrSessionId(null);
    setUploadMethod('desktop');
    setGeneratedStrategicCopy(null);
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
          <button onClick={nextStep} className="group w-full relative bg-indigo-600 hover:bg-indigo-500 text-white text-lg font-semibold py-4 px-8 rounded-2xl shadow-[0_0_20px_rgba(79,70,229,0.4)] transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2 overflow-hidden">
             <span className="relative z-10 flex items-center gap-2">Comenzar Ahora <ChevronRight size={20} /></span>
          </button>
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

      {/* STEP 1: Content Type */}
      {state.step === 1 && (
        <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
          <div className="mb-8"><h2 className="text-3xl font-bold text-white tracking-tight mb-2">¿Qué vamos a crear?</h2><p className="text-slate-500">Selecciona el tipo de contenido.</p></div>
          <div className="grid grid-cols-2 gap-4">{CONTENT_OPTIONS.map((opt) => (<SelectionCard key={opt.id} title={opt.label} description={opt.desc} icon={opt.icon} selected={state.contentType === opt.id} onClick={() => setState(prev => ({ ...prev, contentType: opt.id as ContentType }))}/>))}</div>
        </div>
      )}

      {/* STEP 2: Platform */}
      {state.step === 2 && (
        <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
          <div className="mb-8"><h2 className="text-3xl font-bold text-white tracking-tight mb-2">¿Dónde publicarás?</h2><p className="text-slate-500">Formato optimizado para la red.</p></div>
          <div className="space-y-3">{PLATFORM_OPTIONS.map((opt) => (<div key={opt.id} onClick={() => setState(prev => ({ ...prev, platform: opt.id as Platform }))} className={`group flex items-center p-5 rounded-2xl border cursor-pointer transition-all duration-300 ${state.platform === opt.id ? 'border-indigo-500/50 bg-indigo-500/10 shadow-[0_0_20px_-5px_rgba(99,102,241,0.25)]' : 'border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/10'}`}><div className={`p-3 rounded-xl mr-5 transition-colors ${state.platform === opt.id ? 'bg-indigo-500 text-white' : 'bg-white/5 text-slate-400 group-hover:text-white'}`}><opt.icon size={24} /></div><div className="flex-1"><h3 className={`font-semibold text-base ${state.platform === opt.id ? 'text-white' : 'text-slate-300 group-hover:text-white'}`}>{opt.label}</h3><p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p></div>{state.platform === opt.id && <CheckCircle className="text-indigo-400 drop-shadow-[0_0_5px_rgba(129,140,248,0.5)]" size={24} />}</div>))}</div>
        </div>
      )}

      {/* STEP 3: Style */}
      {state.step === 3 && (
        <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
          <div className="mb-8"><h2 className="text-3xl font-bold text-white tracking-tight mb-2">Estilo Visual</h2><p className="text-slate-500">La vibra que tendrá tu imagen.</p></div>
          <div className="grid grid-cols-2 gap-4">{STYLE_OPTIONS.map((opt) => (<SelectionCard key={opt.id} title={opt.label} icon={opt.icon} selected={state.visualStyle === opt.id} onClick={() => setState(prev => ({ ...prev, visualStyle: opt.id as VisualStyle }))} extraClass={opt.color}/>))}</div>
        </div>
      )}

      {/* STEP 4: UPLOAD & INSTRUCTION (SIMPLIFIED) */}
      {state.step === 4 && (
        <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-white tracking-tight mb-2">Sube tu Producto</h2>
            <p className="text-slate-500">Sin formularios largos. Solo la foto y tu idea.</p>
          </div>

          <div className="bg-white/5 backdrop-blur-lg p-8 rounded-3xl border border-white/10 space-y-8 shadow-2xl">
            
            {/* 1. UPLOAD SECTION */}
            <div>
              <label className="block text-xs font-bold text-indigo-400 mb-4 uppercase tracking-wide flex items-center gap-2">
                <Camera size={14} /> 1. Imagen del Producto (Requerido)
              </label>
              
              <div className="flex bg-slate-900/50 p-1 rounded-xl mb-4 border border-white/5 w-fit">
                <button onClick={() => setUploadMethod('desktop')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${uploadMethod === 'desktop' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}><Monitor size={14} /> Desktop</button>
                <button onClick={() => initMobileUpload()} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${uploadMethod === 'mobile' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}><Smartphone size={14} /> Celular / QR</button>
              </div>

              {uploadMethod === 'desktop' && (
                  <div className="relative group animate-in fade-in duration-300">
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" id="file-upload"/>
                    <label htmlFor="file-upload" className="flex items-center justify-center w-full p-10 border-2 border-dashed border-white/10 rounded-2xl bg-slate-900/30 cursor-pointer hover:bg-slate-800/50 hover:border-indigo-500/50 transition-all">
                      {state.productData.baseImage ? (
                        <div className="relative w-full h-48 overflow-hidden rounded-xl shadow-2xl border border-white/10">
                            <img src={state.productData.baseImage} alt="Preview" className="w-full h-full object-contain bg-black/50" />
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="text-white text-xs font-medium bg-black/50 px-4 py-2 rounded-full border border-white/20">Cambiar imagen</span>
                            </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center text-slate-500 group-hover:text-indigo-400 transition-colors">
                           <div className="bg-white/5 p-5 rounded-full mb-4 group-hover:bg-indigo-500/20 transition-colors shadow-inner"><Upload size={32} /></div>
                           <span className="text-base font-semibold text-white">Haz clic para subir foto</span>
                           <span className="text-xs text-slate-500 mt-1">Soporta JPG, PNG (Max 15MB)</span>
                        </div>
                      )}
                    </label>
                  </div>
              )}

              {uploadMethod === 'mobile' && (
                  <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-6 flex flex-col items-center text-center animate-in zoom-in-95 duration-300">
                     {state.productData.baseImage ? (
                         <div className="w-full"><div className="flex items-center justify-center gap-2 text-emerald-400 mb-4 bg-emerald-500/10 py-2 rounded-lg"><CheckCircle size={16} /> <span className="text-sm font-bold">¡Imagen recibida!</span></div><div className="relative w-full h-48 overflow-hidden rounded-xl border border-white/10"><img src={state.productData.baseImage} className="w-full h-full object-contain bg-black/50" /></div><button onClick={initMobileUpload} className="mt-4 text-xs text-slate-400 underline hover:text-white">Escanear otro código</button></div>
                     ) : (
                        <>{qrSessionId ? (<><div className="bg-white p-4 rounded-xl mb-4 shadow-[0_0_30px_rgba(255,255,255,0.1)]"><QRCode value={`${window.location.origin}/?mobile_upload=${qrSessionId}`} size={160} /></div><h4 className="text-white font-bold mb-1 flex items-center gap-2"><Smartphone size={16} className="text-indigo-400" /> Escanea con tu celular</h4></>) : (<div className="py-10"><div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto"></div></div>)}</>
                     )}
                  </div>
              )}
            </div>

            {/* 2. PROMPT SECTION */}
            <div className="pt-6 border-t border-white/5">
                <label className="block text-xs font-bold text-indigo-400 mb-2 uppercase tracking-wide flex items-center gap-2">
                    <Wand2 size={14} /> 2. Instrucción para la IA (Nano Banana)
                </label>
                <div className="relative">
                    <textarea 
                        className="w-full p-5 bg-slate-900/50 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:ring-2 focus:ring-indigo-500/50 outline-none h-32 resize-none transition-all text-sm leading-relaxed" 
                        placeholder="Ej: Coloca el producto sobre una roca volcánica negra con iluminación dramática lateral de color neón azul. Quiero que parezca una foto de estudio profesional." 
                        value={state.productData.userPrompt} 
                        onChange={(e) => updateProductData('userPrompt', e.target.value)} 
                    />
                    <div className="absolute bottom-3 right-3 text-[10px] text-slate-500 bg-black/40 px-2 py-1 rounded">
                        Sé específico con el fondo y la luz.
                    </div>
                </div>
            </div>

          </div>
        </div>
      )}

      {/* STEP 5: Loading */}
      {state.step === 5 && (
        <div className="h-full flex flex-col items-center justify-center text-center space-y-8 animate-in fade-in duration-700 mt-20">
          <div className="relative">
            <div className="w-40 h-40 rounded-full border-2 border-indigo-500/20"></div>
            <div className="absolute top-0 left-0 w-40 h-40 rounded-full border-t-2 border-indigo-500 animate-spin shadow-[0_0_40px_rgba(99,102,241,0.4)]"></div>
            <Sparkles className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-indigo-400 animate-pulse drop-shadow-[0_0_10px_rgba(129,140,248,0.8)]" size={48} />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">Nano Banana Trabajando</h2>
            <p className="text-slate-500 text-lg font-light">
              Recortando sujeto... Generando entorno... <br/>Aplicando iluminación...
            </p>
          </div>
        </div>
      )}

      {/* STEP 6: RESULTADOS & COPY STRATEGY */}
      {state.step === 6 && result && (
        <div className="space-y-12 pb-20 animate-in slide-in-from-bottom-8 duration-500">
          
          {/* SECTION A: IMAGES */}
          <div>
             <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">Tus Visuales</h2>
                <p className="text-slate-400">Generados a partir de tu imagen original.</p>
             </div>
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {result.variants.map((variant) => (
                <VariantCard key={variant.id} variant={variant} onView={onViewImage} showWatermark={subscription.plan === 'free'} />
                ))}
            </div>
          </div>

          {/* SECTION B: COPY GENERATOR */}
          <div className="border-t border-white/10 pt-10">
             <div className="bg-[#0B0F19] border border-white/10 rounded-3xl p-8 max-w-4xl mx-auto shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-[80px] pointer-events-none"></div>
                
                <div className="flex flex-col md:flex-row gap-8">
                    <div className="flex-1 space-y-6">
                        <div>
                            <h3 className="text-2xl font-bold text-white flex items-center gap-2"><FileText className="text-emerald-400"/> Generador de Copy Estratégico</h3>
                            <p className="text-slate-400 text-sm mt-2">Ahora que tienes la imagen, crea un texto persuasivo usando marcos de venta probados.</p>
                        </div>
                        
                        <div className="grid grid-cols-1 gap-3">
                            {COPY_FRAMEWORKS.map((fw) => (
                                <button
                                    key={fw.id}
                                    onClick={() => setSelectedFramework(fw.id)}
                                    className={`text-left p-4 rounded-xl border transition-all ${selectedFramework === fw.id ? 'bg-emerald-500/10 border-emerald-500/50 text-white' : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'}`}
                                >
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="font-bold">{fw.label}</span>
                                        {selectedFramework === fw.id && <CheckCircle size={14} className="text-emerald-400"/>}
                                    </div>
                                    <p className="text-xs opacity-70">{fw.title}</p>
                                </button>
                            ))}
                        </div>

                        <button 
                            onClick={handleStrategicCopy}
                            disabled={isGeneratingCopy}
                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isGeneratingCopy ? <RefreshCw className="animate-spin" /> : <Sparkles size={18} />}
                            {isGeneratingCopy ? 'Redactando...' : 'Generar Copy Estratégico'}
                        </button>
                    </div>

                    <div className="flex-1 bg-black/20 rounded-2xl border border-white/5 p-6 relative min-h-[300px] flex flex-col">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 block">Resultado IA</span>
                        {generatedStrategicCopy ? (
                             <div className="prose prose-invert prose-sm max-w-none flex-1 overflow-y-auto pr-2 custom-scrollbar">
                                 <div className="whitespace-pre-wrap text-slate-200 leading-relaxed animate-in fade-in">
                                     {generatedStrategicCopy}
                                 </div>
                             </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-600">
                                <FileText size={48} className="mb-4 opacity-20" />
                                <p className="text-sm">Selecciona una estructura y genera el texto.</p>
                            </div>
                        )}
                        
                        {generatedStrategicCopy && (
                             <button 
                                onClick={() => {navigator.clipboard.writeText(generatedStrategicCopy); addToast("Copiado!", "success");}}
                                className="mt-4 w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-bold text-slate-300 transition-colors"
                             >
                                 Copiar al Portapapeles
                             </button>
                        )}
                    </div>
                </div>
             </div>
          </div>

        </div>
      )}

      {/* FOOTER NAV */}
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
                    (state.step === 4 && (!state.productData.baseImage || !state.productData.userPrompt))
                }
                className={`
                    flex-1 rounded-xl font-bold text-white text-lg shadow-lg flex items-center justify-center gap-2 transition-all relative overflow-hidden
                    ${((state.step === 1 && !state.contentType) || (state.step === 4 && (!state.productData.baseImage || !state.productData.userPrompt))) 
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
