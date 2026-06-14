import { Market } from '@/features/trading/types';

export const ALL_MARKETS: Market[] = [
  {
    symbol: 'BTC',
    tradingViewSymbol: 'BINANCE:BTCUSDT',
    logoUrl:
      'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/bitcoin/info/logo.png',
    binanceSymbol: 'BTCUSDT',
    category: 'crypto',
    maxLeverage: 100,
  },
  {
    symbol: 'ETH',
    tradingViewSymbol: 'BINANCE:ETHUSDT',
    logoUrl:
      'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
    binanceSymbol: 'ETHUSDT',
    category: 'crypto',
    maxLeverage: 100,
  },
  {
    symbol: 'SOL',
    tradingViewSymbol: 'BINANCE:SOLUSDT',
    logoUrl:
      'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/info/logo.png',
    binanceSymbol: 'SOLUSDT',
    category: 'crypto',
    maxLeverage: 100,
  },
];
