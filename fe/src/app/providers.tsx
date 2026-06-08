'use client';

import React from 'react';
import { PrivyProvider } from '@privy-io/react-auth';
import { WagmiProvider } from '@privy-io/wagmi';
import { createConfig, http } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/sonner';
import { MANTLE_SEPOLIA_RPC, mantleSepolia } from '@/config/chains';

export const config = createConfig({
  chains: [mantleSepolia],
  transports: {
    [mantleSepolia.id]: http(MANTLE_SEPOLIA_RPC),
  },
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        appearance: {
          theme: 'dark',
          accentColor: '#676FFF',
          showWalletLoginFirst: true,
          walletList: [
            'base_account',
            'detected_ethereum_wallets',
            'metamask',
            'coinbase_wallet',
            'wallet_connect',
          ],
        },
        loginMethods: ['email', 'google', 'wallet'],
        embeddedWallets: {
          ethereum: {
            createOnLogin: 'users-without-wallets',
          },
        },
        defaultChain: mantleSepolia,
        supportedChains: [mantleSepolia],
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={config}>
          <Toaster />
          {children}
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
