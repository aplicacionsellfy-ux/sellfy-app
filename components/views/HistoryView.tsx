import React from 'react';
import { History, Trash2 } from 'lucide-react';
import { CampaignResult } from '../../types';
import { VariantCard } from '../Shared';
import { useToast } from '../ui/Toast';

interface HistoryViewProps {
  items: CampaignResult[];
  onViewImage: (img: string) => void;
  onClearHistory: () => void;
  isFreePlan?: boolean; // New prop
}

export const HistoryView: React.FC<HistoryViewProps> = ({ items, onViewImage, onClearHistory, isFreePlan = false }) => {
  const { addToast } = useToast();

  const handleClear = () => {
    if (confirm("¿Estás seguro de que quieres borrar todo el historial? Esta acción no se puede deshacer.")) {
      onClearHistory();
      addToast("Historial eliminado", "info");
    }
  };

  return (
     <div className="max-w-[1400px] mx-auto pt-10 animate-in fade-in duration-500 pb-20">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Tus Creaciones</h2>
          <p className="text-slate-400">Accede a tus campañas anteriores.</p>
        </div>
        {items.length > 0 && (
          <button 
            onClick={handleClear}
            className="flex items-center gap-2 text-xs font-bold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-4 py-2 rounded-lg transition-colors"
          >
            <Trash2 size={14} /> Borrar Historial
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-white/10 rounded-3xl bg-white/5">
          <History size={48} className="mx-auto text-slate-600 mb-4" />
          <p className="text-slate-500">Aún no has creado contenido.</p>
        </div>
      ) : (
        <div className="space-y-12">
          {items.map((campaign) => (
            <div key={campaign.id} className="animate-in slide-in-from-bottom-4 duration-700">
               <div className="flex items-center gap-3 mb-4 pl-1">
                 <span className="text-indigo-400 font-bold text-sm bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-full">
                    {new Date(campaign.timestamp).toLocaleDateString()}
                 </span>
                 <span className="text-slate-500 text-sm border border-white/5 px-3 py-1 rounded-full">{campaign.platform}</span>
               </div>
               
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                 {campaign.variants.map((variant) => (
                   <VariantCard 
                        key={variant.id} 
                        variant={variant} 
                        onView={onViewImage} 
                        showWatermark={isFreePlan}
                   />
                 ))}
               </div>
            </div>
          ))}
        </div>
      )}
     </div>
  );
};