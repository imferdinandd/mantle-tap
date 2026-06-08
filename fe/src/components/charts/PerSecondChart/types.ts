import { Bet } from '@/features/trading/types';
export interface PricePoint {
  time: number;
  price: number;
}

export interface PerSecondChartProps {
  symbol: string;
  currentPrice: number;
  betAmount?: string; // Bet amount from sidebar (optional, default 10)
  isBinaryTradingEnabled?: boolean; // Whether binary trading is enabled with session key
  tradeMode?: 'one-tap-profit' | 'open-position' | 'quick-tap'; // Trade mode
  activeBets?: Bet[]; // Active bets to display
  onCellClick?: (
    targetPrice: number,
    targetTime: number,
    entryPrice: number,
    entryTime: number,
  ) => void;
  // Multi-tap drag only: receives all cells queued during one drag gesture on
  // mouse-release, so the caller can relay them as a single batched transaction.
  // Additive — when omitted, multi-tap falls back to per-cell onCellClick calls.
  onMultiTapBatch?: (
    entries: { targetPrice: number; targetTime: number; entryPrice: number; entryTime: number }[],
  ) => void;
  isPlacingBet?: boolean;
  multiTapEnabled?: boolean;
  logoUrl?: string; // URL for the coin logo
  // Grid configuration props
  gridIntervalSeconds?: number;
  gridPriceStep?: number;
  gridAnchorPrice?: number;
  gridAnchorTime?: number;
  // Axis configuration
  yAxisSide?: 'left' | 'right';
  showXAxis?: boolean;
  showYAxis?: boolean;
  positionMarkers?: {
    id: string;
    entryPrice: number;
    isLong: boolean;
  }[];
  pendingMarkers?: {
    id: string;
    entryPrice: number;
    isLong: boolean;
  }[];
}
