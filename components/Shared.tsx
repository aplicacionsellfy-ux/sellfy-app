import React, { useState, useEffect } from 'react';
import { Download, Maximize2, Copy, X, CheckCircle, Share2, Send, CreditCard, Lock, Calendar, User, ShieldCheck, Loader2 } from 'lucide-react';
import { ContentVariant, PlanDetails } from '../types';
import { useToast } from './ui/Toast';

// Full Screen Image Modal
export const FullScreenModal: React.FC<{ 
  image: string | null; 
  onClose: () => void; 
}> = ({ image, onClose }) => {
  if (!image) return null;
  return (
    <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-300" onClick={onClose}>
       <button onClick={onClose} className="absolute top-6 right-6 text-white/50 hover:text-white transition-colors bg-white/10 rounded-full p-2">
         <X size={24} />
       </button>
       <img 
        src={image} 
        alt="Full Screen" 
        className="max-w-full max-h-[90vh] rounded-xl shadow-2xl border border-white/10 object-contain animate-in zoom-in-95 duration-300" 
        onClick={(e) => e.stopPropagation()} 
       />
    </div>
  );
};

// Payment Modal Component
export const PaymentModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  plan: PlanDetails | null;
  onConfirm: () => Promise<void>;
}> = ({ isOpen, onClose, plan, onConfirm }) => {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'form' | 'processing' | 'success'>('form');
  
  // Form State
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [name, setName] = useState('');

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setStep('form');
      setLoading(false);
      setCardNumber('');
      setExpiry('');
      setCvc('');
      setName('');
    }
  }, [isOpen]);

  if (!isOpen || !plan) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStep('processing');

    // Simular proceso de pago seguro (2.5 segundos)
    setTimeout(async () => {
      await onConfirm();
      setStep('success');
      setLoading(false);
      
      // Cerrar modal despues de exito
      setTimeout(() => {
        onClose();
      }, 2000);
    }, 2500);
  };

  // Format Card Number
  const handleCardChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = matches && matches[0] || '';
    const parts = [];
    for (let i=0, len=match.length; i<len; i+=4) {
      parts.push(match.substring(i, i+4));
    }
    if (parts.length) {
      setCardNumber(parts.join(' '));
    } else {
      setCardNumber(v);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-[#020617]/80 backdrop-blur-md transition-opacity" onClick={onClose}></div>

      {/* Modal Content */}
      <div className="relative w-full max-w-md bg-[#0B0F19] border border-white/10 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        
        {/* Header with Gradient */}
        <div className="relative p-6 pb-8 bg-gradient-to-br from-indigo-900/50 to-[#0B0F19] border-b border-white/5">
          <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
          
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-indigo-500 rounded-lg text-white shadow-lg shadow-indigo-500/30">
              <CreditCard size={20} />
            </div>
            <span className="text-xs font-bold text-indigo-300 uppercase tracking-widest">Pasarela Segura</span>
          </div>
          <h2 className="text-2xl font-bold text-white">Suscribirse al Plan {plan.name}</h2>
          <p className="text-slate-400 mt-1 flex items-baseline gap-1">
            Total a pagar: <span className="text-white font-bold text-lg">{plan.price}</span> <span className="text-xs">/mes</span>
          </p>
        </div>

        {/* Body */}
        <div className="p-6">
          {step === 'form' && (
            <form onSubmit={handleSubmit} className="space-y-5">
              
              {/* Card Input */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-1">Número de Tarjeta</label>
                <div className="relative group">
                  <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={18} />
                  <input 
                    type="text" 
                    required
                    maxLength={19}
                    placeholder="0000 0000 0000 0000"
                    value={cardNumber}
                    onChange={handleCardChange}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder-slate-600 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all font-mono"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex gap-2 opacity-50 grayscale">
                     <div className="w-8 h-5 bg-white/10 rounded"></div> {/* Simula logo Visa/Mastercard */}
                  </div>
                </div>
              </div>

              {/* Grid for Date/CVC */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-1">Expiración</label>
                  <div className="relative group">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={18} />
                    <input 
                      type="text" 
                      required
                      placeholder="MM/AA"
                      maxLength={5}
                      value={expiry}
                      onChange={(e) => setExpiry(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder-slate-600 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all font-mono"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-1">CVC</label>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={18} />
                    <input 
                      type="text" 
                      required
                      placeholder="123"
                      maxLength={4}
                      value={cvc}
                      onChange={(e) => setCvc(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder-slate-600 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Name Input */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-1">Nombre en la tarjeta</label>
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={18} />
                  <input 
                    type="text" 
                    required
                    placeholder="Como aparece en el plástico"
                    value={name}
                    onChange={(e) => setName(e.target.value.toUpperCase())}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder-slate-600 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all"
                  />
                </div>
              </div>

              {/* Secure Badge */}
              <div className="flex items-center justify-center gap-2 py-2">
                 <ShieldCheck size={14} className="text-emerald-500" />
                 <span className="text-[10px] text-slate-500">Pagos encriptados con SSL de 256-bits.</span>
              </div>

              {/* Submit Button */}
              <button 
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-500/20 transition-all transform active:scale-[0.98] flex items-center justify-center gap-2"
              >
                Pagar {plan.price}
              </button>
            </form>
          )}

          {step === 'processing' && (
            <div className="py-10 flex flex-col items-center justify-center text-center space-y-4">
               <div className="relative">
                 <div className="w-16 h-16 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
                 <div className="absolute inset-0 flex items-center justify-center">
                   <Lock size={20} className="text-indigo-400" />
                 </div>
               </div>
               <div>
                 <h3 className="text-white font-bold text-lg">Procesando Pago...</h3>
                 <p className="text-slate-400 text-sm">No cierres esta ventana.</p>
               </div>
            </div>
          )}

          {step === 'success' && (
             <div className="py-10 flex flex-col items-center justify-center text-center space-y-4 animate-in zoom-in duration-300">
               <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20 mb-2">
                 <CheckCircle size={40} className="text-emerald-500" />
               </div>
               <div>
                 <h3 className="text-white font-bold text-2xl">¡Pago Exitoso!</h3>
                 <p className="text-slate-400 text-sm">Bienvenido al plan {plan.name}.</p>
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Variant Card Component (Existing)
export const VariantCard: React.FC<{ 
  variant: ContentVariant; 
  onView: (img: string) => void;
  showWatermark?: boolean; // New prop for conditional watermark
}> = ({ variant, onView, showWatermark = false }) => {
  
  const { addToast } = useToast();

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const link = document.createElement('a');
    link.href = variant.image;
    link.download = `sellfy-${variant.id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast("Imagen descargada", "success");
  };

  const handleCopyText = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`${variant.copy}\n\n${variant.hashtags.join(' ')}`);
    addToast("Copy copiado al portapapeles", "success");
  };

  const handlePublish = (e: React.MouseEvent) => {
    e.stopPropagation();
    addToast("Conectando con plataforma...", "info");
    // Simulacion de delay de red
    setTimeout(() => {
        addToast("¡Publicado exitosamente! 🚀", "success");
    }, 1500);
  };

  return (
    <div className="group relative flex flex-col bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden hover:border-indigo-500/40 hover:shadow-[0_15px_40px_-10px_rgba(79,70,229,0.2)] hover:-translate-y-1 transition-all duration-500 ease-out">
      
      {/* Image Area */}
      <div className="relative aspect-[4/5] bg-black/40 overflow-hidden cursor-pointer" onClick={() => onView(variant.image)}>
        <img 
          src={variant.image} 
          alt="Generated Content" 
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out" 
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-transparent to-transparent opacity-60"></div>
        
        {/* WATERMARK OVERLAY */}
        {showWatermark && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-40 z-10">
                <div className="text-white text-3xl font-bold uppercase tracking-widest border-4 border-white px-6 py-2 rotate-[-25deg]">
                    SELLFY FREE
                </div>
            </div>
        )}
        
        {/* Overlay Actions (Top Right) */}
        <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 z-20">
           <button 
             onClick={(e) => { e.stopPropagation(); onView(variant.image); }}
             className="p-2.5 rounded-full bg-black/60 text-white hover:bg-indigo-500 hover:text-white backdrop-blur-md border border-white/10 transition-colors shadow-lg"
             title="Ver Pantalla Completa"
           >
             <Maximize2 size={16} />
           </button>
           <button 
             onClick={handleDownload}
             className="p-2.5 rounded-full bg-black/60 text-white hover:bg-emerald-500 hover:text-white backdrop-blur-md border border-white/10 transition-colors shadow-lg"
             title="Descargar Imagen"
           >
             <Download size={16} />
           </button>
        </div>

        {/* Angle Badge (Top Left) */}
        <div className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-100 z-20">
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/90 bg-black/50 backdrop-blur-md px-2.5 py-1 rounded-md border border-white/10 shadow-lg">
             {variant.angle.split(',')[0]}
          </span>
        </div>
      </div>

      {/* Copy Area */}
      <div className="flex-1 p-5 flex flex-col border-t border-white/5 bg-gradient-to-b from-white/[0.02] to-transparent">
        <div className="flex-1 mb-4 relative">
           <p className="text-sm text-slate-300 font-light leading-relaxed whitespace-pre-wrap line-clamp-4 group-hover:line-clamp-none transition-all duration-300">
             {variant.copy}
           </p>
           <div className="flex flex-wrap gap-1.5 mt-3">
             {variant.hashtags.slice(0, 5).map((tag, i) => (
               <span key={i} className="text-[10px] text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/10">{tag}</span>
             ))}
           </div>
        </div>

        <button 
          onClick={handleCopyText}
          className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-xs font-bold uppercase tracking-wide border border-white/5 transition-all flex items-center justify-center gap-2 group/btn mb-3"
        >
          <Copy size={14} className="group-hover/btn:scale-110 transition-transform" /> Copiar Texto
        </button>

        <button 
           onClick={handlePublish}
           className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold uppercase tracking-wide shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 transition-all flex items-center justify-center gap-2 group/pub transform active:scale-95"
         >
           <Send size={14} className="group-hover/pub:translate-x-0.5 group-hover/pub:-translate-y-0.5 transition-transform" /> Publicar
         </button>
      </div>
    </div>
  );
};

// Selection Card
interface SelectionCardProps {
  selected: boolean;
  onClick: () => void;
  title: string;
  description?: string;
  icon: React.ElementType;
  extraClass?: string;
}

export const SelectionCard: React.FC<SelectionCardProps> = ({ selected, onClick, title, description, icon: Icon, extraClass }) => (
  <div 
    onClick={onClick}
    className={`
      cursor-pointer rounded-xl border p-5 transition-all duration-300 flex flex-col items-center text-center gap-3 relative overflow-hidden group
      ${selected 
        ? 'border-indigo-500/50 bg-indigo-500/10 shadow-[0_0_25px_-5px_rgba(99,102,241,0.25)]' 
        : 'border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/10'}
      ${extraClass ? '' : ''}
    `}
  >
    {selected && <div className="absolute inset-0 bg-indigo-500/5 pointer-events-none" />}

    <div className={`p-3.5 rounded-full transition-colors ${selected ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/40' : 'bg-white/5 text-slate-400 group-hover:text-white group-hover:bg-white/10'}`}>
      <Icon size={24} />
    </div>
    <div className="relative z-10">
      <h3 className={`font-semibold text-sm ${selected ? 'text-white' : 'text-slate-200 group-hover:text-white'}`}>{title}</h3>
      {description && <p className="text-[11px] text-slate-500 mt-1.5 leading-snug group-hover:text-slate-400">{description}</p>}
    </div>
    {selected && (
      <div className="absolute top-3 right-3 text-indigo-400 animate-in zoom-in duration-200">
        <CheckCircle size={16} fill="currentColor" className="text-white/10" />
      </div>
    )}
     {extraClass && (
      <div className={`absolute bottom-0 left-0 w-full h-1 ${extraClass.split(' ')[0].replace('bg-', 'bg-gradient-to-r from-transparent via-') + ' to-transparent opacity-50'}`}></div>
    )}
  </div>
);