/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useSwitchChain, useChainId } from 'wagmi';
import { mantleSepolia } from '@/config/chains';
import { toast } from 'sonner';
import { Wallet, Copy, ExternalLink, LogOut, Droplets } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useWalletActions } from '@/hooks/wallet/useWalletActions';
import { useWalletBalance } from '@/hooks/wallet/useWalletBalance';
import { useUSDCFaucet } from '@/hooks/wallet/useUSDCFaucet';

const WalletConnectButtonInner: React.FC = () => {
  const { ready, authenticated, login } = usePrivy();
  const { switchChain } = useSwitchChain();
  const chainId = useChainId();
  const { shortAddress, handleCopyAddress, handleViewExplorer, handleDisconnect } =
    useWalletActions();
  const { usdcBalance } = useWalletBalance();
  const { isClaiming, handleClaimUSDC } = useUSDCFaucet();

  // Auto-switch to Mantle when authenticated
  useEffect(() => {
    if (authenticated && chainId !== mantleSepolia.id) {
      const timer = setTimeout(() => {
        switchChain({ chainId: mantleSepolia.id });
        toast.success('Switching to Mantle Sepolia network...');
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [authenticated, chainId, switchChain]);

  if (!ready) return null;

  if (authenticated) {
    return (
      <div className="flex items-center">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2.5 bg-[#00d395] hover:bg-[#00b87e] rounded-lg px-5 py-3 text-base font-semibold text-black transition-all duration-200 shadow-md hover:shadow-lg cursor-pointer outline-none">
              <Wallet className="w-5 h-5" />
              {shortAddress}
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="end"
            sideOffset={8}
            className="w-72 bg-[#16181D] border border-slate-700/50 text-slate-100 p-0 rounded-xl overflow-hidden shadow-2xl"
          >
            {/* Address row */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700/40">
              <div className="w-7 h-7 rounded-full bg-[#00d395] flex items-center justify-center flex-shrink-0">
                <Wallet className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-slate-100 font-medium text-sm flex-1">{shortAddress}</span>
              <button
                onClick={handleCopyAddress}
                className="p-1.5 hover:bg-slate-700/50 rounded-md transition-colors"
                title="Copy address"
              >
                <Copy className="w-3.5 h-3.5 text-slate-400" />
              </button>
              <button
                onClick={handleViewExplorer}
                className="p-1.5 hover:bg-slate-700/50 rounded-md transition-colors"
                title="View on explorer"
              >
                <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </div>

            {/* Balance */}
            <div className="px-4 py-3 border-b border-slate-700/40">
              <div className="flex items-center justify-between mb-1">
                <span className="text-slate-400 text-xs">Balance</span>
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-800/60 rounded-md">
                  <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
                    <span className="text-white text-[9px] font-bold">$</span>
                  </div>
                  <span className="text-slate-200 text-xs font-medium">USDC</span>
                </div>
              </div>
              <span className="text-2xl font-bold text-slate-100">
                {usdcBalance === null
                  ? '—'
                  : `$${parseFloat(usdcBalance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </span>
            </div>

            {/* Claim Faucet */}
            <div className="px-4 py-2 border-b border-slate-700/40">
              <button
                onClick={handleClaimUSDC}
                disabled={isClaiming}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[#00d395]/10 hover:bg-[#00d395]/20 border border-[#00d395]/30 hover:border-[#00d395]/50 rounded-lg text-[#00d395] text-sm font-medium transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Droplets className="w-4 h-4" />
                {isClaiming ? 'Claiming...' : 'Claim USDC Faucet'}
              </button>
            </div>

            {/* Disconnect */}
            <div className="px-4 py-2">
              <button
                onClick={handleDisconnect}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-700/50 rounded-lg text-red-400 hover:text-red-300 text-sm font-medium transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                Disconnect
              </button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={login}
        className="flex items-center gap-2.5 bg-[#00d395] hover:bg-[#00b87e] rounded-lg md:px-5 px-3 md:py-3 py-1 text-base font-semibold text-black transition-all duration-200 shadow-md hover:shadow-lg cursor-pointer"
      >
        <Wallet className="w-5 h-5" />
        Connect wallet
      </button>

      <div className="relative group">
        <button
          className="flex items-center justify-center w-12 h-12 bg-slate-800 hover:bg-slate-700 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
          title="Mantle Sepolia"
        >
          <img src="/icons/mantle.png" alt="Mantle" className="w-6 h-6 object-contain" />
        </button>
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-2 py-1 bg-slate-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none">
          Mantle Sepolia
        </div>
      </div>
    </div>
  );
};

const WalletConnectButton: React.FC = () => {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  if (!hydrated) return null;

  return <WalletConnectButtonInner />;
};

export default WalletConnectButton;
