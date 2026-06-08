'use client';

import { useCallback, useState } from 'react';
import {
  useWriteContract,
  useReadContract,
  useAccount,
  usePublicClient,
} from 'wagmi';
import { encodePacked, maxUint256, keccak256, toBytes, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { BACKEND_API_URL, TAP_BET_MANAGER_ADDRESS, USDC_ADDRESS } from '@/config/contracts';
import { useTapToTrade } from '@/features/trading/contexts/TapToTradeContext';

const TAP_BET_MANAGER_ABI = [
  {
    type: 'function',
    name: 'placeBet',
    inputs: [
      { name: 'symbol', type: 'bytes32' },
      { name: 'targetPrice', type: 'uint256' },
      { name: 'entryPrice', type: 'uint256' },
      { name: 'collateral', type: 'uint256' },
      { name: 'expiry', type: 'uint256' },
      { name: 'expectedMultiplier', type: 'uint256' },
    ],
    outputs: [{ name: 'betId', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'sessionNonces',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'placeBetWithSessionSignature',
    inputs: [
      { name: 'trader', type: 'address' },
      { name: 'symbol', type: 'bytes32' },
      { name: 'targetPrice', type: 'uint256' },
      { name: 'entryPrice', type: 'uint256' },
      { name: 'collateral', type: 'uint256' },
      { name: 'expiry', type: 'uint256' },
      { name: 'expectedMultiplier', type: 'uint256' },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [{ name: 'betId', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
] as const;

const ERC20_ABI = [
  {
    type: 'function',
    name: 'allowance',
    inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'approve',
    inputs: [{ name: 'spender', type: 'address' }, { name: 'value', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
] as const;

export interface PlaceBetParams {
  symbolName: string;
  targetPrice: bigint;
  entryPrice?: bigint;
  collateralUsdc: number;
  expirySeconds: number;
  expectedMultiplier: number;
}

export function usePlaceBet() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { sessionKey } = useTapToTrade();
  const [isApproving, setIsApproving] = useState(false);
  const [isPlacing, setIsPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { writeContractAsync } = useWriteContract();

  // Allowance check for the connected wallet (fallback path)
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, TAP_BET_MANAGER_ADDRESS] : undefined,
    query: { enabled: !!address && !sessionKey },
  });

  const placeBet = useCallback(async (params: PlaceBetParams): Promise<`0x${string}` | null> => {
    setError(null);

    const collateral = parseUnits(params.collateralUsdc.toString(), 6);
    const symbolBytes32 = keccak256(toBytes(params.symbolName));
    const expiry = BigInt(Math.floor(Date.now() / 1000) + params.expirySeconds);
    const entryPrice = params.entryPrice ?? 0n;

    // ── Session key path: sign + send directly, no popup ──────────────────────
    if (sessionKey) {
      if (sessionKey.expiresAt <= Date.now()) {
        throw new Error('Session expired — please start a new session');
      }
      if (!publicClient) { setError('Public client unavailable'); return null; }

      setIsPlacing(true);
      try {
        const account = privateKeyToAccount(sessionKey.privateKey);

        const nonce = await publicClient.readContract({
          address: TAP_BET_MANAGER_ADDRESS,
          abi: TAP_BET_MANAGER_ABI,
          functionName: 'sessionNonces',
          args: [sessionKey.trader],
        }) as bigint;

        const messageHash = keccak256(
          encodePacked(
            ['address', 'bytes32', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'address', 'uint256'],
            [
              sessionKey.trader,
              symbolBytes32,
              params.targetPrice,
              entryPrice,
              collateral,
              expiry,
              BigInt(params.expectedMultiplier),
              nonce,
              TAP_BET_MANAGER_ADDRESS,
              5003n,
            ],
          ),
        );

        const sessionSignature = await account.signMessage({ message: { raw: messageHash } });

        const response = await fetch(`${BACKEND_API_URL}/api/one-tap/place-bet-with-session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            trader: sessionKey.trader,
            symbol: params.symbolName,
            targetPrice: params.targetPrice.toString(),
            entryPrice: entryPrice.toString(),
            collateral: collateral.toString(),
            expiry: expiry.toString(),
            expectedMultiplier: params.expectedMultiplier,
            sessionSignature,
          }),
        });

        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Relayed bet failed');
        }

        setIsPlacing(false);
        return result.data.transactionHash;
      } catch (err: unknown) {
        setIsApproving(false);
        setIsPlacing(false);
        throw err; // re-throw so TradingGrid's catch shows toast.error
      }
    }

    // ── Fallback: connected wallet path (requires popup each time) ─────────────
    if (!address) { setError('Wallet not connected'); return null; }
    if (!publicClient) { setError('Public client unavailable'); return null; }

    try {
      // Always fetch pending nonce to avoid stale nonce issues on Mantle Sepolia
      let nonce = await publicClient.getTransactionCount({ address, blockTag: 'pending' });

      const currentAllowance = allowance ?? 0n;
      if (currentAllowance < collateral) {
        setIsApproving(true);
        const approveTx = await writeContractAsync({
          address: USDC_ADDRESS,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [TAP_BET_MANAGER_ADDRESS, maxUint256],
          nonce,
        });
        await publicClient.waitForTransactionReceipt({ hash: approveTx });
        await refetchAllowance();
        setIsApproving(false);
        nonce++;
      }

      setIsPlacing(true);
      const tx = await writeContractAsync({
        address: TAP_BET_MANAGER_ADDRESS,
        abi: TAP_BET_MANAGER_ABI,
        functionName: 'placeBet',
        args: [symbolBytes32, params.targetPrice, entryPrice, collateral, expiry, BigInt(params.expectedMultiplier)],
        nonce,
      });

      setIsPlacing(false);
      return tx;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setIsApproving(false);
      setIsPlacing(false);
      return null;
    }
  }, [address, allowance, sessionKey, publicClient, writeContractAsync, refetchAllowance]);

  return {
    placeBet,
    isApproving,
    isPlacing,
    isPending: isApproving || isPlacing,
    error,
  };
}
