
export enum ContentType {
  PRODUCT = 'Foto de Producto',
  LIFESTYLE = 'Foto Lifestyle',
  PROMO = 'Promoción / Descuento',
  LAUNCH = 'Lanzamiento',
  TESTIMONIAL = 'Testimonio',
  BRANDING = 'Branding'
}

export enum Platform {
  IG_FEED = 'Instagram Feed',
  IG_STORIES = 'Instagram Stories',
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
  ECOMMERCE = 'Fondo Blanco (E-commerce)'
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
  name: string;
  benefit: string;
  price?: string;
  promoDetails?: string;
  targetAudience: string; // Specific to this campaign (optional override)
  baseImage?: string; // Base64 string
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
  copy: string;
  hashtags: string[];
  angle: string; // Description of the angle/variant type
}

export interface CampaignResult {
  id: string;
  timestamp: number;
  variants: ContentVariant[];
  platform: Platform;
}
