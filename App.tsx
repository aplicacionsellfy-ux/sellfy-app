
import React, { useState, useEffect } from 'react';
import { Camera, Globe, BrainCircuit } from 'lucide-react';
import { ToastProvider } from './components/ui/Toast';

// Supabase Hooks
import { useAuth } from './hooks/useAuth';
import { useProfile } from './hooks/useProfile';
import { useCampaigns } from './hooks/useCampaigns';

// Components
import { Sidebar } from './components/Sidebar';
import { FullScreenModal } from './components/Shared';
import { WizardView } from './components/views/WizardView';
import { HistoryView } from './components/views/HistoryView';
import { SettingsView } from './components/views/SettingsView';
import { IntegrationsView } from './components/views/IntegrationsView';
import { PlansView } from './components/views/PlansView';
import { LoginView } from './components/views/LoginView';
import { MobileUploadView } from './components/views/MobileUploadView';

type View = 'wizard' | 'integrations' | 'settings' | 'history' | 'plans';
type Language = 'es' | 'en' | 'de' | 'fr' | 'pt';

// --- INTRO ANIMATION COMPONENT ---
const IntroAnimation: React.FC<{ onFinish: () => void }> = ({ onFinish }) => {
  const [phrase, setPhrase] = useState("");
  const [progress, setProgress] = useState(0);

  const phrases = [
    "Sincronizando con la neuro-red...",
    "Calibrando algoritmos estéticos...",
    "Analizando tendencias de mercado...",
    "Optimizando motores creativos...",
    "Preparando tu estudio digital..."
  ];

  useEffect(() => {
    setPhrase(phrases[Math.floor(Math.random() * phrases.length)]);
    const duration = 2500; // Faster intro for better UX
    const intervalTime = 50;
    const steps = duration / intervalTime;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      setProgress((currentStep / steps) * 100);
      if (currentStep % 20 === 0) setPhrase(phrases[Math.floor(Math.random() * phrases.length)]);
      if (currentStep >= steps) {
        clearInterval(timer);
        setTimeout(onFinish, 300);
      }
    }, intervalTime);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="fixed inset-0 z-[100] bg-[#020617] flex flex-col items-center justify-center font-sans overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px] animate-pulse"></div>
      </div>
      <div className="relative z-10 flex flex-col items-center">
        <div className="relative w-32 h-32 mb-12">
           <div className="absolute inset-0 border-2 border-indigo-500/30 rounded-full animate-[spin_3s_linear_infinite]"></div>
           <div className="absolute inset-2 border-2 border-purple-500/30 rounded-full animate-[spin_4s_linear_infinite_reverse]"></div>
           <div className="absolute inset-0 flex items-center justify-center">
              <BrainCircuit size={48} className="text-white drop-shadow-[0_0_15px_rgba(99,102,241,0.8)] animate-pulse" />
           </div>
        </div>
        <h2 className="text-3xl font-bold text-white mb-2 tracking-tight animate-in fade-in duration-700">Sellfy AI</h2>
        <div className="h-6 mb-8 flex items-center justify-center">
           <p className="text-indigo-300 text-sm font-mono animate-pulse">{phrase}</p>
        </div>
        <div className="w-64 h-1 bg-white/10 rounded-full overflow-hidden relative">
           <div className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 transition-all duration-100 ease-linear shadow-[0_0_10px_rgba(99,102,241,0.5)]" style={{ width: `${progress}%` }}></div>
        </div>
      </div>
    </div>
  );
};

const LanguageSwitcher: React.FC<{ current: Language; setLang: (l: Language) => void }> = ({ current, setLang }) => {
  const languages: { code: Language; label: string; color: string }[] = [
    { code: 'es', label: 'Español', color: 'text-amber-400' },
    { code: 'en', label: 'English', color: 'text-indigo-400' },
  ];
  const [isOpen, setIsOpen] = useState(false);
  const activeLang = languages.find(l => l.code === current) || languages[0];

  return (
    <div className="relative z-50">
      <button onClick={() => setIsOpen(!isOpen)} className="flex items-center gap-2 bg-[#0B0F19]/50 backdrop-blur-md border border-white/10 px-3 py-2 rounded-full hover:bg-white/10 transition-colors">
        <Globe size={16} className={activeLang.color} />
        <span className="text-xs font-bold uppercase text-slate-300">{current}</span>
      </button>
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-32 bg-[#0B0F19] border border-white/10 rounded-xl shadow-2xl overflow-hidden py-1">
          {languages.map((l) => (
            <button key={l.code} onClick={() => { setLang(l.code); setIsOpen(false); }} className={`w-full text-left px-4 py-2 text-xs font-medium hover:bg-white/5 flex items-center gap-2 ${current === l.code ? 'text-white bg-white/5' : 'text-slate-400'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${l.color.replace('text-', 'bg-')}`}></div>
              {l.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const SellfyApp: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('wizard');
  const [lang, setLang] = useState<Language>('es');
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [apiKeyMissing, setApiKeyMissing] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  const [introSeen, setIntroSeen] = useState(false);

  const { session, loading: authLoading, signOut } = useAuth();
  const { settings, subscription, updateSettings, decrementCredits, upgradePlan } = useProfile(session?.user?.id);
  const { history, saveCampaign, clearHistory } = useCampaigns(session?.user?.id);

  // 1. MOBILE UPLOAD DETECTION ROUTE
  const [mobileSessionId, setMobileSessionId] = useState<string | null>(null);

  useEffect(() => {
    // Check for mobile session parameter in URL
    const params = new URLSearchParams(window.location.search);
    const mobileId = params.get('mobile_upload');
    if (mobileId) {
      setMobileSessionId(mobileId);
    }

    // Check API Key
    let hasKey = false;
    // @ts-ignore
    if (import.meta.env?.VITE_API_KEY || import.meta.env?.API_KEY) hasKey = true;
    try { 
        // @ts-ignore
        if (process.env.API_KEY) hasKey = true; 
    } catch(e) {}
    if (!hasKey) setApiKeyMissing(true);
  }, []);

  useEffect(() => {
    if (session && !authLoading && !introSeen && !mobileSessionId) {
      setShowIntro(true);
    }
  }, [session, authLoading, introSeen, mobileSessionId]);

  // --- RENDER MODES ---

  // A. Mobile Upload Mode (Hijack everything else)
  if (mobileSessionId) {
    return <MobileUploadView sessionId={mobileSessionId} />;
  }

  // B. Loading
  if (authLoading) {
    return (
      <div className="h-screen bg-[#020617] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"></div>
      </div>
    );
  }

  // C. Login
  if (!session) return <LoginView />;

  // D. Intro
  if (showIntro) return <IntroAnimation onFinish={() => { setShowIntro(false); setIntroSeen(true); }} />;

  // E. Main App
  return (
    <div className="flex h-screen bg-[#020617] text-slate-200 overflow-hidden relative font-sans animate-in fade-in duration-1000">
       <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-indigo-950/20 via-[#020617] to-[#020617] z-0"></div>
      <FullScreenModal image={fullScreenImage} onClose={() => setFullScreenImage(null)} />

      <div className="hidden md:block z-20">
        <Sidebar currentView={currentView} setView={setCurrentView} lang={lang} subscription={subscription} onLogout={signOut} />
      </div>

      <div className="flex-1 flex flex-col relative z-10 min-w-0">
        <div className="absolute top-6 right-8 z-50">
          <LanguageSwitcher current={lang} setLang={setLang} />
        </div>
        <div className="md:hidden p-4 flex items-center justify-between border-b border-white/5 bg-[#020617]/50 backdrop-blur-md sticky top-0 z-50">
            <span className="font-bold text-lg tracking-tight text-white flex items-center gap-2"><Camera size={16} className="text-indigo-400" /> sellfy</span>
             <LanguageSwitcher current={lang} setLang={setLang} />
        </div>
        <main className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth hide-scrollbar">
          {currentView === 'integrations' && <IntegrationsView />}
          {currentView === 'plans' && <PlansView currentPlan={subscription.plan} onUpgrade={upgradePlan} />}
          {currentView === 'settings' && <SettingsView settings={settings} updateSettings={updateSettings} />}
          {currentView === 'history' && <HistoryView items={history} onViewImage={setFullScreenImage} onClearHistory={clearHistory} isFreePlan={subscription.plan === 'free'} />}
          {currentView === 'wizard' && (
            <WizardView 
              businessSettings={settings}
              onCampaignCreated={saveCampaign}
              onViewImage={setFullScreenImage}
              apiKeyMissing={apiKeyMissing}
              subscription={subscription}
              onDecrementCredit={decrementCredits}
            />
          )}
        </main>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ToastProvider>
      <SellfyApp />
    </ToastProvider>
  );
}

export default App;
