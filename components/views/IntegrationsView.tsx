
import React, { useState } from 'react';
import { Facebook, Instagram, Linkedin, Twitter } from 'lucide-react';
import { useToast } from '../ui/Toast';

export const IntegrationsView: React.FC = () => {
  const { addToast } = useToast();
  const [connected, setConnected] = useState<string[]>(['ig']);

  const networks = [
    { id: 'fb', name: 'Facebook', icon: Facebook, color: 'text-blue-500', bg: 'bg-blue-500/10 border-blue-500/20' },
    { id: 'ig', name: 'Instagram', icon: Instagram, color: 'text-pink-500', bg: 'bg-pink-500/10 border-pink-500/20' },
    { id: 'li', name: 'LinkedIn', icon: Linkedin, color: 'text-sky-600', bg: 'bg-sky-600/10 border-sky-600/20' },
    { id: 'x', name: 'X / Twitter', icon: Twitter, color: 'text-white', bg: 'bg-slate-700/30 border-slate-600/30' },
  ];

  const toggle = (id: string) => {
    const isConnecting = !connected.includes(id);
    setConnected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    
    if (isConnecting) {
        addToast("Conectado exitosamente", "success");
    } else {
        addToast("Desconectado", "info");
    }
  };

  return (
    <div className="max-w-3xl mx-auto pt-10 animate-in fade-in duration-500">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-white mb-2">Conecta tus Redes</h2>
        <p className="text-slate-400">Publica directamente desde Sellfy</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {networks.map((net) => (
          <div key={net.id} className={`p-6 rounded-2xl border transition-all ${net.bg} flex items-center justify-between`}>
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-full bg-[#020617] ${net.color}`}>
                <net.icon size={24} />
              </div>
              <span className="font-semibold text-lg text-white">{net.name}</span>
            </div>
            <button 
              onClick={() => toggle(net.id)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all border ${
                connected.includes(net.id) 
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20' 
                  : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
              }`}
            >
              {connected.includes(net.id) ? 'Conectado' : 'Conectar'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
