import { TonConnect } from '@tonconnect/sdk';

// Initialize with proper configuration for Telegram Mini App
export const tonConnect = new TonConnect({
  manifestUrl: 'https://starslottery-fronend-production.up.railway.app/tonconnect-manifest.json'
});

// Log connection status changes
tonConnect.onStatusChange((wallet) => {
  console.log('[TON] Connection status changed:', wallet ? 'connected' : 'disconnected');
  console.log('[TON] Wallet details:', wallet);
});

// Log initial connection state
console.log('[TON] TON Connect initialized');
