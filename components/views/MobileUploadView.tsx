
import React, { useState } from 'react';
import { Camera, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface MobileUploadViewProps {
  sessionId: string;
}

export const MobileUploadView: React.FC<MobileUploadViewProps> = ({ sessionId }) => {
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tamaño (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("La imagen es muy pesada (Máx 5MB)");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // 1. Subir al Bucket 'temp-uploads'
      const filePath = `${sessionId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('temp-uploads')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 2. Obtener URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('temp-uploads')
        .getPublicUrl(filePath);

      // 3. Actualizar la sesión en la base de datos
      const { error: dbError } = await supabase
        .from('upload_sessions')
        .update({ 
          image_url: publicUrl,
          status: 'completed'
        })
        .eq('id', sessionId);

      if (dbError) throw dbError;

      setSuccess(true);

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error al subir imagen");
    } finally {
      setUploading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-8 text-center animate-in zoom-in duration-500">
        <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
          <CheckCircle size={48} className="text-emerald-500" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">¡Listo!</h1>
        <p className="text-slate-400 text-lg">Tu foto ha aparecido mágicamente en tu computadora.</p>
        <p className="text-slate-600 mt-8 text-sm">Ya puedes cerrar esta ventana.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] flex flex-col text-white font-sans">
      <div className="p-6 border-b border-white/5 flex items-center justify-center">
         <span className="font-bold text-xl flex items-center gap-2">
           <Camera className="text-indigo-500" /> sellfy remote
         </span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold">Sube tu producto</h2>
          <p className="text-slate-400">Toma una foto o elige una de tu galería para sincronizarla.</p>
        </div>

        <div className="w-full max-w-sm relative">
           <input 
             type="file" 
             accept="image/*" 
             capture="environment"
             onChange={handleFileChange}
             className="hidden" 
             id="mobile-upload"
             disabled={uploading}
           />
           
           <label 
             htmlFor="mobile-upload"
             className={`
               flex flex-col items-center justify-center w-full aspect-square rounded-3xl border-2 border-dashed transition-all
               ${uploading ? 'border-indigo-500/50 bg-indigo-500/10' : 'border-white/20 bg-white/5 active:scale-95 active:bg-white/10'}
             `}
           >
             {uploading ? (
               <div className="flex flex-col items-center gap-4">
                 <Loader2 size={48} className="text-indigo-400 animate-spin" />
                 <span className="font-medium text-indigo-300">Subiendo...</span>
               </div>
             ) : (
               <div className="flex flex-col items-center gap-4 text-slate-400">
                 <div className="p-4 bg-indigo-600 rounded-full shadow-lg shadow-indigo-600/30 text-white">
                    <Camera size={32} />
                 </div>
                 <span className="font-medium text-lg text-white">Tocar para Cámara</span>
                 <span className="text-xs uppercase tracking-widest text-slate-500">o subir archivo</span>
               </div>
             )}
           </label>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-200 p-4 rounded-xl flex items-center gap-3 w-full max-w-sm animate-in slide-in-from-bottom-2">
            <AlertCircle size={20} />
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}
      </div>

      <div className="p-6 text-center">
         <p className="text-[10px] text-slate-600 uppercase tracking-widest">Conexión Segura vía Sellfy Cloud</p>
      </div>
    </div>
  );
};
