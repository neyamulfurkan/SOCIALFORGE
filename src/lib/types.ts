import type { Prisma, ActivityType } from '@prisma/client';

// ─────────────────────────────────────────────
// CART
// ─────────────────────────────────────────────

export type CartItem = {
  productId: string;
  productName: string;
  price: number;
  quantity: number;
  variantLabel?: string;
  imageUrl?: string;
  slug: string;
};

export type CartState = {
  items: CartItem[];
  businessId: string;
  storeSlug: string;
};

// ─────────────────────────────────────────────
// UI
// ─────────────────────────────────────────────

export type UIState = {
  drawerOpen: boolean;
  drawerType: 'product' | 'order' | 'post' | null;
  drawerId: string | null;
  chatbotOpen: boolean;
  searchOpen: boolean;
  activeOrderId: string | null;
};

export type ToastItem = {
  id: string;
  variant: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration: number;
};

// ─────────────────────────────────────────────
// STORE / BUSINESS CONFIG
// ─────────────────────────────────────────────

export type BusinessConfigShape = {
  chatbotPersonality: string;
  chatbotWelcomeMessage: string;
  chatbotLanguage: string;
  knowledgeBase: Array<{ question: string; answer: string }>;
  deliveryCharge: number;
  freeDeliveryThreshold: number | null;
  deliveryTimeMessage: string | null;
  cashOnDelivery: boolean;
  bkashNumber: string | null;
  bkashInstructions: string | null;
  nagadNumber: string | null;
  nagadInstructions: string | null;
  stripePublicKey: string | null;
  stripeSecretKey: string | null;
  facebookPageId: string | null;
  facebookPageToken: string | null;
  instagramAccountId: string | null;
  messengerEnabled: boolean;
  socialAutoApprove: boolean;
  defaultPostTime: string;
  notificationEmail: string | null;
  notifyOnOrder: boolean;
  notifyOnMessage: boolean;
};

export type StoreConfig = {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  tagline?: string;
  accentColor: string;
  heroImages?: string[];
  domain?: string;
  config: BusinessConfigShape;
};

// ─────────────────────────────────────────────
// PRISMA PAYLOAD TYPES
// ─────────────────────────────────────────────

export type ProductWithVariants = Prisma.ProductGetPayload<{
  include: { variants: true };
}>;

export type OrderWithItems = Prisma.OrderGetPayload<{
  include: { items: { include: { product: true } } };
}>;

export type ConversationWithMessages = Prisma.MessengerConversationGetPayload<{
  include: { messages: true };
}>;

export type PostWithBusiness = Prisma.SocialPostGetPayload<{
  include: { business: true };
}>;

export type BusinessWithConfig = Prisma.BusinessGetPayload<{
  include: { config: true; owner: true };
}>;

// ─────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────

export type DashboardStats = {
  todayOrders: number;
  revenueThisMonth: number;
  activeConversations: number;
  pendingPosts: number;
  ordersDelta: number;
  revenueDelta: number;
};

export type ActivityItem = {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  timestamp: Date;
  actionUrl?: string;
  actionLabel?: string;
  metadata?: Record<string, unknown>;
};

// ─────────────────────────────────────────────
// CHATBOT / MESSAGING
// ─────────────────────────────────────────────

export type ProductCard = {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
  slug: string;
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  products?: ProductCard[];
};

// ─────────────────────────────────────────────
// API RESPONSES
// ─────────────────────────────────────────────

export type ApiResponse<T> = {
  data?: T;
  error?: string;
  code?: string;
};

export type PaginatedResponse<T> = {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
};

// ─────────────────────────────────────────────
// ADMIN
// ─────────────────────────────────────────────

export type AdminBusinessRow = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  createdAt: Date;
  orderCount: number;
  totalRevenue: number;
  lastActive: Date | null;
  ownerEmail: string | null;
};

export type FeatureFlag = {
  key: string;
  label: string;
  enabled: boolean;
  businessOverrides: Array<{ businessId: string; enabled: boolean }>;
};

// ─────────────────────────────────────────────
// ONBOARDING
// ─────────────────────────────────────────────

export type OnboardingState = {
  storeName: string;
  categories: string[];
  personality: string;
  language: string;
  delivery: string;
  payments: {
    bkash?: string;
    nagad?: string;
    cod: boolean;
  };
  facebookConnected: boolean;
};

// ─────────────────────────────────────────────
// PLATFORM CONFIG
// ─────────────────────────────────────────────

export type ColorScheme = {
  id: string;
  name: string;
  category: string;
  accent: string;
  accentHover: string;
  accentText: string;
  bg: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
};

export type PlatformConfigKey =
  | 'GROQ_KEY_CHATBOT'
  | 'GROQ_KEY_DESCRIPTIONS'
  | 'GROQ_KEY_SOCIAL'
  | 'GROQ_KEY_MESSENGER'
  | 'CLOUDINARY_CLOUD_NAME'
  | 'CLOUDINARY_API_KEY'
  | 'CLOUDINARY_API_SECRET'
  | 'RESEND_API_KEY'
  | 'STRIPE_PLATFORM_KEY';