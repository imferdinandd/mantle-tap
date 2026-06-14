'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { sdk } from '@farcaster/miniapp-sdk';

const markets = ['BTC', 'ETH', 'SOL', 'BNB', 'ARB', 'XAU', 'XAG', 'AAPL', 'GOOGL', 'SPY'];

const features = [
  {
    title: 'Pyth Oracle',
    description: 'Real-time high-fidelity price feeds from Pyth Network.',
  },
  {
    title: 'Built on Mantle',
    description: 'Low-cost EVM-compatible L2 with fast finality and native MNT gas token.',
  },
  {
    title: 'Prediction Rewards',
    description: 'Win USDC rewards for accurate price predictions every round.',
  },
];

const stats = [
  { value: 'L2', label: 'Mantle Network' },
  { value: 'Fast', label: 'Block Time' },
  { value: '0', label: 'Gas Fees' },
  { value: '∞', label: 'Parallel Positions' },
];

export default function LandingPage() {
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    sdk.actions.ready();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (!heroRef.current) return;
      const scrollY = window.scrollY;
      heroRef.current.style.transform = `translateY(${scrollY * 0.3}px)`;
      heroRef.current.style.opacity = `${1 - scrollY / 600}`;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      {/* Ambient bg blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-purple-600/10 blur-[120px]" />
        <div className="absolute top-1/3 -right-40 w-[500px] h-[500px] rounded-full bg-violet-500/10 blur-[100px]" />
        <div className="absolute bottom-0 left-1/3 w-[400px] h-[400px] rounded-full bg-indigo-600/8 blur-[100px]" />
      </div>

      {/* Navbar */}
      <nav className="relative z-50 border-b border-white/5 bg-black/60 backdrop-blur-xl px-6 py-4 sticky top-0">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-sm font-black shadow-lg shadow-purple-500/30">
              M
            </div>
            <span className="font-black text-xl tracking-tight">
              Mantle<span className="text-purple-400">Tap</span>
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-gray-400">
            <a href="#features" className="hover:text-white transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="hover:text-white transition-colors">
              How It Works
            </a>
          </div>
          <Link
            href="/trade"
            className="relative group bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-all duration-200 shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:scale-105"
          >
            Launch App →
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 min-h-screen flex flex-col items-center justify-center text-center px-6 pt-10 pb-24">
        <div ref={heroRef}>
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 rounded-full px-4 py-1.5 text-xs font-semibold text-purple-300 mb-8 backdrop-blur-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
            Prediction Market · Powered by Mantle
          </div>

          <h1 className="text-6xl md:text-8xl font-black mb-6 leading-none tracking-tight">
            <span className="block text-white">Predict.</span>
            <span className="block bg-gradient-to-r from-purple-400 via-violet-400 to-indigo-400 bg-clip-text text-transparent">
              Tap. Win.
            </span>
          </h1>

          <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto mb-12 leading-relaxed">
            Mantle Tap is a on-chain prediction market where you guess the next price direction. One tap
            to enter, instant settlement, real rewards.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/trade"
              id="hero-launch-btn"
              className="bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white font-bold px-10 py-4 rounded-2xl text-lg transition-all duration-200 shadow-xl shadow-purple-500/30 hover:shadow-purple-500/50 hover:scale-105"
            >
              Start Predicting
            </Link>
            <a
              href="#how-it-works"
              className="border border-white/10 hover:border-purple-500/40 bg-white/5 hover:bg-purple-500/10 text-white font-semibold px-10 py-4 rounded-2xl text-lg transition-all duration-200"
            >
              How It Works
            </a>
          </div>
        </div>
      </section>

      {/* Problem & Solution */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <p className="text-purple-400 text-sm font-semibold uppercase tracking-widest mb-3">
            Why Mantle Tap Exists
          </p>
          <h2 className="text-4xl md:text-5xl font-black">The Problem. The Fix.</h2>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Problem */}
          <div className="relative bg-red-950/20 border border-red-500/20 rounded-3xl p-8 overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-red-600/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-9 h-9 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-lg">
                  ⚠️
                </div>
                <span className="text-red-400 text-sm font-bold uppercase tracking-widest">
                  Problem
                </span>
              </div>
              <p className="text-gray-300 text-lg leading-relaxed">
                Traditional prediction markets are hindered by{' '}
                <span className="text-red-400 font-semibold">steep learning curves</span>, and{' '}
                <span className="text-red-400 font-semibold">slow execution speeds</span> that
                alienate retail participants from real-time price action.
              </p>
              <div className="mt-8 space-y-3">
                {[
                  'Complex UX & steep learning curve',
                  'High gas costs per transaction',
                  'Slow block times miss price action',
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3 text-sm text-gray-500">
                    <span className="w-5 h-5 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 text-xs flex-shrink-0">
                      ✕
                    </span>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Solution */}
          <div className="relative bg-gradient-to-br from-purple-900/20 to-emerald-900/10 border border-purple-500/20 rounded-3xl p-8 overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-purple-600/8 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-lg">
                  ✨
                </div>
                <span className="text-purple-400 text-sm font-bold uppercase tracking-widest">
                  Solution
                </span>
              </div>
              <p className="text-gray-300 text-lg leading-relaxed">
                Mantle Tap leverages{' '}
                <span className="text-purple-400 font-semibold">
                  Mantle&apos;s low-cost L2 execution
                </span>{' '}
                and{' '}
                <span className="text-purple-400 font-semibold">
                  Pyth&apos;s high-fidelity feeds
                </span>{' '}
                to deliver a frictionless experience — atomically enter multiple predictions across
                various assets in a single block with instant settlement.
              </p>
              <div className="mt-8 space-y-3">
                {[
                  'One tap to predict, zero complexity',
                  'Parallel txs in a single block on Mantle',
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3 text-sm text-gray-300">
                    <span className="w-5 h-5 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 text-xs flex-shrink-0">
                      ✓
                    </span>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="relative z-10 max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <p className="text-purple-400 text-sm font-semibold uppercase tracking-widest mb-3">
            Core Features
          </p>
          <h2 className="text-4xl md:text-5xl font-black">Two Ways to Play</h2>
          <p className="text-gray-400 mt-4 max-w-xl mx-auto">
            Mantle Tap offers two unique prediction modes — simple or parallel, the choice is yours.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Single Tap */}
          <div className="group relative bg-gradient-to-br from-purple-900/20 to-violet-900/10 border border-purple-500/20 rounded-3xl p-8 hover:border-purple-500/40 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/10 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative z-10">
              <div className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-2">
                Mode 1
              </div>
              <h3 className="text-2xl font-black mb-3">Single Tap</h3>
              <p className="text-gray-400 leading-relaxed mb-6">
                The simplest prediction experience. Choose one market, pick UP or DOWN, and wait for
                settlement. Perfect for beginners and quick rounds.
              </p>
              <ul className="space-y-2">
                {['Pick one asset', 'Tap UP or DOWN', 'Win if you predict right'].map((step) => (
                  <li key={step} className="flex items-center gap-2 text-sm text-gray-300">
                    <span className="w-5 h-5 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 text-xs">
                      ✓
                    </span>
                    {step}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Parallel Multi Tap */}
          <div className="group relative bg-gradient-to-br from-indigo-900/20 to-violet-900/10 border border-indigo-500/20 rounded-3xl p-8 hover:border-indigo-500/40 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/10 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative z-10">
              <div className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-2">
                Mode 2 · Mantle Exclusive
              </div>
              <h3 className="text-2xl font-black mb-3">Parallel Multi Tap</h3>
              <p className="text-gray-400 leading-relaxed mb-6">
                Powered by Mantle&apos;s low-cost L2. Open multiple predictions across different
                markets simultaneously — all in one block, zero conflict.
              </p>
              <ul className="space-y-2">
                {[
                  'Predict multiple markets at once',
                  'Batch tx execution on Mantle',
                  'Maximize rewards every round',
                ].map((step) => (
                  <li key={step} className="flex items-center gap-2 text-sm text-gray-300">
                    <span className="w-5 h-5 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 text-xs">
                      ✓
                    </span>
                    {step}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative z-10 max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <p className="text-purple-400 text-sm font-semibold uppercase tracking-widest mb-3">
            Why Mantle Tap
          </p>
          <h2 className="text-4xl md:text-5xl font-black">Built Different</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f) => (
            <div
              key={f.title}
              className="group bg-white/[0.03] border border-white/8 rounded-2xl p-6 hover:border-purple-500/30 hover:bg-purple-500/5 transition-all duration-300"
            >
              <h3 className="text-lg font-bold mb-2 text-white">{f.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 py-24 text-center px-6">
        <div className="max-w-2xl mx-auto">
          <div className="inline-block bg-gradient-to-r from-purple-600/20 to-violet-600/20 border border-purple-500/20 rounded-3xl p-12">
            <h2 className="text-4xl md:text-5xl font-black mb-4">Ready to predict?</h2>
            <p className="text-gray-400 mb-8 text-lg">
              Connect your wallet and make your first prediction in under 10 seconds.
            </p>
            <Link
              href="/trade"
              id="cta-launch-btn"
              className="inline-block bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white font-black px-12 py-4 rounded-2xl text-xl transition-all duration-200 shadow-xl shadow-purple-500/30 hover:shadow-purple-500/50 hover:scale-105"
            >
              Launch Mantle Tap →
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-xs font-black">
              M
            </div>
            <span className="font-black">
              Mantle<span className="text-purple-400">Tap</span>
            </span>
          </div>
          <span className="text-gray-600 text-sm">© 2025 MantleTap. Built on Mantle.</span>
        </div>
      </footer>

      <style jsx global>{`
        @keyframes marquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-33.33%);
          }
        }
        .animate-marquee {
          animation: marquee 30s linear infinite;
        }
        @keyframes float-slow {
          0%,
          100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-12px);
          }
        }
        @keyframes float-mid {
          0%,
          100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-8px);
          }
        }
        @keyframes float-fast {
          0%,
          100% {
            transform: translateX(-50%) translateY(0px);
          }
          50% {
            transform: translateX(-50%) translateY(-10px);
          }
        }
        .animate-float-slow {
          animation: float-slow 4s ease-in-out infinite;
        }
        .animate-float-mid {
          animation: float-mid 3.5s ease-in-out infinite 0.5s;
        }
        .animate-float-fast {
          animation: float-fast 3s ease-in-out infinite 1s;
        }
      `}</style>
    </div>
  );
}
