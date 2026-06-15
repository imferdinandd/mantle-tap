import { useEffect, useRef, useState } from 'react';
import { PricePoint } from '../types';
import { DISPLAY_DELAY_MS, INTERPOLATION_INTERVAL_MS } from '../constants';

export const usePriceHistory = (symbol: string, currentPrice: number) => {
  const [interpolatedHistory, setInterpolatedHistory] = useState<PricePoint[]>([]);
  const priceHistoryRef = useRef<PricePoint[]>([]);
  const rawPriceBufferRef = useRef<PricePoint[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  // Connect to Pyth Oracle WebSocket for real-time price updates
  useEffect(() => {
    const pythPriceIds: { [key: string]: string } = {
      BTC: '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
      ETH: '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
      SOL: '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
      AVAX: '0x93da3352f9f1d105fdfe4971cfa80e9dd777bfc5d0f683ebb6e1294b92137bb7',
      NEAR: '0xc415de8d2eba7db216527dff4b60e8f3a5311c740dadb233e13e12547e226750',
      BNB: '0x2f95862b045670cd22bee3114c39763a4a08beeb663b145d283c31d7d1101c4f',
      XRP: '0xec5d399846a9209f3fe5881d70aae9268c94339ff9817e8d18ff19fa05eea1c8',
    };

    const priceId = pythPriceIds[symbol];
    if (!priceId) {
      console.warn(`No Pyth price feed for ${symbol}`);
      return;
    }

    try {
      const ws = new WebSocket('wss://hermes.pyth.network/ws');

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            type: 'subscribe',
            ids: [priceId],
          }),
        );
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          if (message.type === 'price_update' && message.price_feed) {
            const priceData = message.price_feed.price;
            const priceRaw = parseFloat(priceData.price);
            const expo = priceData.expo;
            const price = priceRaw * Math.pow(10, expo);
            const timestamp = Date.now();

            const buffer = rawPriceBufferRef.current;
            const newBuffer = [...buffer, { time: timestamp, price }];
            const cutoffTime = timestamp - 300000 - DISPLAY_DELAY_MS;
            rawPriceBufferRef.current = newBuffer.filter((p) => p.time >= cutoffTime);
          }
        } catch (error) {
          console.error('Error parsing Pyth message:', error);
        }
      };

      ws.onerror = () => {
        console.warn('⚠️ Pyth WebSocket error (price feed may be unavailable)');
      };

      ws.onclose = () => {};

      wsRef.current = ws;

      return () => {
        if (wsRef.current) {
          wsRef.current.close();
          wsRef.current = null;
        }
      };
    } catch (error) {
      console.error('Failed to connect to Pyth WebSocket:', error);
    }
  }, [symbol]);

  // Add current price from props to buffer (fallback if WebSocket slow)
  useEffect(() => {
    if (currentPrice > 0) {
      const now = Date.now();
      const buffer = rawPriceBufferRef.current;
      const lastUpdate = buffer.length > 0 ? buffer[buffer.length - 1].time : 0;
      if (now - lastUpdate > 500) {
        const newBuffer = [...buffer, { time: now, price: currentPrice }];
        const cutoffTime = now - 300000 - DISPLAY_DELAY_MS;
        rawPriceBufferRef.current = newBuffer.filter((p) => p.time >= cutoffTime);
      }
    }
  }, [currentPrice]);

  // Process buffer with delay + live interpolation in a single animation loop
  useEffect(() => {
    let animationId: number;
    let lastInterpTime = 0;

    const loop = () => {
      const now = Date.now();
      const displayTime = now - DISPLAY_DELAY_MS;

      // --- Buffer processing (move ready data to priceHistory) ---
      const buffer = rawPriceBufferRef.current;
      const readyData = buffer.filter((p) => p.time <= displayTime);

      if (readyData.length > 0) {
        const history = priceHistoryRef.current;
        const combined = [...history, ...readyData];
        const unique = combined.filter(
          (item, index, self) => index === self.findIndex((t) => t.time === item.time),
        );
        const sorted = unique.sort((a, b) => a.time - b.time);
        const cutoffTime = now - 300000;
        priceHistoryRef.current = sorted.filter((p) => p.time >= cutoffTime);

        // Remove processed data from buffer
        rawPriceBufferRef.current = buffer.filter((p) => p.time > displayTime);
      }

      // --- Interpolation (throttled to INTERPOLATION_INTERVAL_MS) ---
      if (now - lastInterpTime >= INTERPOLATION_INTERVAL_MS) {
        lastInterpTime = now;

        const allData = [...priceHistoryRef.current, ...rawPriceBufferRef.current].sort(
          (a, b) => a.time - b.time,
        );

        const uniqueData = allData.filter(
          (item, index, self) => index === self.findIndex((t) => Math.abs(t.time - item.time) < 10),
        );

        if (uniqueData.length < 2) {
          if (uniqueData.length === 1) {
            setInterpolatedHistory(uniqueData);
          }
          animationId = requestAnimationFrame(loop);
          return;
        }

        const interpolated: PricePoint[] = [];
        const startTime = uniqueData[0].time;
        const endTime = displayTime;

        let currentFrameTime = startTime;

        while (currentFrameTime <= endTime) {
          let beforePoint = uniqueData[0];
          let afterPoint = uniqueData[uniqueData.length - 1];

          for (let i = 0; i < uniqueData.length - 1; i++) {
            if (uniqueData[i].time <= currentFrameTime && uniqueData[i + 1].time > currentFrameTime) {
              beforePoint = uniqueData[i];
              afterPoint = uniqueData[i + 1];
              break;
            }
          }

          const timeDiff = afterPoint.time - beforePoint.time;
          const priceDiff = afterPoint.price - beforePoint.price;
          const progress = timeDiff > 0 ? (currentFrameTime - beforePoint.time) / timeDiff : 0;
          const interpolatedPrice = beforePoint.price + priceDiff * progress;

          interpolated.push({
            time: currentFrameTime,
            price: interpolatedPrice,
          });

          currentFrameTime += INTERPOLATION_INTERVAL_MS;
        }

        // Ensure we have the exact current display time point
        if (
          interpolated.length === 0 ||
          Math.abs(interpolated[interpolated.length - 1].time - displayTime) > 1
        ) {
          let beforePoint = uniqueData[0];
          let afterPoint = uniqueData[uniqueData.length - 1];

          for (let i = 0; i < uniqueData.length - 1; i++) {
            if (uniqueData[i].time <= displayTime && uniqueData[i + 1].time > displayTime) {
              beforePoint = uniqueData[i];
              afterPoint = uniqueData[i + 1];
              break;
            }
          }

          const timeDiff = afterPoint.time - beforePoint.time;
          const priceDiff = afterPoint.price - beforePoint.price;
          const progress = timeDiff > 0 ? (displayTime - beforePoint.time) / timeDiff : 0;
          const currentPrice = beforePoint.price + priceDiff * progress;

          interpolated.push({
            time: displayTime,
            price: currentPrice,
          });
        }

        // Keep only recent data (last 5 minutes)
        const cutoffTime = now - 300000;
        const filtered = interpolated.filter((p) => p.time >= cutoffTime);

        setInterpolatedHistory(filtered);
      }

      animationId = requestAnimationFrame(loop);
    };

    animationId = requestAnimationFrame(loop);

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, []);

  return { priceHistory: priceHistoryRef.current, interpolatedHistory };
};
