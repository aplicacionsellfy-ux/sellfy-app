import React, { useState } from 'react';
import { Check, Zap } from 'lucide-react';
import { PLANS } from '../../constants';
import { PlanTier, PlanDetails } from '../../types';
import { useToast } from '../ui/Toast';
import { PaymentModal } from '../Shared';

interface PlansViewProps {
  currentPlan: PlanTier;
  onUpgrade: (planId: PlanTier) => void;
}

export const PlansView: React.FC<PlansViewProps> = ({ currentPlan, onUpgrade }) => {
  const { addToast } = useToast();
  
  // State for the payment flow
  const [selectedPlanForCheckout, setSelectedPlanForCheckout] = useState<PlanDetails | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  const handleSelect = (plan: PlanDetails) => {
    if (plan.id === currentPlan) {
        addToast("Ya tienes este plan activo", "info");
        return;
    }

    if (plan.id === 'free') {
        // Downgrade to free is instant (or needs a different confirmation)
        if (confirm("¿Estás seguro de volver al plan gratuito? Perderás tus créditos premium.")) {
             onUpgrade('free');
             addToast("Has vuelto al plan Gratuito", "info");
        }
        return;
    }

    // Open Payment Modal for Paid Plans
    setSelectedPlanForCheckout(plan);
    setIsPaymentModalOpen(true);
  };

  const handlePaymentConfirm = async () => {
    if (selectedPlanForCheckout) {
        // Only execute upgrade after payment simulation succeeds in the modal
        onUpgrade(selectedPlanForCheckout.id);
        addToast(`¡Bienvenido al plan ${selectedPlanForCheckout.name}!`, "success");
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto pt-10 pb-20 animate-in fade-in duration-500">
      
      <PaymentModal 
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        plan={selectedPlanForCheckout}
        onConfirm={handlePaymentConfirm}
      />

      <div className="text-center mb-16 space-y-4">
        <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tight">
          Elige tu poder <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">creativo</span>
        </h2>
        <p className="text-slate-400 text-lg max-w-2xl mx-auto">
          Desbloquea más generaciones y características premium para escalar tu negocio.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 px-4">
        {PLANS.map((plan) => {
          const isCurrent = currentPlan === plan.id;
          const isPopular = plan.popular;

          return (
            <div 
              key={plan.id}
              className={`
                relative flex flex-col p-8 rounded-3xl border transition-all duration-300 group
                ${isPopular 
                  ? 'bg-indigo-900/10 border-indigo-500/50 shadow-[0_0_40px_rgba(79,70,229,0.15)] scale-105 z-10' 
                  : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/[0.07]'}
              `}
            >
              {isPopular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-full shadow-lg">
                  Más Popular
                </div>
              )}

              <div className="mb-8">
                <h3 className={`text-lg font-semibold mb-2 ${isPopular ? 'text-indigo-300' : 'text-slate-300'}`}>
                    {plan.name}
                </h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-white">{plan.price}</span>
                  <span className="text-slate-500">/mes</span>
                </div>
                <div className="mt-4 flex items-center gap-2 text-sm font-medium p-2 rounded-lg bg-white/5 border border-white/5">
                    <Zap size={14} className={isPopular ? 'text-yellow-400' : 'text-slate-400'} />
                    <span className="text-slate-200">{plan.credits} créditos mensuales</span>
                </div>
              </div>

              <div className="flex-1 space-y-4 mb-8">
                {plan.features.map((feature, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className={`mt-1 p-0.5 rounded-full ${isPopular ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-700 text-slate-400'}`}>
                        <Check size={10} />
                    </div>
                    <span className="text-sm text-slate-300 leading-tight">{feature}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => handleSelect(plan)}
                disabled={isCurrent}
                className={`
                  w-full py-4 rounded-xl font-bold text-sm tracking-wide transition-all shadow-lg
                  ${isCurrent 
                    ? 'bg-slate-700/50 text-slate-400 cursor-default border border-transparent' 
                    : isPopular
                      ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/25 hover:scale-[1.02]' 
                      : 'bg-white text-slate-900 hover:bg-slate-200'}
                `}
              >
                {isCurrent ? 'Plan Actual' : (plan.id === 'free' ? 'Bajar a Gratis' : 'Suscribirse')}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};