// TON Connect SDK singleton for Telegram Mini App
import { TonConnect } from '@tonconnect/sdk';

export const tonConnect = new TonConnect({
  manifestUrl: 'https://starslottery-fronend-production.up.railway.app/tonconnect-manifest.json'
});
