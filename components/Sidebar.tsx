import React from 'react';
import { Camera, Sparkles, History, Workflow, Settings, LogOut, CreditCard } from 'lucide-react';
import { UserSubscription } from '../types';
import { useToast } from './ui/Toast';

type View = 'wizard' | 'integrations' | 'settings' | 'history' | 'plans';
type Language = 'es' | 'en' | 'de' | 'fr' | 'pt';

interface SidebarProps {
  currentView: View;
  setView: (v: View) => void;
  lang: Language;
  subscription: UserSubscription;
  onLogout: () => void;
}

const TRANSLATIONS = {
  es: { nav_integrations: 'Integraciones', nav_settings: 'Configuración', nav_history: 'Historial', nav_plans: 'Planes', nav_logout: 'Cerrar Sesión', slogan: 'Crea, publica, vende' },
  en: { nav_integrations: 'Integrations', nav_settings: 'Settings', nav_history: 'History', nav_plans: 'Plans', nav_logout: 'Log Out', slogan: 'Create, publish, sell' },
  de: { nav_integrations: 'Integrationen', nav_settings: 'Einstellungen', nav_history: 'Verlauf', nav_plans: 'Pläne', nav_logout: 'Abmelden', slogan: 'Erstellen, veröffentlichen, verkaufen' },
  fr: { nav_integrations: 'Intégrations', nav_settings: 'Paramètres', nav_history: 'Historique', nav_plans: 'Plans', nav_logout: 'Déconnexion', slogan: 'Créer, publier, vendre' },
  pt: { nav_integrations: 'Integrações', nav_settings: 'Configurações', nav_history: 'Histórico', nav_plans: 'Planos', nav_logout: 'Sair', slogan: 'Crie, publique, venda' },
};

export const Sidebar: React.FC<SidebarProps> = ({ currentView, setView, lang, subscription, onLogout }) => {
  const { addToast } = useToast();
  const t = TRANSLATIONS[lang] || TRANSLATIONS.es;
  const usagePercent = Math.min(100, ((subscription.credits) / subscription.maxCredits) * 100);
  const isLow = subscription.credits <= 2;

  const handleLogout = async () => {
    try {
      addToast("Cerrando sesión...", "info");
      await onLogout();
    } catch (error) {
      console.error("Logout failed", error);
      addToast("Error al cerrar sesión", "error");
    }
  };

  const MenuItem = ({ view, icon: Icon, label }: { view: View; icon: any; label: string }) => (
    <button 
      onClick={() => setView(view)}
      className={`
        w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all group border
        ${currentView === view 
          ? 'bg-indigo-500/10 text-white border-indigo-500/20 shadow-lg shadow-indigo-500/10' 
          : 'text-slate-400 border-transparent hover:bg-white/5 hover:text-white'}
      `}
    >
      <Icon size={18} className={`transition-colors ${currentView === view ? 'text-indigo-400' : 'text-slate-500 group-hover:text-indigo-300'}`} />
      <span className="font-medium text-sm">{label}</span>
    </button>
  );

  return (
    <aside className="w-72 h-[calc(100vh-2rem)] m-4 bg-[#0B0F19]/90 backdrop-blur-2xl border border-white/5 rounded-3xl flex flex-col shrink-0 z-50 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-40 bg-indigo-500/5 blur-[50px] pointer-events-none"></div>

        <div className="p-8 pb-8 relative z-10">
           <div className="flex flex-col gap-1">
             <div className="flex items-center gap-3 mb-1">
              <div className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white p-2.5 rounded-xl shadow-lg shadow-indigo-500/20">
                <Camera size={26} />
              </div>
              <span className="font-bold text-3xl tracking-tighter text-white">sellfy</span>
            </div>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest pl-1 font-semibold">{t.slogan}</p>
          </div>
        </div>

        <div className="flex-1 px-4 space-y-2 relative z-10">
          <MenuItem view="wizard" icon={Sparkles} label="Generar Contenido" />
          <MenuItem view="history" icon={History} label={t.nav_history} />
          <div className="h-px bg-white/5 my-2 mx-2"></div>
          <MenuItem view="plans" icon={CreditCard} label={t.nav_plans} />
          <MenuItem view="integrations" icon={Workflow} label={t.nav_integrations} />
          <MenuItem view="settings" icon={Settings} label={t.nav_settings} />
        </div>

        <div className="p-6 relative z-10">
          <div 
            onClick={() => setView('plans')}
            className="mb-4 p-4 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-white/5 cursor-pointer hover:border-indigo-500/30 transition-colors group"
          >
             <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2">
                    <Sparkles size={12} className={isLow ? "text-red-400 animate-pulse" : "text-indigo-400"} />
                    <span className="text-xs font-bold text-indigo-200 capitalize">Plan {subscription.plan}</span>
                </div>
                {isLow && <span className="text-[9px] bg-red-500 text-white px-1.5 py-0.5 rounded font-bold">BAJO</span>}
             </div>
             
             <div className="w-full bg-slate-800/50 h-1.5 rounded-full mt-2 mb-1 overflow-hidden">
                <div 
                    className={`h-full transition-all duration-500 ${isLow ? 'bg-red-500' : 'bg-indigo-500'}`} 
                    style={{ width: `${usagePercent}%` }}
                ></div>
             </div>
             <div className="flex justify-between items-center mt-1">
                 <p className="text-[10px] text-slate-500">{subscription.credits} de {subscription.maxCredits} créditos</p>
                 <span className="text-[10px] text-indigo-400 font-semibold group-hover:underline">Mejorar</span>
             </div>
          </div>

          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:text-red-400 hover:bg-red-500/5 rounded-xl transition-all"
          >
            <LogOut size={18} />
            <span className="font-medium text-sm">{t.nav_logout}</span>
          </button>
        </div>
    </aside>
  );
};