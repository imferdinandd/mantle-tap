import { Router, Request, Response } from 'express';
import { createPublicClient, createWalletClient, http, isAddress, keccak256, parseUnits, toBytes } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { BetScanner } from '../services/BetScanner';
import { config, TAP_BET_MANAGER_ABI, BYTES32_TO_SYMBOL, SYMBOL_BYTES32 } from '../config';
import { MANTLE_SEPOLIA } from '../config/chain';
import { ActiveBet } from '../types';

const client = createPublicClient({ chain: MANTLE_SEPOLIA, transport: http(config.rpcUrl) });
const relayerAccount = privateKeyToAccount(config.privateKey);
const relayerClient = createWalletClient({
  account: relayerAccount,
  chain: MANTLE_SEPOLIA,
  transport: http(config.rpcUrl),
});

function serializeBet(bet: ActiveBet) {
  const symbol = BYTES32_TO_SYMBOL[bet.symbol] ?? bet.symbolName;
  const entryPrice = Number(bet.targetPrice) / 1e8;
  const direction = Number(bet.targetPrice) > 0
    ? bet.direction
    : bet.direction;

  return {
    betId: bet.betId.toString(),
    trader: bet.user,
    symbol,
    direction: bet.direction,
    betAmount: (Number(bet.collateral) / 1e6).toFixed(2),
    targetPrice: bet.targetPrice.toString(),
    entryPrice: bet.targetPrice.toString(), // on-chain entryPrice not stored; use targetPrice as proxy
    entryTime: Number(bet.placedAt),
    targetTime: Number(bet.expiry),
    multiplier: Number(bet.multiplier),
    status: 'ACTIVE',
  };
}

export function createBetsRouter(scanner: BetScanner): Router {
  const router = Router();

  // GET /api/one-tap/active?trader=0x... — active bets (optionally filtered by trader)
  router.get('/active', (req: Request, res: Response) => {
    const { trader } = req.query;
    const syncing = scanner.isSyncing();
    let bets = Array.from(scanner.getActiveBets().values());
    if (trader && typeof trader === 'string' && isAddress(trader)) {
      bets = bets.filter(b => b.user.toLowerCase() === trader.toLowerCase());
    }
    res.json({ success: true, data: bets.map(serializeBet), ...(syncing && { syncing: true }) });
  });

  // POST /api/one-tap/place-bet-with-session — relayed session-key bet placement
  router.post('/place-bet-with-session', async (req: Request, res: Response) => {
    try {
      const {
        trader,
        symbol,
        targetPrice,
        entryPrice,
        collateralUsdc,
        collateral,
        expiry,
        expectedMultiplier,
        sessionSignature,
      } = req.body;

      if (!trader || !isAddress(trader)) {
        res.status(400).json({ success: false, error: 'valid trader address required' });
        return;
      }

      if (!symbol || typeof symbol !== 'string') {
        res.status(400).json({ success: false, error: 'symbol required' });
        return;
      }

      if (!sessionSignature || typeof sessionSignature !== 'string') {
        res.status(400).json({ success: false, error: 'sessionSignature required' });
        return;
      }

      const symbolBytes32 = SYMBOL_BYTES32[symbol] ?? keccak256(toBytes(symbol));
      const collateralAmount = collateral
        ? BigInt(collateral)
        : parseUnits(String(collateralUsdc), 6);

      const txHash = await relayerClient.writeContract({
        address: config.tapBetManager,
        abi: TAP_BET_MANAGER_ABI,
        functionName: 'placeBetWithSessionSignature',
        args: [
          trader as `0x${string}`,
          symbolBytes32,
          BigInt(targetPrice),
          BigInt(entryPrice),
          collateralAmount,
          BigInt(expiry),
          BigInt(expectedMultiplier),
          sessionSignature as `0x${string}`,
        ],
        account: relayerAccount,
      });

      const receipt = await client.waitForTransactionReceipt({ hash: txHash });
      if (receipt.status === 'reverted') {
        throw new Error('relayed bet reverted');
      }

      res.json({
        success: true,
        data: {
          transactionHash: txHash,
          relayer: relayerAccount.address,
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.shortMessage ?? err?.message ?? 'Internal error' });
    }
  });

  // GET /api/one-tap/bets?trader=0x... — all bets for a specific trader (on-chain)
  router.get('/bets', async (req: Request, res: Response) => {
    const { trader } = req.query;

    if (!trader || typeof trader !== 'string') {
      res.status(400).json({ success: false, error: 'trader address required' });
      return;
    }

    if (!isAddress(trader)) {
      res.status(400).json({ success: false, error: 'invalid trader address' });
      return;
    }

    try {
      // Get BetPlaced logs filtered by trader (indexed topic)
      const logs = await client.getLogs({
        address: config.tapBetManager,
        event: TAP_BET_MANAGER_ABI.find(x => x.type === 'event' && x.name === 'BetPlaced') as any,
        args: { user: trader as `0x${string}` },
        fromBlock: 0n,
        toBlock: 'latest',
      });

      if (logs.length === 0) {
        res.json({ success: true, data: [] });
        return;
      }

      // Fetch current status for each bet
      const betIds = logs.map((l: any) => l.args.betId as bigint);
      const bets = await Promise.all(
        betIds.map(async (betId) => {
          try {
            const raw = await client.readContract({
              address: config.tapBetManager,
              abi: TAP_BET_MANAGER_ABI,
              functionName: 'getBet',
              args: [betId],
            }) as any;

            const statusMap: Record<number, string> = { 0: 'ACTIVE', 1: 'WON', 2: 'EXPIRED' };
            const symbolName = BYTES32_TO_SYMBOL[raw.symbol] ?? raw.symbol;
            const direction = Number(raw.targetPrice) >= 0 ? (raw.direction === 0 ? 'UP' : 'DOWN') : 'UP';

            return {
              betId: raw.betId.toString(),
              trader: raw.user,
              symbol: symbolName,
              direction,
              betAmount: (Number(raw.collateral) / 1e6).toFixed(2),
              targetPrice: raw.targetPrice.toString(),
              entryPrice: raw.targetPrice.toString(),
              entryTime: Number(raw.placedAt),
              targetTime: Number(raw.expiry),
              multiplier: Number(raw.multiplier),
              status: statusMap[raw.status] ?? 'ACTIVE',
            };
          } catch {
            return null;
          }
        }),
      );

      res.json({ success: true, data: bets.filter(Boolean) });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message ?? 'Internal error' });
    }
  });

  return router;
}
