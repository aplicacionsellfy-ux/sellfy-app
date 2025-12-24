
import React, { useState } from 'react';
import { Camera, ChevronRight, ChevronLeft, Upload, Sparkles, RefreshCw, CheckCircle, Lock, Zap } from 'lucide-react';
import { CONTENT_OPTIONS, PLATFORM_OPTIONS, STYLE_OPTIONS, CREDIT_COSTS } from '../../constants';
import { WizardState, ContentType, Platform, VisualStyle, CampaignResult, BusinessSettings, UserSubscription } from '../../types';
import { generateCampaign } from '../../services/geminiService';
import { SelectionCard, VariantCard } from '../Shared';
import { useToast } from '../ui/Toast';

interface WizardViewProps {
  businessSettings: BusinessSettings;
  onCampaignCreated: (campaign: CampaignResult) => void;
  onViewImage: (img: string) => void;
  apiKeyMissing: boolean;
  subscription: UserSubscription;
  onDecrementCredit: (amount: number) => void;
}

export const WizardView: React.FC<WizardViewProps> = ({ 
  businessSettings, 
  onCampaignCreated, 
  onViewImage, 
  apiKeyMissing,
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
      description: '', // Init description
      benefit: '',
      targetAudience: '',
      price: '',
      promoDetails: '',
    }
  });

  const [result, setResult] = useState<CampaignResult | null>(null);

  const isVideo = 
    state.contentType === ContentType.VIDEO_REEL || 
    state.platform === Platform.TIKTOK || 
    state.platform === Platform.IG_REELS;

  const currentCost = isVideo ? CREDIT_COSTS.VIDEO : CREDIT_COSTS.IMAGE;

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
      if (file.size > 4 * 1024 * 1024) {
        addToast("La imagen debe pesar menos de 4MB", "error");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        updateProductData('baseImage', reader.result as string);
        addToast("Imagen cargada. Nuestra IA mantendrá la fidelidad de tu producto.", "success");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (apiKeyMissing) {
        addToast("Error: Configuración de API incompleta", "error");
        return;
    }

    if (subscription.credits < currentCost) {
        addToast(`Necesitas ${currentCost} créditos. Tienes ${subscription.credits}.`, "error");
        return;
    }

    nextStep(); 
    
    try {
      const generated = await generateCampaign(state, businessSettings, subscription.plan);
      setResult(generated);
      onCampaignCreated(generated); 
      onDecrementCredit(currentCost); 
      setState(prev => ({ ...prev, step: 6 })); 
      addToast("¡Contenido generado!", "success");
    } catch (e) {
      console.error(e);
      addToast("Error generando contenido. Intenta de nuevo.", "error");
      prevStep();
    }
  };

  const resetApp = () => {
    setState({
      step: 1,
      contentType: null,
      platform: null,
      visualStyle: null,
      productData: { ...state.productData } 
    });
    setResult(null);
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
          
          {apiKeyMissing ? (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-sm mb-4 backdrop-blur-sm">
              Error crítico: Falta la API KEY en el entorno.
            </div>
          ) : (
             <div className="space-y-4 w-full">
                <button 
                  onClick={nextStep}
                  className="group w-full relative bg-indigo-600 hover:bg-indigo-500 text-white text-lg font-semibold py-4 px-8 rounded-2xl shadow-[0_0_20px_rgba(79,70,229,0.4)] transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2 overflow-hidden"
                >
                  <span className="relative z-10 flex items-center gap-2">Comenzar Ahora <ChevronRight size={20} /></span>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                </button>
             </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`max-w-2xl mx-auto pt-6 pb-32 ${state.step === 6 ? 'max-w-[1400px]' : ''}`}>
      {/* Progress Bar */}
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
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-white tracking-tight mb-2">¿Qué vamos a crear?</h2>
            <p className="text-slate-500">Selecciona el tipo de contenido para hoy</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {CONTENT_OPTIONS.map((opt) => (
              <SelectionCard
                key={opt.id}
                title={opt.label}
                description={opt.desc}
                icon={opt.icon}
                selected={state.contentType === opt.id}
                onClick={() => setState(prev => ({ ...prev, contentType: opt.id as ContentType }))}
              />
            ))}
          </div>
        </div>
      )}

      {/* STEP 2: Platform */}
      {state.step === 2 && (
        <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-white tracking-tight mb-2">¿Dónde publicarás?</h2>
            <p className="text-slate-500">Optimizaremos la relación de aspecto</p>
          </div>
          <div className="space-y-3">
            {PLATFORM_OPTIONS.map((opt) => (
              <div 
                key={opt.id}
                onClick={() => setState(prev => ({ ...prev, platform: opt.id as Platform }))}
                className={`
                  group flex items-center p-5 rounded-2xl border cursor-pointer transition-all duration-300
                  ${state.platform === opt.id 
                    ? 'border-indigo-500/50 bg-indigo-500/10 shadow-[0_0_20px_-5px_rgba(99,102,241,0.25)]' 
                    : 'border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/10'}
                `}
              >
                <div className={`p-3 rounded-xl mr-5 transition-colors ${state.platform === opt.id ? 'bg-indigo-500 text-white' : 'bg-white/5 text-slate-400 group-hover:text-white'}`}>
                  <opt.icon size={24} />
                </div>
                <div className="flex-1">
                  <h3 className={`font-semibold text-base ${state.platform === opt.id ? 'text-white' : 'text-slate-300 group-hover:text-white'}`}>{opt.label}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p>
                </div>
                {state.platform === opt.id && <CheckCircle className="text-indigo-400 drop-shadow-[0_0_5px_rgba(129,140,248,0.5)]" size={24} />}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STEP 3: Visual Style */}
      {state.step === 3 && (
        <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-white tracking-tight mb-2">Elige el estilo visual</h2>
            <p className="text-slate-500">Define la personalidad de la imagen</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {STYLE_OPTIONS.map((opt) => (
              <SelectionCard
                key={opt.id}
                title={opt.label}
                icon={opt.icon}
                selected={state.visualStyle === opt.id}
                onClick={() => setState(prev => ({ ...prev, visualStyle: opt.id as VisualStyle }))}
                extraClass={opt.color}
              />
            ))}
          </div>
        </div>
      )}

      {/* STEP 4: Product Data */}
      {state.step === 4 && (
        <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-white tracking-tight mb-2">Detalles del Producto</h2>
            <p className="text-slate-500">Nuestra IA de Visión analizará esto para máxima fidelidad</p>
          </div>

          <div className="bg-white/5 backdrop-blur-lg p-8 rounded-3xl border border-white/10 space-y-6 shadow-2xl">
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wide">Nombre del Producto</label>
              <input 
                type="text" 
                className="w-full p-4 bg-slate-900/50 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent outline-none transition-all"
                placeholder="Ej: Zapatillas Runner X"
                value={state.productData.name}
                onChange={(e) => updateProductData('name', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wide">Descripción del Producto (Contexto)</label>
              <textarea 
                className="w-full p-4 bg-slate-900/50 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent outline-none transition-all h-20 resize-none"
                placeholder="Ej: Bote de creatina negra con letras doradas, textura mate. Ambiente de gimnasio oscuro."
                value={state.productData.description}
                onChange={(e) => updateProductData('description', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wide">Beneficio Principal</label>
              <textarea 
                className="w-full p-4 bg-slate-900/50 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent outline-none transition-all h-24 resize-none"
                placeholder="Ej: Súper ligeras y transpirables para correr más rápido."
                value={state.productData.benefit}
                onChange={(e) => updateProductData('benefit', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wide">Público Objetivo (Opcional)</label>
              <input 
                type="text" 
                className="w-full p-4 bg-slate-900/50 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent outline-none transition-all"
                placeholder={businessSettings.targetAudience ? `Predeterminado: ${businessSettings.targetAudience}` : "Ej: Hombres jóvenes deportistas"}
                value={state.productData.targetAudience}
                onChange={(e) => updateProductData('targetAudience', e.target.value)}
              />
            </div>

            <div className="pt-2">
              <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wide">Foto de referencia (Muy Recomendado)</label>
              <div className="relative group">
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden" 
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="flex items-center justify-center w-full p-8 border border-dashed border-white/10 rounded-2xl bg-slate-900/30 cursor-pointer hover:bg-slate-800/50 hover:border-indigo-500/30 transition-all">
                  {state.productData.baseImage ? (
                    <div className="relative w-full h-40 overflow-hidden rounded-xl shadow-lg">
                      <img src={state.productData.baseImage} alt="Preview" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-white text-xs font-medium bg-black/50 px-3 py-1 rounded-full border border-white/20">Cambiar imagen</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-slate-500 group-hover:text-indigo-400 transition-colors">
                      <div className="bg-white/5 p-4 rounded-full mb-3 group-hover:bg-indigo-500/20 transition-colors">
                        <Upload size={24} />
                      </div>
                      <span className="text-sm font-medium">Subir foto real</span>
                      <p className="text-[9px] text-slate-500 mt-2 text-center max-w-[200px]">
                         La IA usará esta foto para mantener tu producto idéntico.
                      </p>
                    </div>
                  )}
                </label>
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

      {/* STEP 6: Results */}
      {state.step === 6 && result && (
        <div className="space-y-8 pb-20 animate-in slide-in-from-bottom-8 duration-500">
          <div className="text-center mb-8">
             <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">¡Campaña Lista!</h2>
             <p className="text-slate-400">Generado con IA de última generación para {state.platform}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {result.variants.map((variant) => (
              <VariantCard 
                key={variant.id} 
                variant={variant} 
                onView={onViewImage} 
                showWatermark={subscription.plan === 'free'} 
              />
            ))}
          </div>
        </div>
      )}

      {/* Footer Nav */}
      {state.step > 0 && state.step < 5 && (
        <footer className="absolute bottom-0 left-0 right-0 bg-[#020617]/90 backdrop-blur-xl border-t border-white/5 p-6 z-50 animate-in slide-in-from-bottom-4">
          <div className="max-w-2xl mx-auto flex gap-4">
            <button 
              onClick={prevStep}
              className="px-6 py-4 rounded-xl font-bold text-slate-400 bg-white/5 border border-white/5 hover:bg-white/10 hover:text-white transition-all"
            >
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
                    (state.step === 4 && (!state.productData.name || !state.productData.description))
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
            <button 
              onClick={resetApp}
              className="group flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-white hover:bg-white/5 px-4 py-2 rounded-full border border-transparent hover:border-white/10 transition-all duration-300"
            >
              <RefreshCw size={14} className="group-hover:rotate-180 transition-transform duration-500" /> 
              <span>Crear Nuevo</span>
            </button>
          </div>
        </footer>
      )}
    </div>
  );
};
