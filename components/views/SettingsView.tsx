
import React, { useState } from 'react';
import { Briefcase, Link as LinkIcon, Users, Palette, Save, Check } from 'lucide-react';
import { BusinessSettings } from '../../types';
import { useToast } from '../ui/Toast';

interface SettingsViewProps {
  settings: BusinessSettings;
  updateSettings: (key: string, value: string) => void;
}

const PRESET_COLORS = [
  '#6366f1', // Indigo
  '#ec4899', // Pink
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#3b82f6', // Blue
  '#ef4444', // Red
  '#8b5cf6', // Violet
  '#000000', // Black
  '#ffffff', // White
];

export const SettingsView: React.FC<SettingsViewProps> = ({ settings, updateSettings }) => {
  const { addToast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveSimulated = () => {
    setIsSaving(true);
    // En el modo Supabase, updateSettings ya guarda en la DB cada vez que se llama,
    // pero simularemos un pequeño delay para dar feedback visual de "Guardado".
    setTimeout(() => {
        setIsSaving(false);
        addToast("Configuración guardada correctamente en la nube", "success");
    }, 800);
  };

  const ColorPicker = ({ label, value, onChangeField }: { label: string, value: string, onChangeField: string }) => (
    <div>
      <div className="flex justify-between mb-3">
        <span className="text-sm text-slate-300 font-medium">{label}</span>
        <span className="text-xs text-slate-500 font-mono uppercase">{value}</span>
      </div>
      
      {/* Paleta Predefinida */}
      <div className="flex flex-wrap gap-2 mb-3">
        {PRESET_COLORS.map((color) => (
          <button
            key={color}
            onClick={() => updateSettings(onChangeField, color)}
            className={`w-6 h-6 rounded-full border border-white/10 transition-transform hover:scale-110 flex items-center justify-center ${value === color ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0B0F19]' : ''}`}
            style={{ backgroundColor: color }}
          >
            {value === color && <Check size={12} className={color === '#ffffff' ? 'text-black' : 'text-white'} />}
          </button>
        ))}
      </div>

      {/* Input Custom */}
      <div className="flex items-center gap-3 bg-[#020617]/50 border border-white/10 rounded-xl p-2 pr-4">
        <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-white/10 shrink-0">
           <input 
            type="color" 
            value={value}
            onChange={(e) => updateSettings(onChangeField, e.target.value)}
            className="absolute -top-2 -left-2 w-16 h-16 cursor-pointer border-none p-0" 
          />
        </div>
        <input 
          type="text" 
          value={value}
          onChange={(e) => updateSettings(onChangeField, e.target.value)}
          className="flex-1 bg-transparent text-white text-sm focus:outline-none font-mono uppercase"
          placeholder="#000000"
        />
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto pt-10 animate-in fade-in duration-500 pb-20">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-white mb-2">Identidad de Marca</h2>
        <p className="text-slate-400">Define tu estilo visual y voz. La IA usará esto para personalizar cada resultado.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Basic Info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 space-y-6">
             <div className="flex items-center gap-3 mb-2 text-indigo-400 border-b border-white/5 pb-4">
               <Briefcase size={20} />
               <h3 className="font-bold text-lg text-white">Información Básica</h3>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">Nombre del Negocio</label>
                  <input 
                    type="text" 
                    value={settings.name} 
                    onChange={(e) => updateSettings('name', e.target.value)}
                    className="w-full bg-[#020617]/50 border border-white/10 rounded-xl p-4 text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all focus:border-indigo-500/30" 
                    placeholder="Tu Marca"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">Industria / Nicho</label>
                  <input 
                    type="text" 
                    value={settings.industry} 
                    onChange={(e) => updateSettings('industry', e.target.value)}
                    className="w-full bg-[#020617]/50 border border-white/10 rounded-xl p-4 text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all focus:border-indigo-500/30" 
                    placeholder="Ej. Moda, Tecnología"
                  />
                </div>
             </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">Sitio Web</label>
                <div className="flex items-center bg-[#020617]/50 border border-white/10 rounded-xl px-4 focus-within:ring-2 focus-within:ring-indigo-500/50 focus-within:border-indigo-500/30 transition-all">
                  <LinkIcon size={16} className="text-slate-500 mr-3" />
                  <input 
                    type="text" 
                    value={settings.website} 
                    onChange={(e) => updateSettings('website', e.target.value)}
                    className="w-full bg-transparent py-4 text-white outline-none" 
                    placeholder="www.tusitio.com"
                  />
                </div>
              </div>
          </div>

          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 space-y-6">
             <div className="flex items-center gap-3 mb-2 text-emerald-400 border-b border-white/5 pb-4">
               <Users size={20} />
               <h3 className="font-bold text-lg text-white">Estrategia</h3>
             </div>

             <div>
                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">Público Objetivo Principal</label>
                <textarea 
                  value={settings.targetAudience} 
                  onChange={(e) => updateSettings('targetAudience', e.target.value)}
                  className="w-full bg-[#020617]/50 border border-white/10 rounded-xl p-4 text-white focus:ring-2 focus:ring-emerald-500/50 outline-none h-24 resize-none transition-all focus:border-emerald-500/30" 
                  placeholder="Ej: Mujeres entre 25-40 años interesadas en vida saludable y yoga..."
                />
             </div>

             <div>
                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">Tono de Voz</label>
                <div className="grid grid-cols-2 gap-3">
                  {['Profesional', 'Amigable & Cercano', 'Lujo & Exclusivo', 'Urgente / Ventas', 'Divertido & Creativo'].map((tone) => (
                    <button 
                      key={tone}
                      onClick={() => updateSettings('tone', tone)}
                      className={`px-4 py-3 rounded-xl text-sm font-medium border transition-all text-left ${settings.tone === tone ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10'}`}
                    >
                      {tone}
                    </button>
                  ))}
                </div>
             </div>
          </div>
        </div>

        {/* Right Column: Visual Identity */}
        <div className="space-y-6">
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 space-y-6 sticky top-8">
             <div className="flex items-center gap-3 mb-2 text-rose-400 border-b border-white/5 pb-4">
               <Palette size={20} />
               <h3 className="font-bold text-lg text-white">Estilo Visual</h3>
             </div>

             <div className="space-y-6">
               <ColorPicker 
                  label="Color Primario" 
                  value={settings.primaryColor} 
                  onChangeField="primaryColor" 
               />
               <ColorPicker 
                  label="Color Secundario" 
                  value={settings.secondaryColor} 
                  onChangeField="secondaryColor" 
               />
             </div>

             <div className="p-4 rounded-xl bg-[#020617]/50 border border-white/10 mt-4">
               <p className="text-xs text-slate-500 mb-2 uppercase font-bold">Vista Previa de Marca</p>
               <div className="h-24 rounded-lg bg-gradient-to-br flex items-center justify-center relative overflow-hidden" style={{ backgroundImage: `linear-gradient(135deg, ${settings.primaryColor} 0%, ${settings.secondaryColor} 100%)` }}>
                  <span className="text-white font-bold text-lg drop-shadow-md z-10">{settings.name}</span>
                  <div className="absolute inset-0 bg-black/10"></div>
               </div>
             </div>

             <div className="pt-4">
                <button 
                  onClick={handleSaveSimulated}
                  disabled={isSaving}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? <span className="animate-spin rounded-full h-4 w-4 border-t-2 border-white"></span> : <Save size={18} />}
                  {isSaving ? 'Guardando...' : 'Guardar Configuración'}
                </button>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};
