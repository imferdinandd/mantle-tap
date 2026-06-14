'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { toast } from 'sonner';
import { useMarket } from '@/features/trading/contexts/MarketContext';
import { useTapToTrade } from '@/features/trading/contexts/TapToTradeContext';
import { Market } from '@/features/trading/types';
import { ALL_MARKETS } from '@/features/trading/constants/markets';
import { useMarketWebSocket } from '@/features/trading/hooks/useMarketWebSocket';
import PerSecondChart from '@/components/charts/PerSecondChart';
import { mergeMarketsWithOracle } from '@/features/trading/lib/marketUtils';
import { formatMarketPair } from '@/features/trading/lib/marketUtils';
import { usePortfolioPnL } from '@/hooks/data/usePortfolioPnL';
import { usePlaceBet } from '@/features/trading/hooks/usePlaceBet';
import { getMultiplier } from '@/features/trading/lib/multiplierEngine';
import WalletConnectButton from '@/components/layout/WalletConnectButton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const TradingChart: React.FC = () => {
  const { activeMarket: contextActiveMarket, setActiveMarket, setCurrentPrice, currentPrice } = useMarket();

  const baseMarkets = useMemo<Market[]>(() => ALL_MARKETS, []);
  const [activeSymbol, setActiveSymbol] = useState<string>(
    contextActiveMarket?.symbol || baseMarkets[0].symbol,
  );

  const { isActive, collateralPerTap, multiTapEnabled } = useTapToTrade();
  const { placeBet, placeBetsBatch, isPending } = usePlaceBet();
  const { currentBalance, pnlDollar, pnlPercent } = usePortfolioPnL();

  const { marketDataMap, oraclePrices } = useMarketWebSocket(baseMarkets);

  const oracleSymbolsKey = useMemo(
    () =>
      Object.keys(oraclePrices || {})
        .sort()
        .join('|'),
    [oraclePrices],
  );

  const markets = useMemo(
    () => mergeMarketsWithOracle(baseMarkets, Object.keys(oraclePrices || {})),
    [baseMarkets, oracleSymbolsKey],
  );

  useEffect(() => {
    if (contextActiveMarket && contextActiveMarket.symbol !== activeSymbol) {
      setActiveSymbol(contextActiveMarket.symbol);
    }
  }, [contextActiveMarket, activeSymbol]);

  const activeMarket = useMemo(
    () => markets.find((m) => m.symbol === activeSymbol) || markets[0],
    [markets, activeSymbol],
  );

  const currentMarketData = activeMarket?.binanceSymbol
    ? marketDataMap[activeMarket.binanceSymbol]
    : null;
  const currentOraclePrice = activeMarket ? oraclePrices[activeMarket.symbol] : null;

  useEffect(() => {
    if (activeMarket) setActiveMarket(activeMarket);
  }, [activeMarket, setActiveMarket]);

  useEffect(() => {
    if (currentOraclePrice?.price) {
      setCurrentPrice(currentOraclePrice.price.toString());
    } else if (currentMarketData?.price) {
      setCurrentPrice(currentMarketData.price);
    }
  }, [activeSymbol, currentOraclePrice?.price, currentMarketData?.price, setCurrentPrice]);

  const livePrice = parseFloat(
    currentOraclePrice?.price?.toString() || currentMarketData?.price || currentPrice || '0'
  );

  const handleMarketSelect = (symbol: string) => {
    const selectedMarket = markets.find((m) => m.symbol === symbol);
    if (selectedMarket) {
      setActiveSymbol(symbol);
      setActiveMarket(selectedMarket);
      // Immediately set price from available data so there's no delay
      const oraclePrice = oraclePrices[symbol]?.price;
      const binancePrice = selectedMarket.binanceSymbol
        ? marketDataMap[selectedMarket.binanceSymbol]?.price
        : undefined;
      const immediatePrice = oraclePrice?.toString() ?? binancePrice;
      if (immediatePrice) setCurrentPrice(immediatePrice);
    }
  };

  const handleCellClick = async (
    targetPrice: number,
    targetTime: number,
    entryPrice: number,
    _entryTime: number,
  ) => {
    if (!activeMarket || !isActive) return;
    const now = Math.floor(Date.now() / 1000);
    const expirySeconds = Math.max(1, targetTime - now);
    const targetPriceBigInt = BigInt(Math.round(targetPrice * 1e8));
    const entryPriceBigInt = BigInt(Math.round(entryPrice * 1e8));
    const expectedMultiplier = getMultiplier(entryPriceBigInt, targetPriceBigInt, expirySeconds);

    try {
      const tx = await placeBet({
        symbolName: activeMarket.symbol,
        targetPrice: targetPriceBigInt,
        entryPrice: entryPriceBigInt,
        collateralUsdc: collateralPerTap,
        expirySeconds,
        expectedMultiplier,
      });
      if (tx) toast.success('Bet placed!');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to place bet');
    }
  };

  // Multi-tap drag: relays every cell queued during one drag gesture as a single
  // batched transaction (instead of one relayed tx per cell). Purely additive —
  // the regular single-tap flow above (handleCellClick / placeBet) is untouched.
  const handleMultiTapBatch = async (
    entries: { targetPrice: number; targetTime: number; entryPrice: number; entryTime: number }[],
  ) => {
    if (!activeMarket || !isActive || entries.length === 0) return;
    const now = Math.floor(Date.now() / 1000);

    const paramsList = entries.map((entry) => {
      const expirySeconds = Math.max(1, entry.targetTime - now);
      const targetPriceBigInt = BigInt(Math.round(entry.targetPrice * 1e8));
      const entryPriceBigInt = BigInt(Math.round(entry.entryPrice * 1e8));
      const expectedMultiplier = getMultiplier(entryPriceBigInt, targetPriceBigInt, expirySeconds);

      return {
        symbolName: activeMarket.symbol,
        targetPrice: targetPriceBigInt,
        entryPrice: entryPriceBigInt,
        collateralUsdc: collateralPerTap,
        expirySeconds,
        expectedMultiplier,
      };
    });

    try {
      const result = await placeBetsBatch(paramsList);
      if (!result) return;
      if (result.skipped.length === 0) {
        toast.success(`${result.placed} bets placed in one transaction!`);
      } else {
        toast.success(
          `${result.placed} of ${result.requested} bets placed in one tx — ${result.skipped.length} skipped (${result.skipped[0].reason})`,
        );
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to place batch');
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-trading-dark text-text-primary relative">
      <div className="flex items-start justify-between px-4 py-3 border-b border-border-muted">
        <div className="flex flex-col gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                {activeMarket && (
                  <Image
                    src={activeMarket.logoUrl || '/icons/usdc.png'}
                    alt={activeMarket.symbol}
                    width={28}
                    height={28}
                    className="rounded-full"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                )}
                <span className="font-bold text-text-primary text-xl">
                  {activeMarket ? formatMarketPair(activeMarket.symbol) : ''}
                </span>
                <span className="text-text-secondary text-sm">▾</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="bg-zinc-950 border-zinc-800 text-slate-200 max-h-72 overflow-auto"
            >
              {markets.map((m) => (
                <DropdownMenuItem
                  key={m.symbol}
                  onClick={() => handleMarketSelect(m.symbol)}
                  className="flex items-center gap-2"
                >
                  <Image
                    src={m.logoUrl || '/icons/usdc.png'}
                    alt={m.symbol}
                    width={20}
                    height={20}
                    className="rounded-full"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  <span>{formatMarketPair(m.symbol)}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="flex gap-3 text-xs text-text-secondary pt-1">
            <span className="font-semibold text-text-primary">
              {livePrice > 0
                ? `$${livePrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : '—'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end gap-1">
            <span className="font-mono font-bold text-2xl text-text-primary">
              {currentBalance !== null
                ? `$${currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : '$0.00'}
            </span>
            <div className="flex items-center gap-2">
              <span
                className={`font-mono text-sm font-semibold ${
                  (pnlPercent ?? 0) >= 0 ? 'text-success' : 'text-error'
                }`}
              >
                {(pnlPercent ?? 0) >= 0 ? '+' : ''}
                {pnlPercent !== null ? pnlPercent.toFixed(2) : '0.00'}%
              </span>
              <span
                className={`font-mono text-sm font-semibold ${
                  (pnlDollar ?? 0) >= 0 ? 'text-success' : 'text-error'
                }`}
              >
                {(pnlDollar ?? 0) >= 0 ? '+' : ''}$
                {pnlDollar !== null
                  ? Math.abs(pnlDollar).toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                  : '0.00'}
              </span>
            </div>
          </div>
          <WalletConnectButton />
        </div>
      </div>

      <div className="w-full flex-1" style={{ minHeight: 0, position: 'relative' }}>
        {activeMarket && (
          <PerSecondChart
            key={`${activeMarket.symbol}-chart`}
            symbol={activeMarket.symbol}
            currentPrice={parseFloat(
              currentOraclePrice?.price?.toString() || currentMarketData?.price || '0',
            )}
            betAmount={collateralPerTap.toString()}
            isBinaryTradingEnabled={isActive}
            isPlacingBet={isPending}
            multiTapEnabled={multiTapEnabled}
            logoUrl={activeMarket.logoUrl}
            tradeMode="one-tap-profit"
            showXAxis={true}
            showYAxis={true}
            yAxisSide="left"
            onCellClick={handleCellClick}
            onMultiTapBatch={handleMultiTapBatch}
          />
        )}
      </div>
    </div>
  );
};

export default TradingChart;
