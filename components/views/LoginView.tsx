import React, { useState } from 'react';
import { Camera, Mail, Lock, Eye, EyeOff, Loader2, ArrowRight, ArrowLeft, Sparkles } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../ui/Toast';

type AuthMode = 'login' | 'register' | 'forgot';

export const LoginView: React.FC = () => {
  const { signInWithGoogle, signInWithPassword, signUpWithPassword, resetPassword } = useAuth();
  const { addToast } = useToast();
  
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      await signInWithGoogle();
    } catch (error: any) {
      console.error(error);
      addToast(error.message || "Error al iniciar con Google", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    
    setLoading(true);
    try {
      if (mode === 'login') {
        if (!password) {
            addToast("Ingresa tu contraseña", "error");
            setLoading(false);
            return;
        }
        await signInWithPassword(email, password);
      } else if (mode === 'register') {
        if (!password) {
            addToast("Crea una contraseña", "error");
            setLoading(false);
            return;
        }
        await signUpWithPassword(email, password);
        addToast("Cuenta creada. Revisa tu correo para confirmar.", "success");
        setMode('login');
      } else if (mode === 'forgot') {
        await resetPassword(email);
        addToast("Correo de recuperación enviado.", "success");
        setMode('login');
      }
    } catch (error: any) {
      console.error(error);
      let msg = "Ocurrió un error inesperado";
      if (error.message.includes("Invalid login")) msg = "Credenciales incorrectas.";
      if (error.message.includes("already registered")) msg = "Este correo ya está registrado.";
      addToast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  const config = {
    login: { 
      title: "Bienvenido de nuevo", 
      subtitle: "Ingresa tus credenciales para continuar.", 
      button: "Iniciar Sesión" 
    },
    register: { 
      title: "Crea tu cuenta", 
      subtitle: "Desbloquea el poder de la IA en minutos.", 
      button: "Registrarse Gratis" 
    },
    forgot: { 
      title: "Recuperar Acceso", 
      subtitle: "Ingresa tu correo y te enviaremos instrucciones.", 
      button: "Enviar Enlace" 
    }
  };

  return (
    <div className="flex min-h-screen bg-[#020617] font-sans text-slate-200 selection:bg-indigo-500/30">
      
      {/* LEFT SIDE: ARTWORK (Hidden on mobile) */}
      <div className="hidden lg:flex w-[45%] relative overflow-hidden bg-black items-center justify-center p-12">
        {/* Image Background */}
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=1974&auto=format&fit=crop" 
            alt="AI Generative Art" 
            className="w-full h-full object-cover opacity-50 scale-105 hover:scale-110 transition-transform duration-[20s]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-transparent to-[#020617]/20"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-[#020617]/90 to-transparent"></div>
        </div>

        {/* Floating Abstract Elements */}
        <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[120px] animate-pulse delay-1000"></div>

        {/* Content Overlay */}
        <div className="relative z-10 w-full max-w-lg mb-20">
          <div className="w-16 h-16 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl flex items-center justify-center mb-8 shadow-[0_0_40px_-10px_rgba(255,255,255,0.1)]">
            <Camera size={32} className="text-white" />
          </div>
          
          <h1 className="text-6xl font-bold text-white mb-6 leading-[1.1] tracking-tight">
            Crea, publica <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-purple-300 to-indigo-300 animate-gradient-x">y vende.</span>
          </h1>
          
          <p className="text-lg text-slate-300 font-light leading-relaxed mb-8 max-w-md opacity-90">
            Potencia tu narrativa visual con algoritmos generativos de vanguardia. Resultados de calidad estudio, optimizados para captar atención y convertir audiencias al instante.
          </p>
        </div>

        {/* FLOATING BADGE */}
        <div className="absolute bottom-12 left-12 z-20 animate-in slide-in-from-bottom-8 duration-1000 fade-in fill-mode-forwards">
          <div className="flex items-center gap-4 bg-black/40 backdrop-blur-xl p-4 pr-6 rounded-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] hover:border-white/20 transition-colors cursor-default">
            <div className="flex -space-x-3">
              {[1,2,3].map(i => (
                <div key={i} className="w-10 h-10 rounded-full bg-slate-800 border-2 border-[#1a1f2e] flex items-center justify-center overflow-hidden shadow-lg relative z-10 hover:z-20 transition-all hover:-translate-y-1">
                    <img src={`https://i.pravatar.cc/100?img=${i+15}`} alt="User" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
            <div className="flex flex-col">
               <span className="text-white font-bold text-sm tracking-wide">Únete a +10,000 creadores</span>
               <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Generando ventas hoy</span>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE: FORM */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
         {/* Background Glow for Form Side */}
         <div className="absolute top-0 right-0 w-full h-full overflow-hidden pointer-events-none">
            <div className="absolute top-[20%] right-[10%] w-[300px] h-[300px] bg-indigo-500/5 blur-[80px] rounded-full"></div>
         </div>

         <div className="w-full max-w-md space-y-8 relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            
            {/* Mobile Logo */}
            <div className="lg:hidden flex justify-center mb-4">
               <div className="w-12 h-12 bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                  <Camera size={24} className="text-white" />
               </div>
            </div>

            <div className="text-center space-y-2">
               <h2 className="text-3xl font-bold text-white tracking-tight">{config[mode].title}</h2>
               <p className="text-slate-400">{config[mode].subtitle}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 mt-8">
               <div className="space-y-1.5">
                 <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1">Correo Electrónico</label>
                 <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="block w-full pl-11 pr-4 py-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent outline-none transition-all"
                      placeholder="nombre@ejemplo.com"
                    />
                 </div>
               </div>

               {mode !== 'forgot' && (
                 <div className="space-y-1.5">
                   <div className="flex justify-between items-center ml-1">
                      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Contraseña</label>
                   </div>
                   <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Lock className="h-5 w-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                      </div>
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="block w-full pl-11 pr-12 py-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent outline-none transition-all"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-500 hover:text-white transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                   </div>
                 </div>
               )}

               {mode === 'login' && (
                  <div className="flex justify-end">
                      <button 
                        type="button"
                        onClick={() => setMode('forgot')} 
                        className="text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
                      >
                        ¿Olvidaste tu contraseña?
                      </button>
                  </div>
               )}

               <button
                 type="submit"
                 disabled={loading}
                 className="w-full flex items-center justify-center py-4 px-4 border border-transparent rounded-xl shadow-lg shadow-indigo-500/20 text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 focus:ring-offset-[#020617] transition-all transform active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed gap-2"
               >
                 {loading ? <Loader2 className="animate-spin" size={20} /> : (
                   <>
                     {config[mode].button}
                     {mode !== 'forgot' && <ArrowRight size={18} />}
                   </>
                 )}
               </button>
            </form>

            {/* DIVIDER */}
            {mode !== 'forgot' && (
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-[#020617] px-4 text-slate-500 font-bold tracking-widest">O continúa con</span>
                </div>
              </div>
            )}

            {/* GOOGLE BUTTON - WHITE LOGO */}
            {mode !== 'forgot' && (
              <button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full flex items-center justify-center px-4 py-4 border border-white/10 rounded-xl shadow-sm bg-white/5 hover:bg-white/10 text-sm font-medium text-white transition-all disabled:opacity-50 gap-3 group"
              >
                {/* Minimalist White Google Icon */}
                <svg className="h-5 w-5 text-white opacity-80 group-hover:opacity-100 transition-opacity" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
                </svg>
                <span>
                    {mode === 'register' ? 'Registrarse con Google' : 'Ingresar con Google'}
                </span>
              </button>
            )}

            {/* FOOTER SWITCHER */}
            <div className="mt-6 text-center">
               {mode === 'login' ? (
                 <p className="text-sm text-slate-400">
                   ¿Aún no tienes cuenta?{' '}
                   <button onClick={() => setMode('register')} className="font-bold text-white hover:text-indigo-400 transition-colors">
                     Regístrate aquí
                   </button>
                 </p>
               ) : (
                 <div className="flex justify-center">
                    <button onClick={() => setMode('login')} className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors font-medium group">
                        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Volver al inicio de sesión
                    </button>
                 </div>
               )}
            </div>
         </div>
         
         <p className="absolute bottom-6 text-[10px] text-slate-700 font-medium">
             Sellfy Inc. &copy; {new Date().getFullYear()}
         </p>
      </div>
    </div>
  );
};