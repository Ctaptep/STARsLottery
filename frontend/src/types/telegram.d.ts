// Глобальное объявление для window.Telegram.WebApp
interface TelegramWebApp {
  initData: string;
  initDataUnsafe: any;
  platform: string;
  version: string;
  isExpanded: boolean;
  expand: () => void;
  close: () => void;
  onEvent: (eventType: string, callback: (...args: any[]) => void) => void;
  offEvent: (eventType: string, callback: (...args: any[]) => void) => void;
  sendData: (data: string) => void;
  MainButton: any;
  BackButton: any;
  HapticFeedback: any;
  showAlert: (message: string, callback?: () => void) => void;
  showConfirm: (message: string, callback: (ok: boolean) => void) => void;
}

interface TelegramNamespace {
  WebApp: TelegramWebApp;
}

declare global {
  interface Window {
    Telegram?: TelegramNamespace;
  }
}

export {};
