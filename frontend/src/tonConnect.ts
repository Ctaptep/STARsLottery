import { TonConnect } from '@tonconnect/sdk';

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        initData: string;
        initDataUnsafe: {
          user?: {
            id: number;
            first_name?: string;
            last_name?: string;
            username?: string;
            language_code?: string;
            is_premium?: boolean;
            allows_write_to_pm?: boolean;
          };
          start_param?: string;
          chat_type?: string;
          chat_instance?: string;
        };
        version: string;
        platform: string;
        colorScheme: string;
        themeParams: Record<string, string>;
        isExpanded: boolean;
        viewportHeight: number;
        viewportStableHeight: number;
        headerColor: string;
        backgroundColor: string;
        isClosingConfirmationEnabled: boolean;
        BackButton: {
          isVisible: boolean;
          show: () => void;
          hide: () => void;
          onClick: (callback: () => void) => void;
          offClick: (callback: () => void) => void;
        };
        MainButton: {
          text: string;
          color: string;
          textColor: string;
          isVisible: boolean;
          isActive: boolean;
          isProgressVisible: boolean;
          setText: (text: string) => void;
          onClick: (callback: () => void) => void;
          show: () => void;
          hide: () => void;
          enable: () => void;
          disable: () => void;
          showProgress: (leaveActive?: boolean) => void;
          hideProgress: () => void;
          setParams: (params: {
            text?: string;
            color?: string;
            text_color?: string;
            is_active?: boolean;
            is_visible?: boolean;
          }) => void;
        };
        showPopup: (params: {
          title?: string;
          message: string;
          buttons?: Array<{
            id?: string;
            type?: 'default' | 'ok' | 'close' | 'cancel' | 'destructive';
            text: string;
          }>;
        }) => void;
        showAlert: (message: string, callback?: () => void) => void;
        showConfirm: (message: string, callback?: (confirmed: boolean) => void) => void;
        close: () => void;
        ready: () => void;
        expand: () => void;
        isVersionAtLeast: (version: string) => boolean;
        setHeaderColor: (color: string) => void;
        setBackgroundColor: (color: string) => void;
        enableClosingConfirmation: () => void;
        disableClosingConfirmation: () => void;
        onEvent: (eventType: string, eventHandler: Function) => void;
        offEvent: (eventType: string, eventHandler: Function) => void;
        sendData: (data: string) => void;
        switchInlineQuery: (query: string, choose_chat_types?: string[]) => void;
      };
    };
  }
}

// Check if we're in Telegram WebView environment
const isTelegramWebView = typeof window !== 'undefined' && 
  !!window.Telegram?.WebApp;

// Initialize TON Connect with proper options for Telegram Mini App
export const tonConnect = new TonConnect({
  manifestUrl: 'https://starslottery-fronend-production.up.railway.app/tonconnect-manifest.json'
});

// Single source of truth for Telegram initialization check
export const isTelegramInitialized = isTelegramWebView && 
  !!window.Telegram?.WebApp?.initDataUnsafe?.user;

// Helper to get wallet from Telegram WebApp environment
export const getWalletFromTelegram = async () => {
  if (!isTelegramInitialized) {
    console.error('[TON] Telegram WebApp is not initialized');
    return null;
  }

  try {
    const initData = window.Telegram?.WebApp?.initDataUnsafe;
    if (!initData) {
      console.error('[TON] No initData available');
      return null;
    }
    
    console.log('[TON] Telegram initData:', initData);
    
    // Check if we have a wallet in start_param (e.g., from a deeplink)
    if (initData.start_param?.startsWith('tonconnect-')) {
      const walletAddress = initData.start_param.replace('tonconnect-', '');
      return { account: { address: walletAddress } };
    }
    
    return null;
  } catch (error) {
    console.error('[TON] Error getting wallet from Telegram:', error);
    return null;
  }
};

// Initialize Telegram WebApp
export const initTelegramWebApp = () => {
  if (typeof window === 'undefined' || !window.Telegram?.WebApp) {
    console.warn('Telegram WebApp not available');
    return;
  }

  const tg = window.Telegram.WebApp;
  
  // Expand the app to full view
  tg.expand();
  
  // Enable closing confirmation
  tg.enableClosingConfirmation();
  
  // Set up back button
  if (tg.BackButton) {
    tg.BackButton.show();
    const backHandler = () => {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        tg.close();
      }
    };
    tg.BackButton.onClick(backHandler);
    
    // Cleanup on unmount
    return () => {
      if (tg.BackButton) {
        tg.BackButton.offClick(backHandler);
      }
    };
  }
};

// Log connection status changes
tonConnect.onStatusChange((wallet) => {
  console.log('[TON] Connection status changed:', wallet ? 'connected' : 'disconnected');
  console.log('[TON] Wallet details:', wallet);
  
  // Force UI update when wallet connection changes
  if (window.dispatchEvent) {
    window.dispatchEvent(new Event('tonconnect_ui_update_needed'));
  }
});

// Initialize Telegram WebApp
if (isTelegramWebView) {
  try {
    console.log('[Telegram] Initializing WebApp...');
    
    // Initialize WebApp
    const { WebApp } = window.Telegram!;
    WebApp.ready();
    WebApp.expand();
    
    // Log Telegram WebApp info
    console.log('[Telegram] WebApp version:', WebApp.version);
    console.log('[Telegram] Platform:', WebApp.platform);
    console.log('[Telegram] Init data:', WebApp.initData);
    console.log('[Telegram] Init data unsafe:', WebApp.initDataUnsafe);
    
    // Enable closing confirmation
    WebApp.enableClosingConfirmation();
    
    // Handle back button
    WebApp.BackButton.onClick(() => {
      WebApp.close();
    });
    
    console.log('[Telegram] WebApp initialized successfully');
  } catch (error) {
    console.error('[Telegram] Error initializing WebApp:', error);
  }
}

// Log initial connection state
console.log('[TON] TON Connect initialized for Telegram Mini App');
console.log('[TON] Telegram WebApp initialized:', isTelegramInitialized);
