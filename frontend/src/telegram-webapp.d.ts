// Type definitions for Telegram WebApp
// Project: https://core.telegram.org/bots/webapps

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        // Core Methods
        initData: string;
        initDataUnsafe: {
          user?: TelegramUser;
          start_param?: string;
          query_id?: string;
          auth_date?: number;
          hash: string;
        };
        version: string;
        platform: string;
        colorScheme: 'light' | 'dark';
        themeParams: Record<string, string>;
        isExpanded: boolean;
        viewportHeight: number;
        viewportStableHeight: number;
        headerColor: string;
        backgroundColor: string;
        isClosingConfirmationEnabled: boolean;
        
        // Methods
        ready: () => void;
        expand: () => void;
        close: () => void;
        onEvent: (eventType: string, eventHandler: () => void) => void;
        offEvent: (eventType: string, eventHandler: () => void) => void;
        sendData: (data: string) => void;
        switchInlineQuery: (query: string, choose_chat_types?: string[]) => void;
        openLink: (url: string, options?: { try_instant_view?: boolean }) => void;
        openTelegramLink: (url: string) => void;
        setHeaderColor: (color: string) => void;
        setBackgroundColor: (color: string) => void;
        enableClosingConfirmation: () => void;
        disableClosingConfirmation: () => void;
        
        // Back Button
        BackButton: {
          show: () => void;
          hide: () => void;
          onClick: (callback: () => void) => void;
          offClick: (callback: () => void) => void;
          showProgress: (leaveActive?: boolean) => void;
          isVisible: boolean;
        };
        
        // Main Button
        MainButton: {
          show: () => void;
          hide: () => void;
          enable: () => void;
          disable: () => void;
          showProgress: (leaveActive?: boolean) => void;
          hideProgress: () => void;
          setText: (text: string) => void;
          onClick: (callback: () => void) => void;
          offClick: (callback: () => void) => void;
          setParams: (params: {
            color?: string;
            text_color?: string;
            is_active?: boolean;
            is_visible?: boolean;
            text?: string;
            progress?: boolean;
          }) => void;
          text: string;
          color: string;
          textColor: string;
          isActive: boolean;
          isVisible: boolean;
          isProgressVisible: boolean;
        };
        
        // Haptic Feedback
        HapticFeedback: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
          selectionChanged: () => void;
        };
        
        // Cloud Storage
        CloudStorage: {
          setItem: (key: string, value: string, callback?: (error: Error | null) => void) => void;
          getItem: (key: string, callback: (error: Error | null, value: string | null) => void) => void;
          getItems: (keys: string[], callback: (error: Error | null, values: Record<string, string>) => void) => void;
          removeItem: (key: string, callback?: (error: Error | null) => void) => void;
          removeItems: (keys: string[], callback?: (error: Error | null) => void) => void;
          getKeys: (callback: (error: Error | null, keys: string[]) => void) => void;
        };
      };
    };
  }
}

interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  allows_write_to_pm?: boolean;
}

export {};
