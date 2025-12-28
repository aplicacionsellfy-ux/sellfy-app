
import { ContentType, Platform, VisualStyle, PlanDetails, CopyFramework } from './types';
import { Camera, Zap, Tag, Rocket, Briefcase, Instagram, Facebook, MessageCircle, Layout, Star, Sun, Palette, Moon, Box, Video, PlayCircle, Coffee, Mountain, Hexagon, Droplets, Percent, Flame, Clock, Leaf, Gem, Layers, Aperture, Anchor, Cloud } from 'lucide-react';

export const CREDIT_COSTS = {
  IMAGE: 1,
  VIDEO: 5
};

export const COPY_FRAMEWORKS = [
  {
    id: CopyFramework.AIDA,
    label: 'AIDA',
    title: 'Atención - Interés - Deseo - Acción',
    desc: 'El clásico infalible. Atrapa la mirada y guía hacia la compra.'
  },
  {
    id: CopyFramework.PAS,
    label: 'PAS',
    title: 'Problema - Agitación - Solución',
    desc: 'Enfócate en el dolor del cliente y presenta tu producto como el alivio.'
  },
  {
    id: CopyFramework.FAB,
    label: 'FAB',
    title: 'Características - Ventajas - Beneficios',
    desc: 'Transforma especificaciones técnicas en razones emocionales para comprar.'
  },
  {
    id: CopyFramework.AIDCA,
    label: 'AIDCA',
    title: 'AIDA + Convicción',
    desc: 'Añade una capa de prueba social o garantía para eliminar dudas.'
  }
];

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
  { id: VisualStyle.NATURAL, icon: Leaf, label: 'Natural', color: 'bg-emerald-500/10 text-emerald-200 border-emerald-500/30' },
  { id: VisualStyle.CINEMATIC, icon: Aperture, label: 'Cinemático', color: 'bg-indigo-500/10 text-indigo-200 border-indigo-500/30' },
  { id: VisualStyle.CREATIVE, icon: Palette, label: 'Creativo', color: 'bg-purple-500/10 text-purple-200 border-purple-500/30' },
  { id: VisualStyle.DARK, icon: Moon, label: 'Oscuro', color: 'bg-slate-950 text-white border-slate-700' },
  { id: VisualStyle.VIBRANT, icon: Zap, label: 'Vivos', color: 'bg-rose-500/10 text-rose-200 border-rose-500/30' },
];

// SCENE PRESETS INTELIGENTES
// Ahora incluyen la propiedad 'styles' para filtrar según la selección anterior
export const SCENE_PRESETS = [
  // --- MINIMALISTA ---
  { 
    id: 'studio_clean', 
    label: 'Estudio Puro', 
    icon: Box, 
    styles: [VisualStyle.MINIMAL, VisualStyle.PREMIUM, VisualStyle.ECOMMERCE],
    prompt: 'Professional studio photography, solid clean background, soft box lighting, high detail product shot, 8k resolution, minimalist.',
    color: 'bg-gray-100 text-gray-800'
  },
  { 
    id: 'soft_shadow', 
    label: 'Sombra Suave', 
    icon: Cloud, 
    styles: [VisualStyle.MINIMAL, VisualStyle.NATURAL],
    prompt: 'Product placed on a pristine white surface with a soft, natural window shadow (gobo) cast across, morning light, airy and clean aesthetic.',
    color: 'bg-slate-100 text-slate-700'
  },
  { 
    id: 'geometric_podium', 
    label: 'Podio Geométrico', 
    icon: Layers, 
    styles: [VisualStyle.MINIMAL, VisualStyle.CREATIVE],
    prompt: 'Product on a simple pastel colored geometric cylinder podium, minimal composition, studio lighting, clean lines, architectural vibe.',
    color: 'bg-indigo-50 text-indigo-900'
  },

  // --- PREMIUM / LUJO ---
  { 
    id: 'luxury_marble', 
    label: 'Mármol Negro', 
    icon: Hexagon, 
    styles: [VisualStyle.PREMIUM, VisualStyle.DARK],
    prompt: 'Product placed on a luxurious black marble countertop with white veins, dramatic rim lighting, elegant reflections, premium expensive vibe.',
    color: 'bg-stone-900 text-stone-200'
  },
  { 
    id: 'gold_accents', 
    label: 'Oro y Seda', 
    icon: Gem, 
    styles: [VisualStyle.PREMIUM, VisualStyle.CINEMATIC],
    prompt: 'Product resting on flowing silk fabric with blurred golden bokeh lights in the background, warm rich tones, high-end commercial photography.',
    color: 'bg-amber-900 text-amber-100'
  },
  { 
    id: 'glass_reflection', 
    label: 'Vidrio y Reflejo', 
    icon: Star, 
    styles: [VisualStyle.PREMIUM, VisualStyle.MINIMAL],
    prompt: 'Product floating on a reflective glass surface, dark gradient background, sharp crisp lighting, sleek and modern look.',
    color: 'bg-slate-800 text-slate-300'
  },

  // --- NATURAL / ORGÁNICO ---
  { 
    id: 'nature_rock', 
    label: 'Roca Zen', 
    icon: Mountain, 
    styles: [VisualStyle.NATURAL, VisualStyle.MINIMAL],
    prompt: 'Product balanced on a smooth river stone, soft moss details, blurred forest background, natural daylight, organic and fresh look.',
    color: 'bg-emerald-800 text-emerald-100'
  },
  { 
    id: 'wooden_table', 
    label: 'Madera Rústica', 
    icon: Coffee, 
    styles: [VisualStyle.NATURAL],
    prompt: 'Product on a textured wooden table, sun dappled light filtering through leaves, warm and cozy rustic atmosphere.',
    color: 'bg-amber-800 text-amber-100'
  },
  { 
    id: 'water_splash', 
    label: 'Agua Fresca', 
    icon: Droplets, 
    styles: [VisualStyle.NATURAL, VisualStyle.VIBRANT, VisualStyle.CREATIVE],
    prompt: 'Product surrounded by crystal clear water ripples and droplets, blue gradient background, crisp lighting, energetic and refreshing.',
    color: 'bg-sky-200 text-sky-900'
  },
  { 
    id: 'beach_sand', 
    label: 'Arena de Playa', 
    icon: Sun, 
    styles: [VisualStyle.NATURAL],
    prompt: 'Product placed on warm white sand, bright sunlight, subtle shadow of a palm leaf, summer beach vibe.',
    color: 'bg-orange-100 text-orange-800'
  },

  // --- CREATIVO / VIBRANTE ---
  { 
    id: 'neon_cyber', 
    label: 'Cyber Neón', 
    icon: Zap, 
    styles: [VisualStyle.CREATIVE, VisualStyle.DARK, VisualStyle.VIBRANT],
    prompt: 'Product in a dark environment illuminated by pink and blue neon lights, cyberpunk aesthetic, high contrast, futuristic glow.',
    color: 'bg-purple-900 text-purple-100'
  },
  { 
    id: 'color_pop', 
    label: 'Color Pop', 
    icon: Palette, 
    styles: [VisualStyle.CREATIVE, VisualStyle.VIBRANT],
    prompt: 'Product against a solid vibrant background (yellow or pink) with contrasting colorful geometric props, memphis style, pop art aesthetic.',
    color: 'bg-pink-500 text-white'
  },
  { 
    id: 'floating_elements', 
    label: 'Gravedad Cero', 
    icon: Cloud, 
    styles: [VisualStyle.CREATIVE, VisualStyle.CINEMATIC],
    prompt: 'Product floating in mid-air, surrounded by floating abstract shapes or ingredients, dynamic composition, surreal and magical.',
    color: 'bg-indigo-600 text-white'
  },

  // --- CINEMÁTICO / DARK ---
  { 
    id: 'moody_window', 
    label: 'Ventana Lluviosa', 
    icon: Moon, 
    styles: [VisualStyle.CINEMATIC, VisualStyle.DARK],
    prompt: 'Product sitting near a window with rain droplets on glass, moody blue evening light, cinematic bokeh, emotional atmosphere.',
    color: 'bg-slate-900 text-slate-300'
  },
  { 
    id: 'spotlight_drama', 
    label: 'Spotlight', 
    icon: Aperture, 
    styles: [VisualStyle.DARK, VisualStyle.CINEMATIC, VisualStyle.PREMIUM],
    prompt: 'Product centered in a pitch black room, hit by a single dramatic spotlight beam, high contrast, mysterious and elegant.',
    color: 'bg-black text-white'
  }
];

// ETIQUETAS DE VENTA RÁPIDA
export const PROMO_BADGES = [
  { id: 'none', label: 'Sin Oferta', icon: Box, text: null },
  { id: 'sale', label: 'Sale', icon: Tag, text: 'SALE' },
  { id: 'new', label: 'Nuevo', icon: Star, text: 'NEW ARRIVAL' },
  { id: '20_off', label: '20% OFF', icon: Percent, text: '20% OFF' },
  { id: '30_off', label: '30% OFF', icon: Percent, text: '30% OFF' },
  { id: '50_off', label: '50% OFF', icon: Flame, text: '50% OFF' },
  { id: 'limited', label: 'Limitado', icon: Clock, text: 'LIMITED EDITION' },
  { id: 'free_ship', label: 'Envío Gratis', icon: Rocket, text: 'FREE SHIPPING' }
];
