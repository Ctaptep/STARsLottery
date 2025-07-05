// TON Connect integration for Telegram Mini App
import { TonConnect } from '@tonconnect/sdk';

declare global {
  interface Window {
    Telegram?: {
      WebApp: any;
    };
  }
}

// Check if we're in Telegram WebView
const isTelegramWebView = window.Telegram && window.Telegram.WebApp;

// Initialize TON Connect
export const tonConnect = new TonConnect({
  manifestUrl: 'https://starslottery-fronend-production.up.railway.app/tonconnect-manifest.json'
});

// Log connection status changes
tonConnect.onStatusChange((wallet) => {
  console.log('[TON] Connection status changed:', wallet ? 'connected' : 'disconnected');
  console.log('[TON] Wallet details:', wallet);
  
  // Force UI update when wallet connection changes
  if (window.dispatchEvent) {
    window.dispatchEvent(new Event('tonconnect_ui_update_needed'));
  }
});

// Helper function to get wallet address from Telegram
async function getWalletFromTelegram() {
  if (!isTelegramWebView) return null;
  
  try {
    const data = window.Telegram?.WebApp?.initDataUnsafe?.user;
    if (data && data.ton_address) {
      return {
        account: {
          address: data.ton_address,
          chain: '-239', // TON mainnet
          publicKey: data.ton_public_key || ''
        },
        device: {
          appName: 'Telegram',
          appVersion: '1.0.0',
          maxProtocolVersion: 2,
          platform: 'telegram',
          features: []
        }
      };
    }
  } catch (e) {
    console.error('[TON] Error getting wallet from Telegram:', e);
  }
  return null;
}

// Log initial connection state
console.log('[TON] TON Connect initialized for Telegram Mini App');

// Export helper function
export { getWalletFromTelegram };
