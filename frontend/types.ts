
export interface User {
  id: string;
  email: string;
  username: string;
  password?: string;
  role: 'admin' | 'user';
  language: 'en' | 'ru';
  createdAt: number;
  isBlocked?: boolean;
}

export interface CarouselItem {
  id: string;
  imageUrl: string;
  description: string;
  fullPrompt?: string;
}

export interface CarouselPost {
  id: string;
  topic: string;
  images: CarouselItem[];
  caption: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  timestamp: number;
}

export type TextService = 'google' | 'openrouter';
export type ImageService = 'google' | 'kie';
export type GoogleModel = 'gemini-2.5-flash-image' | 'gemini-3-pro-image-preview';

export interface SystemInstructions {
  imageGenerator: string;
  captionGenerator: string;
}

export interface GenerationSettings {
  textService: TextService;
  imageService: ImageService;
  googleModel: GoogleModel;
  openrouterModel: string;
  count: number;
  style: string;
  aspectRatio: string;
  customStylePrompt: string;
  referenceImages: string[];
}

export interface TelegramSettings {
  botToken: string;
  channelId: string;
}

export interface KieSettings {
  model: string;
  apiKey: string;
}

export interface GoogleSettings {
  apiKey: string;
}

export interface OpenRouterSettings {
  apiKey: string;
}

export type Language = 'en' | 'ru';

export enum AppState {
  API_KEY_REQUIRED = 'API_KEY_REQUIRED',
  READY = 'READY',
  AUTH = 'AUTH'
}
