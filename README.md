# Mantle Tap 🎯

**Mantle Tap** is a decentralized prediction market built on [Mantle](https://mantle.xyz) where users predict the next price direction of assets. Tap UP or DOWN, wait for settlement, and win USDC rewards

> Built for **Mantle Hackathon 2026**

---

## The Problem

Traditional prediction markets are hindered by steep learning curves, prohibitive gas costs, and slow execution speeds that alienate retail participants from real-time price action.

## The Solution

Mantle Tap leverages Mantle's low-fee EVM execution and Pyth's high-fidelity feeds to deliver a frictionless experience where users can enter multiple predictions across various assets in a single block with instant settlement.

---

## ✨ Key Features

### 👆 Single Tap

The simplest prediction experience. Choose one market, pick **UP** or **DOWN**, and wait for settlement. Perfect for quick rounds and beginners.

### ⚡ Parallel Multi Tap

Open multiple predictions across different markets **simultaneously in a single transaction batch** — zero conflicts, maximum throughput.

### Other Highlights

- **Pyth Oracle** — Real-time high-fidelity price feeds
- **Account Abstraction** — Privy-powered smart wallets (no seed phrases)
- **Multi-Market** — Crypto, forex, indices, commodities, and stocks
- **Instant Settlement** — On-chain win detection and auto-settlement via the solver

---

## 🏗️ Architecture

```
montap/
├── fe/          # Next.js 16 frontend (React 19, Tailwind CSS v4, Wagmi/Privy)
├── be/          # TapX Solver — Node.js/TypeScript off-chain engine
└── sc/          # Smart Contracts — Solidity 0.8.24, Foundry
```

### Frontend (`fe/`)

- **Framework**: Next.js 16 with Turbopack, React 19
- **Wallet**: Privy (Account Abstraction) + Wagmi v2 + viem
- **Charts**: KLineCharts, Lightweight Charts
- **UI**: Tailwind CSS v4, Radix UI, Lucide Icons
- **3D / Animation**: Three.js, React Three Fiber, GSAP, Lenis

### Backend — TapX Solver (`be/`)

The off-chain solver is a TypeScript/Node.js service responsible for:

| Service         | Role                                                      |
| --------------- | --------------------------------------------------------- |
| `BetScanner`    | Scans on-chain events for open bets                       |
| `PriceWatcher`  | Streams real-time Pyth price feeds via Hermes             |
| `WinDetector`   | Compares entry price vs. current price to detect wins     |
| `Settler`       | Submits on-chain transactions to settle winning bets      |
| `ExpiryCleanup` | Handles expired/unresolved bets                           |

The server exposes HTTP + WebSocket endpoints for the frontend to consume live price and bet data.

### Smart Contracts (`sc/`)

| Contract               | Description                                                   |
| ---------------------- | ------------------------------------------------------------- |
| `TapBetManager.sol`    | Core contract — manages bet lifecycle (open, resolve, settle) |
| `PriceAdapter.sol`     | Wraps Pyth Network for on-chain price verification            |
| `MultiplierEngine.sol` | Calculates reward multipliers based on bet parameters         |

- **Language**: Solidity 0.8.24
- **Toolchain**: Foundry
- **Oracle**: Pyth Network (`pyth-sdk-solidity`)
- **Network**: Mantle Sepolia Testnet (`https://rpc.sepolia.mantle.xyz`)

---

## 📦 Deployed Contracts (Mantle Sepolia Testnet)

| Contract         | Address                                      |
| ---------------- | -------------------------------------------- |
| TapBetManager    | `0xB681990b428Ad7ecDc3421110C4D763d171cF0eD` |
| TapVault         | `0x3e98543F35D2BD4A051c75D01e624844b05ACc97` |
| MultiplierEngine | `0x247093cEcCB72d4CCB6951BF13CC9f28Be58aDCF` |
| PriceAdapter     | `0x6e6cb97D6F9031D42BE9fB95796950e1afa9Ae86` |
| USDC (Mock)      | `0x4f2FB7482EB7e60437715489f28B2Cc3aC4DC743` |

---

## 🚀 Getting Started

### Prerequisites

- Node.js >= 20
- Foundry (for smart contracts)
- A Privy App ID
- RPC URL for Mantle Sepolia Testnet

### 1. Frontend

```bash
cd fe
cp .env.example .env   # fill in your env vars
npm install
npm run dev            # starts at http://localhost:3000
```

**Required env vars (`fe/.env`):**

```env
NEXT_PUBLIC_PRIVY_APP_ID=...
NEXT_PUBLIC_TAP_BET_MANAGER=...
NEXT_PUBLIC_TAP_VAULT=...
NEXT_PUBLIC_MULTIPLIER_ENGINE=...
NEXT_PUBLIC_PRICE_ADAPTER=...
NEXT_PUBLIC_USDC_ADDRESS=...
NEXT_PUBLIC_PYTH_BTC_PRICE_ID=...
NEXT_PUBLIC_PYTH_ETH_PRICE_ID=...
NEXT_PUBLIC_RPC_URL=https://rpc.sepolia.mantle.xyz
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
```

### 2. Backend (Solver)

```bash
cd be
cp .env.example .env   # fill in your env vars
npm install
npm run dev            # starts at http://localhost:3001
```

**Required env vars (`be/.env`):**

```env
RPC_URL=https://rpc.sepolia.mantle.xyz
PRIVATE_KEY=...        # relayer wallet private key
TAP_BET_MANAGER=...
PYTH_HERMES_URL=https://hermes.pyth.network
PORT=3001
```

### 3. Smart Contracts

```bash
cd sc
cp .env.example .env
forge install
forge build
forge test

# Deploy
./deploy.sh
```

---

## 🛠️ Tech Stack

| Layer            | Technology                                  |
| ---------------- | ------------------------------------------- |
| Blockchain       | Mantle Sepolia Testnet                      |
| Smart Contracts  | Solidity 0.8.24, Foundry                    |
| Oracle           | Pyth Network                                |
| Frontend         | Next.js 16, React 19, TypeScript            |
| Wallet / Auth    | Privy (Account Abstraction), Wagmi v2, viem |
| Styling          | Tailwind CSS v4, Radix UI                   |
| Backend / Solver | Node.js, TypeScript, Express, WebSocket     |
| Analytics        | Vercel Analytics                            |

---

## 📊 How a Prediction Works

```
1. User connects wallet (Privy smart wallet)
2. User selects a market (e.g. BTC/USDC) and taps UP or DOWN
3. TapBetManager records the bet with entry price from PriceAdapter (Pyth)
4. Solver (be/) watches the price via Pyth Hermes WebSocket
5. When price moves past threshold → WinDetector fires
6. Settler submits tx on-chain → TapBetManager settles the bet
7. Winner receives USDC payout from TapVault
```

**Parallel Multi Tap**: Steps 2–3 are batched across multiple markets in a single transaction, allowing atomic multi-market predictions.

---

## 📁 Project Structure

```
fe/src/
├── app/               # Next.js pages & layouts
├── components/        # UI components (layout, trading, wallet)
├── features/          # Feature-level modules
├── hooks/             # Custom React hooks (wallet, data, utils)
├── config/            # Chain & contract config
├── contracts/         # ABI definitions
└── types/             # TypeScript types

be/src/
├── services/          # BetScanner, PriceWatcher, WinDetector, Settler, ExpiryCleanup
├── routes/            # HTTP API routes
├── config/            # Env config + chain definition
└── utils/             # Logger and helpers

sc/src/
├── trading/           # TapBetManager, PriceAdapter, MultiplierEngine
├── token/             # USDC mock token
├── treasury/          # TapVault
└── paymaster/         # Gas relayer paymaster
```

---

## 📄 License

MIT — built with 💜 for the Mantle ecosystem.
