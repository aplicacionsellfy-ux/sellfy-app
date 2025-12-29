
import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronLeft, Upload, Sparkles, RefreshCw, CheckCircle, Lock, Zap, Smartphone, Monitor, Wand2, Tag, Filter, Loader2 } from 'lucide-react';
import QRCode from 'react-qr-code';
import { CONTENT_OPTIONS, PLATFORM_OPTIONS, STYLE_OPTIONS, CREDIT_COSTS, SCENE_PRESETS, PROMO_BADGES } from '../../constants';
import { WizardState, ContentType, Platform, VisualStyle, CampaignResult, BusinessSettings, UserSubscription } from '../../types';
import { generateCampaign, analyzeProductImage } from '../../services/geminiService';
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
    step: 1, // Start at Upload now
    contentType: null,
    platform: null,
    visualStyle: null,
    productData: {
      baseImage: undefined,
      userPrompt: '',
      promoOption: undefined,
      aiAnalysis: '' 
    }
  });

  // UI States
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [selectedPromoId, setSelectedPromoId] = useState<string>('none');
  const [isAnalyzing, setIsAnalyzing] = useState(false); // True AI Analyzing
  const [analysisComplete, setAnalysisComplete] = useState(false);

  const [result, setResult] = useState<CampaignResult | null>(null);
  
  // Mobile Upload State
  const [uploadMethod, setUploadMethod] = useState<'desktop' | 'mobile'>('desktop');
  const [qrSessionId, setQrSessionId] = useState<string | null>(null);

  const isVideo = 
    state.contentType === ContentType.VIDEO_REEL || 
    state.platform === Platform.TIKTOK || 
    state.platform === Platform.IG_REELS;

  const currentCost = isVideo ? CREDIT_COSTS.VIDEO : CREDIT_COSTS.IMAGE;

  // Filtrado de escenas basado en el estilo visual
  const filteredScenes = SCENE_PRESETS.filter(scene => {
      if (!state.visualStyle) return true;
      return scene.styles.includes(state.visualStyle);
  });
  
  const finalScenes = filteredScenes.length < 3 
    ? [...filteredScenes, ...SCENE_PRESETS.filter(s => s.id === 'studio_clean' || s.id === 'geometric_podium' || s.id === 'soft_shadow').filter(s => !filteredScenes.includes(s))]
    : filteredScenes;

  useEffect(() => {
    return () => {
      if (qrSessionId) supabase.removeAllChannels();
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

  // --- IMAGE UPLOAD LOGIC ---
  
  const performRealAnalysis = async (base64Image: string) => {
      setIsAnalyzing(true);
      try {
          // Llamada REAL a la IA
          const analysis = await analyzeProductImage(base64Image);
          updateProductData('aiAnalysis', analysis);
          setAnalysisComplete(true);
          addToast("IA: Producto identificado", "success");
      } catch (e) {
          console.error(e);
          addToast("Error analizando imagen", "error");
      } finally {
          setIsAnalyzing(false);
      }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 15 * 1024 * 1024) { 
        addToast("Imagen muy pesada (Máx 15MB)", "error");
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
             // Simple resize logic here if needed
             const canvas = document.createElement('canvas');
             let width = img.width;
             let height = img.height;
             const MAX_SIZE = 1280; 
             if (width > height) { if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }} 
             else { if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }}
             canvas.width = width; canvas.height = height;
             const ctx = canvas.getContext('2d');
             if (ctx) {
                 ctx.drawImage(img, 0, 0, width, height);
                 const processedBase64 = canvas.toDataURL('image/jpeg', 0.8);
                 updateProductData('baseImage', processedBase64);
                 // TRIGGER REAL ANALYSIS
                 performRealAnalysis(processedBase64);
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
        const { data, error } = await supabase.from('upload_sessions').insert({}).select().single();
        if (error) throw error;
        setQrSessionId(data.id);
        supabase.channel(`upload-${data.id}`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'upload_sessions', filter: `id=eq.${data.id}` }, async (payload) => {
            if (payload.new.status === 'completed' && payload.new.image_url) {
                const res = await fetch(payload.new.image_url);
                const blob = await res.blob();
                const reader = new FileReader();
                reader.onloadend = () => {
                    const processedBase64 = reader.result as string;
                    updateProductData('baseImage', processedBase64);
                    performRealAnalysis(processedBase64);
                };
                reader.readAsDataURL(blob);
            }
        }).subscribe();
    } catch (e) {
        addToast("Error iniciando sesión remota", "error");
        setUploadMethod('desktop');
    }
  };

  // --- GENERATION LOGIC ---
  const handleGenerate = async () => {
    if (apiKeyMissing) { addToast("Error: Falta API Key", "error"); return; }
    if (subscription.credits < currentCost) { addToast(`Créditos insuficientes (${currentCost})`, "error"); return; }

    const selectedScene = SCENE_PRESETS.find(s => s.id === selectedSceneId);
    const scenePrompt = selectedScene ? selectedScene.prompt : "Professional studio photography.";
    const promoBadge = PROMO_BADGES.find(p => p.id === selectedPromoId)?.text;

    const stateWithData = {
        ...state,
        productData: {
            ...state.productData,
            userPrompt: scenePrompt,
            promoOption: promoBadge || undefined
        }
    };

    nextStep(); // Move to Loading (Step 5)
    
    try {
      const generated = await generateCampaign(stateWithData, businessSettings, subscription.plan);
      setResult(generated);
      onCampaignCreated(generated); 
      onDecrementCredit(currentCost); 
      setState(prev => ({ ...prev, step: 6 })); 
      addToast("¡Visuales generados!", "success");
    } catch (e: any) {
      console.error(e);
      addToast("Error generando contenido.", "error");
      prevStep();
    }
  };

  const resetApp = () => {
    setState({
      step: 1, contentType: null, platform: null, visualStyle: null,
      productData: { baseImage: undefined, userPrompt: '', aiAnalysis: '' } 
    });
    setSelectedSceneId(null); setSelectedPromoId('none');
    setResult(null); setQrSessionId(null); setUploadMethod('desktop');
    setAnalysisComplete(false);
  };

  return (
    <div className={`max-w-2xl mx-auto pt-6 pb-32 ${state.step === 6 ? 'max-w-[1400px]' : ''}`}>
      {state.step < 6 && (
          <div className="w-full mb-10 shrink-0 relative z-40">
            <div className="h-1.5 bg-white/5 w-full rounded-full overflow-hidden border border-white/5 backdrop-blur-sm">
              <div 
                className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.6)] transition-all duration-700 ease-out"
                style={{ width: `${(state.step / 5) * 100}%` }}
              />
            </div>
            {/* Steps labels (Optional) */}
            <div className="flex justify-between text-[10px] text-slate-500 uppercase font-bold mt-2 px-1 tracking-wider">
                <span className={state.step >= 1 ? "text-indigo-400" : ""}>1. Foto</span>
                <span className={state.step >= 2 ? "text-indigo-400" : ""}>2. Objetivo</span>
                <span className={state.step >= 3 ? "text-indigo-400" : ""}>3. Red</span>
                <span className={state.step >= 4 ? "text-indigo-400" : ""}>4. Diseño</span>
            </div>
          </div>
      )}

      {/* STEP 1: UPLOAD & ANALYZE */}
      {state.step === 1 && (
        <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-white tracking-tight mb-2">Comencemos con tu producto</h2>
            <p className="text-slate-500">Sube una foto. La IA la analizará para entender qué vendes.</p>
          </div>

          <div className="bg-white/5 backdrop-blur-lg p-8 rounded-3xl border border-white/10 space-y-6 shadow-2xl relative overflow-hidden">
             
             {/* REAL Scanning Effect Overlay */}
             {isAnalyzing && (
                 <div className="absolute inset-0 z-50 bg-black/80 flex flex-col items-center justify-center backdrop-blur-sm">
                     <div className="relative w-64 h-64 border-2 border-emerald-500/50 rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(16,185,129,0.2)]">
                        <img src={state.productData.baseImage} className="w-full h-full object-cover opacity-50" />
                        <div className="absolute top-0 left-0 w-full h-1 bg-emerald-400 shadow-[0_0_20px_rgba(16,185,129,1)] animate-[scan_2s_ease-in-out_infinite]"></div>
                     </div>
                     <p className="text-emerald-400 font-mono mt-6 animate-pulse flex items-center gap-2">
                        <Loader2 size={18} className="animate-spin"/> GEMINI ANALIZANDO IMAGEN...
                     </p>
                 </div>
             )}

             <div className="flex bg-slate-900/50 p-1 rounded-xl mb-4 border border-white/5 w-fit mx-auto">
                <button onClick={() => setUploadMethod('desktop')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${uploadMethod === 'desktop' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}><Monitor size={14} /> Desktop</button>
                <button onClick={() => initMobileUpload()} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${uploadMethod === 'mobile' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}><Smartphone size={14} /> Celular / QR</button>
              </div>

              {uploadMethod === 'desktop' && (
                  <div className="relative group animate-in fade-in duration-300">
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" id="file-upload"/>
                    <label htmlFor="file-upload" className="flex items-center justify-center w-full p-10 border-2 border-dashed border-white/10 rounded-2xl bg-slate-900/30 cursor-pointer hover:bg-slate-800/50 hover:border-indigo-500/50 transition-all min-h-[300px]">
                      {state.productData.baseImage ? (
                        <div className="relative w-full h-64 overflow-hidden rounded-xl shadow-2xl border border-white/10">
                            <img src={state.productData.baseImage} alt="Preview" className="w-full h-full object-contain bg-black/50" />
                            {analysisComplete && state.productData.aiAnalysis && (
                                <div className="absolute bottom-4 left-4 right-4 bg-black/80 backdrop-blur-md text-white p-3 rounded-xl text-xs border border-white/20 animate-in slide-in-from-bottom-2">
                                    <div className="flex items-center gap-2 text-emerald-400 font-bold mb-1">
                                        <CheckCircle size={12} /> Detección Completada:
                                    </div>
                                    <p className="opacity-80 line-clamp-2">{state.productData.aiAnalysis}</p>
                                </div>
                            )}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center text-slate-500 group-hover:text-indigo-400 transition-colors">
                           <div className="bg-white/5 p-6 rounded-full mb-4 group-hover:bg-indigo-500/20 transition-colors shadow-inner"><Upload size={40} /></div>
                           <span className="text-lg font-semibold text-white">Haz clic para subir</span>
                           <span className="text-sm text-slate-500 mt-2">JPG o PNG (Max 15MB)</span>
                        </div>
                      )}
                    </label>
                  </div>
              )}

              {uploadMethod === 'mobile' && (
                  <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-6 flex flex-col items-center text-center animate-in zoom-in-95 duration-300 min-h-[300px] justify-center">
                     {state.productData.baseImage ? (
                         <div className="w-full"><div className="flex items-center justify-center gap-2 text-emerald-400 mb-4 bg-emerald-500/10 py-2 rounded-lg"><CheckCircle size={16} /> <span className="text-sm font-bold">¡Imagen recibida!</span></div><div className="relative w-full h-48 overflow-hidden rounded-xl border border-white/10"><img src={state.productData.baseImage} className="w-full h-full object-contain bg-black/50" /></div></div>
                     ) : (
                        <>{qrSessionId ? (<><div className="bg-white p-4 rounded-xl mb-4 shadow-[0_0_30px_rgba(255,255,255,0.1)]"><QRCode value={`${window.location.origin}/?mobile_upload=${qrSessionId}`} size={160} /></div><h4 className="text-white font-bold mb-1 flex items-center gap-2"><Smartphone size={16} className="text-indigo-400" /> Escanea con tu celular</h4></>) : (<div className="py-10"><div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto"></div></div>)}</>
                     )}
                  </div>
              )}
          </div>
        </div>
      )}

      {/* STEP 2: Content Type */}
      {state.step === 2 && (
        <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
          <div className="mb-8"><h2 className="text-3xl font-bold text-white tracking-tight mb-2">¿Cuál es el objetivo?</h2><p className="text-slate-500">La IA adaptará la composición al tipo de mensaje.</p></div>
          <div className="grid grid-cols-2 gap-4">{CONTENT_OPTIONS.map((opt) => (<SelectionCard key={opt.id} title={opt.label} description={opt.desc} icon={opt.icon} selected={state.contentType === opt.id} onClick={() => setState(prev => ({ ...prev, contentType: opt.id as ContentType }))}/>))}</div>
        </div>
      )}

      {/* STEP 3: Platform */}
      {state.step === 3 && (
        <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
          <div className="mb-8"><h2 className="text-3xl font-bold text-white tracking-tight mb-2">¿Dónde se publicará?</h2><p className="text-slate-500">Optimizaremos dimensiones y distribución.</p></div>
          <div className="space-y-3">{PLATFORM_OPTIONS.map((opt) => (<div key={opt.id} onClick={() => setState(prev => ({ ...prev, platform: opt.id as Platform }))} className={`group flex items-center p-5 rounded-2xl border cursor-pointer transition-all duration-300 ${state.platform === opt.id ? 'border-indigo-500/50 bg-indigo-500/10 shadow-[0_0_20px_-5px_rgba(99,102,241,0.25)]' : 'border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/10'}`}><div className={`p-3 rounded-xl mr-5 transition-colors ${state.platform === opt.id ? 'bg-indigo-500 text-white' : 'bg-white/5 text-slate-400 group-hover:text-white'}`}><opt.icon size={24} /></div><div className="flex-1"><h3 className={`font-semibold text-base ${state.platform === opt.id ? 'text-white' : 'text-slate-300 group-hover:text-white'}`}>{opt.label}</h3><p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p></div>{state.platform === opt.id && <CheckCircle className="text-indigo-400 drop-shadow-[0_0_5px_rgba(129,140,248,0.5)]" size={24} />}</div>))}</div>
        </div>
      )}

      {/* STEP 4: DESIGN & MAGIC (Combined) */}
      {state.step === 4 && (
        <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-white tracking-tight mb-2">Diseño Mágico</h2>
            <p className="text-slate-500">Combina estilo, escenario y marketing.</p>
          </div>

          <div className="bg-white/5 backdrop-blur-lg p-6 rounded-3xl border border-white/10 shadow-2xl space-y-8">
             
             {/* 4.1 STYLE */}
             <div>
                <label className="block text-xs font-bold text-indigo-400 mb-4 uppercase tracking-wide flex items-center gap-2">
                    <Filter size={14} /> 1. Vibe General
                </label>
                <div className="flex gap-3 overflow-x-auto pb-4 hide-scrollbar">
                    {STYLE_OPTIONS.map((opt) => (
                        <button 
                            key={opt.id}
                            onClick={() => setState(prev => ({ ...prev, visualStyle: opt.id as VisualStyle }))}
                            className={`
                                flex-shrink-0 px-4 py-3 rounded-xl border flex items-center gap-2 transition-all
                                ${state.visualStyle === opt.id ? opt.color + ' border-current shadow-lg' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}
                            `}
                        >
                            <opt.icon size={16} />
                            <span className="text-sm font-bold">{opt.label}</span>
                        </button>
                    ))}
                </div>
             </div>

             {/* 4.2 SCENE (Filtered) */}
             <div className="border-t border-white/5 pt-6">
                <label className="block text-xs font-bold text-emerald-400 mb-4 uppercase tracking-wide flex items-center gap-2">
                    <Wand2 size={14} /> 2. Escenario Inteligente {state.visualStyle && <span className="text-slate-500 ml-2 normal-case font-normal">(Filtrado por: {state.visualStyle})</span>}
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                   {finalScenes.map((scene) => (
                      <div 
                        key={scene.id}
                        onClick={() => setSelectedSceneId(scene.id)}
                        className={`cursor-pointer rounded-xl border p-4 transition-all flex flex-col items-center text-center gap-2 relative overflow-hidden group min-h-[110px] justify-center
                            ${selectedSceneId === scene.id 
                                ? 'border-emerald-500/50 bg-emerald-500/10 shadow-[0_0_20px_-5px_rgba(16,185,129,0.3)]' 
                                : 'border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/10'}
                        `}
                      >
                         <div className={`p-2 rounded-full ${selectedSceneId === scene.id ? 'bg-emerald-500 text-white' : 'bg-white/5 text-slate-400'}`}>
                             <scene.icon size={18} />
                         </div>
                         <span className={`text-xs font-bold ${selectedSceneId === scene.id ? 'text-white' : 'text-slate-300'}`}>{scene.label}</span>
                         {selectedSceneId === scene.id && <div className="absolute top-2 right-2 text-emerald-400"><CheckCircle size={14}/></div>}
                      </div>
                   ))}
                </div>
             </div>

             {/* 4.3 PROMO BADGE */}
             <div className="border-t border-white/5 pt-6">
                <label className="block text-xs font-bold text-rose-400 mb-4 uppercase tracking-wide flex items-center gap-2">
                    <Tag size={14} /> 3. Etiqueta de Venta
                </label>
                <div className="flex flex-wrap gap-2">
                    {PROMO_BADGES.map((badge) => (
                        <button
                            key={badge.id}
                            onClick={() => setSelectedPromoId(badge.id)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-[10px] font-bold transition-all uppercase tracking-wide
                                ${selectedPromoId === badge.id 
                                    ? 'bg-rose-500 text-white border-rose-500 shadow-lg shadow-rose-500/20' 
                                    : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'}
                            `}
                        >
                            {badge.label}
                        </button>
                    ))}
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
            <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">Renderizando Magia...</h2>
            <p className="text-slate-500 text-lg font-light">
              Escenario: {SCENE_PRESETS.find(s=>s.id===selectedSceneId)?.label} <br/>
              Modo: {state.contentType}
            </p>
          </div>
        </div>
      )}

      {/* STEP 6: RESULTADOS (Modified - No copy section) */}
      {state.step === 6 && result && (
        <div className="space-y-12 pb-20 animate-in slide-in-from-bottom-8 duration-500">
          
          {/* SECTION A: IMAGES */}
          <div>
             <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">Tus Visuales</h2>
                <p className="text-slate-400">Transformación completa realizada.</p>
             </div>
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {result.variants.map((variant) => (
                <VariantCard 
                    key={variant.id} 
                    variant={variant} 
                    onView={onViewImage} 
                    showWatermark={subscription.plan === 'free'}
                    platform={state.platform!}
                />
                ))}
            </div>
          </div>
        </div>
      )}

      {/* FOOTER NAV */}
      {state.step < 5 && (
        <footer className="absolute bottom-0 left-0 right-0 bg-[#020617]/90 backdrop-blur-xl border-t border-white/5 p-6 z-50 animate-in slide-in-from-bottom-4">
          <div className="max-w-2xl mx-auto flex gap-4">
             {state.step > 1 && (
                <button onClick={prevStep} className="px-6 py-4 rounded-xl font-bold text-slate-400 bg-white/5 border border-white/5 hover:bg-white/10 hover:text-white transition-all">
                <ChevronLeft size={24} />
                </button>
             )}
            
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
                    (state.step === 1 && !state.productData.baseImage) || // Step 1: Needs image
                    (state.step === 1 && isAnalyzing) || // Wait for analysis
                    (state.step === 2 && !state.contentType) ||          // Step 2: Needs Type
                    (state.step === 3 && !state.platform) ||             // Step 3: Needs Platform
                    (state.step === 4 && (!state.visualStyle || !selectedSceneId)) // Step 4: Needs Style & Scene
                }
                className={`
                    flex-1 rounded-xl font-bold text-white text-lg shadow-lg flex items-center justify-center gap-2 transition-all relative overflow-hidden
                    ${
                        ((state.step === 1 && !state.productData.baseImage) || 
                         (state.step === 1 && isAnalyzing) ||
                        (state.step === 2 && !state.contentType) || 
                        (state.step === 3 && !state.platform) || 
                        (state.step === 4 && (!state.visualStyle || !selectedSceneId)))
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5' 
                    : 'bg-indigo-600 hover:bg-indigo-500 shadow-[0_0_25px_rgba(79,70,229,0.3)] hover:scale-[1.01]'}
                `}
                >
                {state.step === 4 ? (
                    <span className="flex items-center gap-2">
                        Generar Magia <span className="text-xs bg-black/20 px-2 py-0.5 rounded-full flex items-center gap-1 border border-white/10"><Zap size={10} fill="currentColor"/> -{currentCost}</span>
                    </span>
                ) : (isAnalyzing ? 'Analizando...' : 'Continuar')}
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
