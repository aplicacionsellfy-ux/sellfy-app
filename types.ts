
export enum ContentType {
  PRODUCT = 'Foto de Producto',
  LIFESTYLE = 'Foto Lifestyle',
  PROMO = 'Promoción / Descuento',
  LAUNCH = 'Lanzamiento',
  TESTIMONIAL = 'Testimonio',
  BRANDING = 'Branding',
  VIDEO_REEL = 'Video Reel / TikTok'
}

export enum Platform {
  IG_FEED = 'Instagram Feed',
  IG_STORIES = 'Instagram Stories',
  IG_REELS = 'Instagram Reels',
  TIKTOK = 'TikTok',
  FB_FEED = 'Facebook Feed',
  FB_ADS = 'Facebook Ads',
  WA_CATALOG = 'WhatsApp Catalog'
}

export enum VisualStyle {
  MINIMAL = 'Minimalista',
  PREMIUM = 'Premium / Lujo',
  NATURAL = 'Natural / Orgánico',
  CREATIVE = 'Creativo / Colorido',
  DARK = 'Oscuro / Elegante',
  VIBRANT = 'Colores Vivos',
  ECOMMERCE = 'Fondo Blanco (E-commerce)',
  CINEMATIC = 'Cinemático (Video)'
}

export enum CopyFramework {
  AIDA = 'AIDA',
  PAS = 'PAS',
  FAB = 'FAB',
  AIDCA = 'AIDCA'
}

export type PlanTier = 'free' | 'starter' | 'pro';

export interface PlanDetails {
  id: PlanTier;
  name: string;
  price: string;
  credits: number;
  features: string[];
  popular?: boolean;
}

export interface BusinessSettings {
  name: string;
  industry: string;
  tone: string;
  website: string;
  targetAudience: string;
  primaryColor: string;
  secondaryColor: string;
}

export interface UserSubscription {
  plan: PlanTier;
  credits: number;
  maxCredits: number;
}

export interface ProductData {
  baseImage?: string; // Base64 string
  userPrompt: string; // Instrucción directa del usuario para la imagen
}

export interface WizardState {
  step: number;
  contentType: ContentType | null;
  platform: Platform | null;
  visualStyle: VisualStyle | null;
  productData: ProductData;
}

export interface ContentVariant {
  id: string;
  image: string; // Base64 image URI
  isVideo?: boolean; 
  copy: string;
  hashtags: string[];
  angle: string;
  debugPrompt?: string;
}

export interface CampaignResult {
  id: string;
  timestamp: number;
  variants: ContentVariant[];
  platform: Platform;
}
