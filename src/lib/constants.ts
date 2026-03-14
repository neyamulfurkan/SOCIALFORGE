// src/lib/constants.ts

export const STATUS_LABELS: Record<string, string> = {
  NEW: 'New',
  CONFIRMED: 'Confirmed',
  PROCESSING: 'Processing',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  BKASH: 'bKash',
  NAGAD: 'Nagad',
  STRIPE: 'Card',
  COD: 'Cash on Delivery',
};

export const CHANNEL_LABELS: Record<string, string> = {
  WEBSITE: 'Website',
  MESSENGER: 'Messenger',
  MANUAL: 'Manual',
};

export const FULFILLMENT_STATUS_FLOW: string[] = [
  'NEW',
  'CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
];

export const PRODUCT_CATEGORIES: string[] = [
  'Fashion & Clothing',
  'Cosmetics & Beauty',
  'Food & Beverage',
  'Electronics',
  'Home & Lifestyle',
  'Health & Wellness',
  'Kids & Baby',
  'Sports & Fitness',
  'Books & Stationery',
  'Other',
];

export const POST_STATUS_LABELS: Record<string, string> = {
  PENDING_REVIEW: 'Pending Review',
  SCHEDULED: 'Scheduled',
  POSTING: 'Posting',
  LIVE: 'Live',
  FAILED: 'Failed',
  REJECTED: 'Rejected',
};

export const ACTIVITY_TYPE_ICONS: Record<string, { icon: string; color: string }> = {
  ORDER_NEW: { icon: 'ShoppingBag', color: 'text-success' },
  ORDER_STATUS_CHANGE: { icon: 'RefreshCw', color: 'text-accent' },
  MESSENGER_MESSAGE: { icon: 'MessageCircle', color: 'text-blue-400' },
  POST_LIVE: { icon: 'Globe', color: 'text-success' },
  POST_FAILED: { icon: 'AlertCircle', color: 'text-error' },
  STOCK_LOW: { icon: 'AlertTriangle', color: 'text-warning' },
  SYSTEM: { icon: 'Settings', color: 'text-text-secondary' },
};

export const AI_MODELS = {
  CHAT: 'llama-3.3-70b-versatile',
  DESCRIPTION: 'llama-3.3-70b-versatile',
  SOCIAL: 'llama-3.3-70b-versatile',
  MESSENGER: 'llama-3.3-70b-versatile',
} as const;

export const CACHE_TTL = {
  CONFIG: 300,
  FLAGS: 300,
  MESSENGER_SESSION: 86400,
} as const;

export const RATE_LIMITS = {
  PRODUCTS: { limit: 100, window: 60 },
  ORDERS: { limit: 60, window: 60 },
  AI: { limit: 20, window: 60 },
  CHATBOT: { limit: 30, window: 60 },
} as const;

export const ORDER_NUMBER_PREFIX = 'SF';

export const IMAGE_TRANSFORMS = {
  PRODUCT: 'c_fill,ar_3:4,f_auto,q_auto',
  INSTAGRAM_SQUARE: 'c_fill,ar_1:1,f_auto,q_auto',
  INSTAGRAM_PORTRAIT: 'c_fill,ar_4:5,f_auto,q_auto',
  FACEBOOK_SQUARE: 'c_fill,ar_1:1,f_auto,q_auto',
  FACEBOOK_WIDE: 'c_fill,ar_16:9,f_auto,q_auto',
} as const;

export const COLOR_SCHEMES: Array<{
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
}> = [
  {
    id: 'violet',
    name: 'Royal Violet',
    category: 'Popular',
    accent: '#7c3aed',
    accentHover: '#6d28d9',
    accentText: '#ffffff',
    bg: '#fafaf9',
    surface: '#ffffff',
    surfaceRaised: '#f5f5f4',
    border: '#e5e5e2',
    textPrimary: '#1c1c1a',
    textSecondary: '#6b6b66',
    textTertiary: '#a8a8a3',
  },
  {
    id: 'rose',
    name: 'Rose Pink',
    category: 'Popular',
    accent: '#e11d48',
    accentHover: '#be123c',
    accentText: '#ffffff',
    bg: '#fff9f9',
    surface: '#ffffff',
    surfaceRaised: '#fef2f2',
    border: '#fecdd3',
    textPrimary: '#1c1c1a',
    textSecondary: '#6b6b66',
    textTertiary: '#a8a8a3',
  },
  {
    id: 'fuchsia',
    name: 'Fuchsia',
    category: 'Popular',
    accent: '#d946ef',
    accentHover: '#c026d3',
    accentText: '#ffffff',
    bg: '#fdf9ff',
    surface: '#ffffff',
    surfaceRaised: '#fdf4ff',
    border: '#f5d0fe',
    textPrimary: '#1c1c1a',
    textSecondary: '#6b6b66',
    textTertiary: '#a8a8a3',
  },
  {
    id: 'ocean',
    name: 'Ocean Blue',
    category: 'Cool',
    accent: '#0ea5e9',
    accentHover: '#0284c7',
    accentText: '#ffffff',
    bg: '#f9fbff',
    surface: '#ffffff',
    surfaceRaised: '#f0f9ff',
    border: '#bae6fd',
    textPrimary: '#1c1c1a',
    textSecondary: '#6b6b66',
    textTertiary: '#a8a8a3',
  },
  {
    id: 'indigo',
    name: 'Deep Indigo',
    category: 'Cool',
    accent: '#4f46e5',
    accentHover: '#4338ca',
    accentText: '#ffffff',
    bg: '#fafafa',
    surface: '#ffffff',
    surfaceRaised: '#eef2ff',
    border: '#c7d2fe',
    textPrimary: '#1c1c1a',
    textSecondary: '#6b6b66',
    textTertiary: '#a8a8a3',
  },
  {
    id: 'teal',
    name: 'Teal',
    category: 'Cool',
    accent: '#0d9488',
    accentHover: '#0f766e',
    accentText: '#ffffff',
    bg: '#f9fffe',
    surface: '#ffffff',
    surfaceRaised: '#f0fdfa',
    border: '#99f6e4',
    textPrimary: '#1c1c1a',
    textSecondary: '#6b6b66',
    textTertiary: '#a8a8a3',
  },
  {
    id: 'emerald',
    name: 'Emerald',
    category: 'Nature',
    accent: '#059669',
    accentHover: '#047857',
    accentText: '#ffffff',
    bg: '#f9fffc',
    surface: '#ffffff',
    surfaceRaised: '#ecfdf5',
    border: '#a7f3d0',
    textPrimary: '#1c1c1a',
    textSecondary: '#6b6b66',
    textTertiary: '#a8a8a3',
  },
  {
    id: 'lime',
    name: 'Lime Green',
    category: 'Nature',
    accent: '#65a30d',
    accentHover: '#4d7c0f',
    accentText: '#ffffff',
    bg: '#fafff0',
    surface: '#ffffff',
    surfaceRaised: '#f7fee7',
    border: '#d9f99d',
    textPrimary: '#1c1c1a',
    textSecondary: '#6b6b66',
    textTertiary: '#a8a8a3',
  },
  {
    id: 'amber',
    name: 'Amber',
    category: 'Warm',
    accent: '#d97706',
    accentHover: '#b45309',
    accentText: '#ffffff',
    bg: '#fffdf5',
    surface: '#ffffff',
    surfaceRaised: '#fffbeb',
    border: '#fde68a',
    textPrimary: '#1c1c1a',
    textSecondary: '#6b6b66',
    textTertiary: '#a8a8a3',
  },
  {
    id: 'orange',
    name: 'Sunset Orange',
    category: 'Warm',
    accent: '#ea580c',
    accentHover: '#c2410c',
    accentText: '#ffffff',
    bg: '#fffaf5',
    surface: '#ffffff',
    surfaceRaised: '#fff7ed',
    border: '#fed7aa',
    textPrimary: '#1c1c1a',
    textSecondary: '#6b6b66',
    textTertiary: '#a8a8a3',
  },
  {
    id: 'crimson',
    name: 'Crimson',
    category: 'Warm',
    accent: '#dc2626',
    accentHover: '#b91c1c',
    accentText: '#ffffff',
    bg: '#fffafa',
    surface: '#ffffff',
    surfaceRaised: '#fef2f2',
    border: '#fecaca',
    textPrimary: '#1c1c1a',
    textSecondary: '#6b6b66',
    textTertiary: '#a8a8a3',
  },
  {
    id: 'slate',
    name: 'Slate',
    category: 'Neutral',
    accent: '#475569',
    accentHover: '#334155',
    accentText: '#ffffff',
    bg: '#f9fafb',
    surface: '#ffffff',
    surfaceRaised: '#f1f5f9',
    border: '#e2e8f0',
    textPrimary: '#1c1c1a',
    textSecondary: '#6b6b66',
    textTertiary: '#a8a8a3',
  },
  {
    id: 'noir',
    name: 'Noir',
    category: 'Neutral',
    accent: '#18181b',
    accentHover: '#09090b',
    accentText: '#ffffff',
    bg: '#fafafa',
    surface: '#ffffff',
    surfaceRaised: '#f4f4f5',
    border: '#e4e4e7',
    textPrimary: '#18181b',
    textSecondary: '#6b6b66',
    textTertiary: '#a8a8a3',
  },
  {
    id: 'gold',
    name: 'Royal Gold',
    category: 'Luxury',
    accent: '#a16207',
    accentHover: '#854d0e',
    accentText: '#ffffff',
    bg: '#fffdf0',
    surface: '#ffffff',
    surfaceRaised: '#fefce8',
    border: '#fef08a',
    textPrimary: '#1c1c1a',
    textSecondary: '#6b6b66',
    textTertiary: '#a8a8a3',
  },
  {
    id: 'plum',
    name: 'Plum',
    category: 'Luxury',
    accent: '#7e22ce',
    accentHover: '#6b21a8',
    accentText: '#ffffff',
    bg: '#fdfaff',
    surface: '#ffffff',
    surfaceRaised: '#faf5ff',
    border: '#e9d5ff',
    textPrimary: '#1c1c1a',
    textSecondary: '#6b6b66',
    textTertiary: '#a8a8a3',
  },
  {
    id: 'coral',
    name: 'Coral',
    category: 'Popular',
    accent: '#f43f5e',
    accentHover: '#e11d48',
    accentText: '#ffffff',
    bg: '#fff9f9',
    surface: '#ffffff',
    surfaceRaised: '#fff1f2',
    border: '#fecdd3',
    textPrimary: '#1c1c1a',
    textSecondary: '#6b6b66',
    textTertiary: '#a8a8a3',
  },
];

export const CHATBOT_PERSONALITIES: Array<{
  id: string;
  name: string;
  description: string;
  systemPromptHint: string;
}> = [
  {
    id: 'friendly',
    name: 'Friendly',
    description: 'Warm and approachable',
    systemPromptHint: 'You are friendly, warm, and approachable.',
  },
  {
    id: 'professional',
    name: 'Professional',
    description: 'Formal and trustworthy',
    systemPromptHint: 'You are professional, formal, and trustworthy.',
  },
  {
    id: 'playful',
    name: 'Playful',
    description: 'Fun and energetic',
    systemPromptHint: 'You are playful, fun, and energetic.',
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Direct and concise',
    systemPromptHint: 'You are direct, concise, and efficient.',
  },
];