import { TonConnect } from '@tonconnect/sdk';

// Configuration for Telegram Mini App
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

// Log initial connection state
console.log('[TON] TON Connect initialized for Telegram Mini App');
