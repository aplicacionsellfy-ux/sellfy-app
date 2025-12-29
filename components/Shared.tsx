
import React, { useState, useEffect } from 'react';
import { Download, Maximize2, Copy, X, CheckCircle, Video as VideoIcon, Loader2, Layers, Sparkles, PenTool, FileText, Image as ImageIcon } from 'lucide-react';
import { ContentVariant, PlanDetails, CopyFramework, Platform } from '../types';
import { COPY_FRAMEWORKS } from '../constants';
import { useToast } from './ui/Toast';
import { animateImageWithVeo, generateStrategicCopy } from '../services/geminiService';

// --- NEW COMPONENT: COPYWRITER MODAL ---
interface CopyModalProps {
    isOpen: boolean;
    onClose: () => void;
    image: string;
    initialContext: string; 
    platform: Platform;
}

export const CopyGeneratorModal: React.FC<CopyModalProps> = ({ isOpen, onClose, image, initialContext, platform }) => {
    const { addToast } = useToast();
    const [framework, setFramework] = useState<CopyFramework>(CopyFramework.AIDA);
    const [tone, setTone] = useState('Profesional');
    const [generatedText, setGeneratedText] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    if (!isOpen) return null;

    const handleGenerate = async () => {
        setIsLoading(true);
        try {
            const text = await generateStrategicCopy(image, initialContext, framework, tone, platform);
            setGeneratedText(text);
        } catch (e) {
            console.error(e);
            addToast("Error generando texto", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(generatedText);
        addToast("Copiado al portapapeles", "success");
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-[#0B0F19] border border-white/10 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                <div className="p-4 border-b border-white/5 flex justify-between items-center bg-[#020617]">
                    <h3 className="text-white font-bold flex items-center gap-2">
                        <PenTool size={18} className="text-indigo-400"/> IA Copywriter
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20}/></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 flex flex-col md:flex-row gap-6">
                    <div className="w-full md:w-1/3 space-y-6 flex flex-col">
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">1. Estructura</label>
                            <div className="space-y-2">
                                {COPY_FRAMEWORKS.map(fw => (
                                    <button 
                                        key={fw.id}
                                        onClick={() => setFramework(fw.id)}
                                        className={`w-full text-left p-3 rounded-xl border text-xs transition-all ${framework === fw.id ? 'bg-indigo-500/20 border-indigo-500 text-white' : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'}`}
                                    >
                                        <div className="font-bold mb-0.5">{fw.label}</div>
                                        <div className="text-[10px] opacity-70 leading-tight">{fw.title}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">2. Tono</label>
                            <select value={tone} onChange={(e) => setTone(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-sm text-white outline-none focus:border-indigo-500">
                                <option value="Profesional">Profesional</option>
                                <option value="Divertido">Divertido / Informal</option>
                                <option value="Urgente">Urgente (Ventas)</option>
                                <option value="Storytelling">Storytelling</option>
                                <option value="Lujo">Lujo / Exclusivo</option>
                            </select>
                        </div>
                        <div className="mt-auto">
                            <button onClick={handleGenerate} disabled={isLoading} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 disabled:opacity-50 transition-all">
                                {isLoading ? <Loader2 className="animate-spin" size={16}/> : <Sparkles size={16}/>}
                                {isLoading ? 'Escribiendo...' : 'Generar Copy'}
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 flex flex-col bg-black/20 rounded-xl border border-white/5 min-h-[300px]">
                        <div className="p-3 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Resultado IA</span>
                            {generatedText && (<button onClick={handleCopy} className="text-xs flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-bold"><Copy size={12}/> Copiar</button>)}
                        </div>
                        <div className="flex-1 p-4 overflow-y-auto custom-scrollbar">
                            {isLoading ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-3"><Loader2 className="animate-spin text-indigo-400" size={32}/><span className="text-xs animate-pulse">Redactando con Gemini...</span></div>
                            ) : generatedText ? (
                                <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed animate-in fade-in">{generatedText}</p>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-slate-600"><div className="p-4 bg-white/5 rounded-full mb-3"><PenTool size={24} className="opacity-50"/></div><p className="text-sm font-medium">Listo para escribir.</p></div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Full Screen Image/Video Modal
export const FullScreenModal: React.FC<{ 
  image: string | null; 
  onClose: () => void; 
}> = ({ image, onClose }) => {
  if (!image) return null;
  const isVideo = image.endsWith('.mp4') || image.includes('video') || image.includes('googlevideo');
  return (
    <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-300" onClick={onClose}>
       <button onClick={onClose} className="absolute top-6 right-6 text-white/50 hover:text-white transition-colors bg-white/10 rounded-full p-2 z-50"><X size={24} /></button>
       {isVideo ? (
         <video src={image} controls autoPlay loop className="max-w-full max-h-[90vh] rounded-xl shadow-2xl border border-white/10 object-contain" onClick={(e) => e.stopPropagation()}/>
       ) : (
         <img src={image} alt="Full Screen" className="max-w-full max-h-[90vh] rounded-xl shadow-2xl border border-white/10 object-contain" onClick={(e) => e.stopPropagation()} />
       )}
    </div>
  );
};

// Payment Modal (Simplified to fix build errors, functionality retained)
export const PaymentModal: React.FC<{ isOpen: boolean; onClose: () => void; plan: PlanDetails | null; onConfirm: () => Promise<void>; }> = ({ isOpen, onClose, plan, onConfirm }) => {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'method' | 'form' | 'processing' | 'success'>('method');
  
  useEffect(() => { if (isOpen) { setStep('method'); setLoading(false); } }, [isOpen]);
  if (!isOpen || !plan) return null;
  
  const handleProcess = async () => { setLoading(true); setStep('processing'); setTimeout(async () => { await onConfirm(); setStep('success'); setLoading(false); setTimeout(onClose, 2000); }, 2000); };
  
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-[#0B0F19] border border-white/10 rounded-2xl w-full max-w-md p-6">
          <h2 className="text-xl font-bold text-white mb-4">Confirmar {plan.name}</h2>
          {step === 'success' ? <div className="text-center text-emerald-400 py-8 font-bold text-lg">¡Pago Exitoso!</div> : 
           step === 'processing' ? <div className="text-center py-8"><Loader2 className="animate-spin mx-auto text-indigo-500"/></div> :
           <button onClick={handleProcess} disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl">{loading ? '...' : `Pagar ${plan.price}`}</button>
          }
      </div>
    </div>
  );
};

// Selection Card
interface SelectionCardProps { selected: boolean; onClick: () => void; title: string; description?: string; icon: React.ElementType; extraClass?: string; }
export const SelectionCard: React.FC<SelectionCardProps> = ({ selected, onClick, title, description, icon: Icon, extraClass }) => (
  <div onClick={onClick} className={`cursor-pointer rounded-xl border p-5 transition-all duration-300 flex flex-col items-center text-center gap-3 relative overflow-hidden group ${selected ? 'border-indigo-500/50 bg-indigo-500/10 shadow-[0_0_25px_-5px_rgba(99,102,241,0.25)]' : 'border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/10'} ${extraClass || ''}`}>
    {selected && <div className="absolute inset-0 bg-indigo-500/5 pointer-events-none" />}
    <div className={`p-3.5 rounded-full transition-colors ${selected ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/40' : 'bg-white/5 text-slate-400 group-hover:text-white'}`}><Icon size={24} /></div>
    <div className="relative z-10"><h3 className={`font-semibold text-sm ${selected ? 'text-white' : 'text-slate-200'}`}>{title}</h3>{description && <p className="text-[11px] text-slate-500 mt-1.5 leading-snug">{description}</p>}</div>
    {selected && <div className="absolute top-3 right-3 text-indigo-400 animate-in zoom-in duration-200"><CheckCircle size={16} fill="currentColor" className="text-white/10" /></div>}
  </div>
);

// Variant Card Component (Improved Image Handling)
export const VariantCard: React.FC<{ 
  variant: ContentVariant; 
  onView: (img: string) => void;
  showWatermark?: boolean;
  platform?: Platform; 
}> = ({ variant, onView, showWatermark = false, platform = Platform.IG_FEED }) => {
  const { addToast } = useToast();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  // Animation & Prompt State
  const [localVideoUrl, setLocalVideoUrl] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);

  const activeMediaUrl = localVideoUrl || variant.image;
  const isVideo = activeMediaUrl?.endsWith('.mp4') || activeMediaUrl?.includes('video') || variant.isVideo || !!localVideoUrl;

  const handleAnimate = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isAnimating) return;
      if (isVideo) { addToast("Esto ya es un video.", "info"); return; }
      
      setIsAnimating(true);
      addToast("Creando video (esto tomará ~1 minuto)...", "info");

      try {
          const videoUrl = await animateImageWithVeo(variant.image);
          if (videoUrl) {
              setLocalVideoUrl(videoUrl);
              addToast("¡Video generado!", "success");
          } else {
              addToast("No se pudo generar video.", "error");
          }
      } catch {
          addToast("Error de conexión.", "error");
      } finally {
          setIsAnimating(false);
      }
  };

  const handleDownload = (e: React.MouseEvent) => {
      e.stopPropagation();
      const link = document.createElement('a');
      link.href = activeMediaUrl;
      link.download = `sellfy-${variant.id}.${isVideo ? 'mp4' : 'png'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      addToast("Descargando...", "success");
  };

  return (
    <>
    <CopyGeneratorModal 
        isOpen={isCopyModalOpen} 
        onClose={() => setIsCopyModalOpen(false)}
        image={variant.image}
        initialContext="Producto"
        platform={platform}
    />

    <div className="group relative flex flex-col bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden hover:border-indigo-500/40 hover:shadow-[0_15px_40px_-10px_rgba(79,70,229,0.2)] hover:-translate-y-1 transition-all duration-500 ease-out">
      
      {/* Media Area */}
      <div className="relative aspect-[4/5] bg-black/40 overflow-hidden cursor-pointer" onClick={() => onView(activeMediaUrl)}>
        {isVideo ? (
            <video src={activeMediaUrl} className="w-full h-full object-cover" loop muted autoPlay playsInline />
        ) : (
            <>
                {/* Image Loader */}
                {!imageLoaded && !imageError && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
                        <Loader2 className="text-indigo-500 animate-spin" />
                    </div>
                )}
                
                {/* Error Fallback */}
                {imageError && (
                     <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 text-slate-500 p-4 text-center">
                        <ImageIcon size={32} className="mb-2 opacity-50"/>
                        <span className="text-xs">No se pudo cargar la imagen</span>
                    </div>
                )}

                <img 
                    src={variant.image} 
                    alt="Generated Content" 
                    className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                    onLoad={() => setImageLoaded(true)}
                    onError={() => { setImageError(true); setImageLoaded(true); }}
                />
            </>
        )}
        
        {isAnimating && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-30 flex flex-col items-center justify-center animate-in fade-in">
                <Loader2 className="animate-spin text-indigo-400 mb-2" size={32} />
                <span className="text-xs text-white font-bold animate-pulse">Generando Video...</span>
            </div>
        )}

        {showPrompt && (
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md z-40 p-4 overflow-y-auto animate-in fade-in flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-2">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Prompt Usado</h4>
                    <button onClick={() => setShowPrompt(false)} className="text-white/50 hover:text-white"><X size={16}/></button>
                </div>
                <p className="text-[10px] text-indigo-300 font-mono leading-relaxed whitespace-pre-wrap flex-1">
                    {variant.debugPrompt || "Prompt no disponible."}
                </p>
            </div>
        )}

        {showWatermark && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-30 z-10">
                <div className="text-white text-2xl font-bold uppercase tracking-widest border-4 border-white px-4 py-1 rotate-[-25deg]">SELLFY FREE</div>
            </div>
        )}
        
        <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 z-20">
           {!isVideo && !isAnimating && (
               <button onClick={handleAnimate} className="p-2 rounded-full bg-indigo-600/80 text-white hover:bg-indigo-500 backdrop-blur-md border border-white/10 transition-colors shadow-lg" title="Animar"><VideoIcon size={16} /></button>
           )}
           <button onClick={(e) => { e.stopPropagation(); onView(activeMediaUrl); }} className="p-2 rounded-full bg-black/60 text-white hover:bg-indigo-500 backdrop-blur-md border border-white/10"><Maximize2 size={16} /></button>
           <button onClick={handleDownload} className="p-2 rounded-full bg-black/60 text-white hover:bg-emerald-500 backdrop-blur-md border border-white/10"><Download size={16} /></button>
        </div>
      </div>

      <div className="flex-1 p-5 flex flex-col border-t border-white/5 bg-gradient-to-b from-white/[0.02] to-transparent">
        <div className="flex items-center gap-2 mb-3 justify-between">
            <div className="flex items-center gap-2">
                <div className="p-1 rounded-md bg-white/5 border border-white/5"><Layers size={12} className="text-indigo-400" /></div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{variant.angle.split(',')[0]}</span>
            </div>
            <button onClick={(e) => { e.stopPropagation(); setShowPrompt(!showPrompt); }} className="text-slate-500 hover:text-indigo-400 transition-colors" title="Ver Prompt"><FileText size={14} /></button>
        </div>
        <button onClick={(e) => { e.stopPropagation(); setIsCopyModalOpen(true); }} className="w-full py-3 mb-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-bold uppercase tracking-wide border border-white/5 hover:border-indigo-500/30 transition-all flex items-center justify-center gap-2 group/btn">
            <PenTool size={14} className="text-indigo-400 group-hover/btn:scale-110 transition-transform"/> Generar Copy
        </button>
      </div>
    </div>
    </>
  );
};
