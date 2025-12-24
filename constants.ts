
import { ContentType, Platform, VisualStyle, PlanDetails } from './types';
import { Camera, Zap, Tag, Rocket, Briefcase, Instagram, Facebook, MessageCircle, Layout, Star, Sun, Palette, Moon, Box, Video, PlayCircle } from 'lucide-react';

export const CREDIT_COSTS = {
  IMAGE: 1,
  VIDEO: 5
};

export const PLANS: PlanDetails[] = [
  {
    id: 'free',
    name: 'Gratis',
    price: '$0',
    credits: 5,
    features: ['5 Créditos de prueba', 'Generación de Imágenes', 'Calidad Estándar', 'Con Marca de Agua']
  },
  {
    id: 'starter',
    name: 'Starter',
    price: '$9.99',
    credits: 40,
    features: ['40 Créditos / mes', 'Equiv. a ~40 Fotos u 8 Videos', 'Sin marcas de agua', 'Acceso a Videos (Beta)', 'Soporte prioritario'],
    popular: true
  },
  {
    id: 'pro',
    name: 'Pro Agency',
    price: '$29.99',
    credits: 150,
    features: ['150 Créditos / mes', 'Equiv. a ~150 Fotos o 30 Videos', 'Calidad Ultra (4K)', 'Prioridad en cola de Video', 'Soporte 24/7'],
  }
];

export const CONTENT_OPTIONS = [
  { id: ContentType.PRODUCT, icon: Camera, label: 'Producto', desc: 'Enfoque total en el artículo' },
  { id: ContentType.VIDEO_REEL, icon: Video, label: 'Video Reel', desc: 'Animación para Reels/TikTok (5 créditos)' },
  { id: ContentType.LIFESTYLE, icon: Sun, label: 'Lifestyle', desc: 'Producto en uso real' },
  { id: ContentType.PROMO, icon: Tag, label: 'Promoción', desc: 'Ofertas y descuentos' },
  { id: ContentType.LAUNCH, icon: Rocket, label: 'Lanzamiento', desc: 'Nuevo en la tienda' },
  { id: ContentType.BRANDING, icon: Briefcase, label: 'Branding', desc: 'Identidad de marca' },
];

export const PLATFORM_OPTIONS = [
  { id: Platform.IG_FEED, icon: Instagram, label: 'IG Feed', desc: 'Cuadrado 1:1' },
  { id: Platform.IG_STORIES, icon: Instagram, label: 'IG Stories', desc: 'Vertical 9:16' },
  { id: Platform.IG_REELS, icon: PlayCircle, label: 'IG Reels', desc: 'Video Vertical 9:16' },
  { id: Platform.TIKTOK, icon: Video, label: 'TikTok', desc: 'Video Vertical 9:16' },
  { id: Platform.FB_FEED, icon: Facebook, label: 'FB Feed', desc: 'Horizontal o 1:1' },
  { id: Platform.FB_ADS, icon: Layout, label: 'FB Ads', desc: 'Optimizado para clics' },
  { id: Platform.WA_CATALOG, icon: MessageCircle, label: 'WhatsApp', desc: 'Catálogo de ventas' },
];

export const STYLE_OPTIONS = [
  { id: VisualStyle.MINIMAL, icon: Box, label: 'Minimalista', color: 'bg-slate-700/30 text-slate-200 border-slate-500/30' },
  { id: VisualStyle.PREMIUM, icon: Star, label: 'Premium', color: 'bg-yellow-500/10 text-yellow-200 border-yellow-500/30' },
  { id: VisualStyle.NATURAL, icon: Sun, label: 'Natural', color: 'bg-emerald-500/10 text-emerald-200 border-emerald-500/30' },
  { id: VisualStyle.CINEMATIC, icon: Video, label: 'Cinemático', color: 'bg-indigo-500/10 text-indigo-200 border-indigo-500/30' },
  { id: VisualStyle.CREATIVE, icon: Palette, label: 'Creativo', color: 'bg-purple-500/10 text-purple-200 border-purple-500/30' },
  { id: VisualStyle.DARK, icon: Moon, label: 'Oscuro', color: 'bg-slate-950 text-white border-slate-700' },
  { id: VisualStyle.VIBRANT, icon: Zap, label: 'Vivos', color: 'bg-rose-500/10 text-rose-200 border-rose-500/30' },
];
