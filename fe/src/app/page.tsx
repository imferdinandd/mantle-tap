'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { sdk } from '@farcaster/miniapp-sdk';
import Squares from '@/components/Squares';
import StaggeredMenu from '@/components/StaggeredMenu';
import dynamic from 'next/dynamic';
import Lenis from 'lenis';

const Silk = dynamic(() => import('@/components/Silk'), { ssr: false });

export default function LandingPage() {

  // Platform preview scroll stack
  const platformRef = useRef<HTMLDivElement>(null);
  const [platformProgress, setPlatformProgress] = useState(0);
  const [platformPosition, setPlatformPosition] = useState<'before' | 'fixed' | 'after'>('before');

  // Supported Coins section animation
  const coinsRef = useRef<HTMLDivElement>(null);
  const [coinsVisible, setCoinsVisible] = useState(false);

  // Text scramble effect for scroll stack text
  const platformTexts = [
    { title: 'Tap to Trade Interface', subtitle: 'A clean, real-time trading interface built for speed — no order books, no complexity' },
    { title: 'Choose Your Market', subtitle: 'Pick BTC, ETH, or SOL and start trading in seconds' },
    { title: 'Place Your Position', subtitle: 'Tap a price target on the chart — if the price hits it, you win' },
  ];
  const scramblePhaseRef = useRef(-1);
  const [displayTitle, setDisplayTitle] = useState('');
  const scrambleRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    sdk.actions.ready();
  }, []);

  // Smooth scroll with Lenis
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    return () => {
      lenis.destroy();
    };
  }, []);

  // Text scramble - run on every platformProgress change, but only act on phase change
  const scrambleChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*';
  const startScramble = (phase: number) => {
    if (scrambleRef.current) clearInterval(scrambleRef.current);

    const targetTitle = platformTexts[phase].title;
    let tick = 0;
    const totalTicks = 15;

    scrambleRef.current = setInterval(() => {
      tick++;
      const progress = tick / totalTicks;

      const resolvedTitle = Math.floor(progress * targetTitle.length);
      setDisplayTitle(
        targetTitle.split('').map((ch, i) => {
          if (i < resolvedTitle) return ch;
          if (ch === ' ') return ' ';
          return scrambleChars[Math.floor(Math.random() * scrambleChars.length)];
        }).join('')
      );

      if (tick >= totalTicks) {
        setDisplayTitle(targetTitle);
        if (scrambleRef.current) clearInterval(scrambleRef.current);
        scrambleRef.current = null;
      }
    }, 30);
  };

  // Check phase on every progress change (no cleanup that kills the interval)
  const currentPhase = platformProgress < 0.3 ? 0 : platformProgress < 0.65 ? 1 : 2;
  if (currentPhase !== scramblePhaseRef.current) {
    scramblePhaseRef.current = currentPhase;
    startScramble(currentPhase);
  }

  // Platform preview scroll progress (JS-based fixed positioning)
  useEffect(() => {
    const handlePlatformScroll = () => {
      if (!platformRef.current) return;
      const rect = platformRef.current.getBoundingClientRect();
      const scrollSpace = platformRef.current.offsetHeight - window.innerHeight;
      if (scrollSpace <= 0) return;

      if (rect.top > 0) {
        // Haven't reached section yet
        setPlatformPosition('before');
        setPlatformProgress(0);
      } else if (rect.bottom <= window.innerHeight) {
        // Scrolled past section
        setPlatformPosition('after');
        setPlatformProgress(1);
      } else {
        // Inside the section - fix content
        setPlatformPosition('fixed');
        const progress = Math.max(0, Math.min(1, -rect.top / scrollSpace));
        setPlatformProgress(progress);
      }
    };

    window.addEventListener('scroll', handlePlatformScroll, { passive: true });
    handlePlatformScroll();
    return () => window.removeEventListener('scroll', handlePlatformScroll);
  }, []);


  // Supported Coins intersection observer
  useEffect(() => {
    const el = coinsRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setCoinsVisible(entry.isIntersecting),
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);


  return (
    <div className="w-full bg-black text-white overflow-x-hidden" style={{ fontFamily: "'Satoshi', sans-serif" }}>
      {/* Header Menu */}
      <StaggeredMenu
        isFixed={true}
        position="right"
        colors={["#161616", "#1a1a1a"]}
        accentColor="#00d395"
        menuButtonColor="#fff"
        openMenuButtonColor="#fff"
        displayItemNumbering={true}
        displaySocials={true}
        closeOnClickAway={true}
        items={[
          { label: "Launch App", ariaLabel: "Launch trading app", link: "/trade" },
          { label: "Docs", ariaLabel: "Documentation", link: "#" },
        ]}
        socialItems={[
          { label: "GitHub", link: "https://github.com/imferdinandd/mantle-tap" },
        ]}
      />

      {/* Hero Section with Layered Text */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-black">
        <div className="absolute inset-0">
          <Silk
            color="#00d395"
            speed={5}
            scale={1}
            noiseIntensity={1.5}
            rotation={0}
          />
        </div>
        <div className="absolute inset-0">
          <Squares
            direction="left"
            speed={0.3}
            squareSize={55}
            borderColor="#333"
            hoverFillColor="#1a1a1a"
            clickImage="/mantle-tap-polos.png"
          />
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-b from-transparent to-black z-10 pointer-events-none"></div>
        <div className="relative z-20 flex flex-col items-center pointer-events-none w-[95%] md:w-auto px-2">
          <h2 className="text-4xl md:text-6xl font-bold text-white text-center mb-4">
            <span className="flex md:hidden items-center justify-center gap-2 flex-wrap">
              Welcome to
              <Image
                src="/mantle-tap-polos.png"
                alt="MantleTap Logo"
                width={56}
                height={56}
                className="w-10 h-10 inline-block"
              />
              MantleTap
            </span>
            <span className="hidden md:flex items-center justify-center gap-3">
              Welcome to
              <Image
                src="/mantle-tap-polos.png"
                alt="MantleTap Logo"
                width={56}
                height={56}
                className="w-14 h-14 inline-block"
              />
              MantleTap
            </span>
          </h2>
          <p className="text-white text-base text-center max-w-none md:max-w-lg px-2 md:px-0">
            The simplest decentralized exchange — tap to trade, open positions, and earn rewards in just one click.
          </p>
          <Link
            href="/trade"
            className="pointer-events-auto mt-4 font-semibold py-2 px-6 rounded-none
                       bg-white text-black hover:bg-[#00d395] hover:text-black
                       transition-all duration-300 ease-in-out
                       hover:shadow-lg hover:shadow-[#00d395]/30"
          >
            Launch App
          </Link>
        </div>
      </section>

      {/* Platform Preview Section - Scroll Stack */}
      <section id="features" ref={platformRef} className="relative z-20 bg-black" style={{ height: '300vh' }}>
        <div
          className="w-full min-h-screen flex flex-col justify-center px-4 py-20"
          style={
            platformPosition === 'fixed'
              ? { position: 'fixed', top: 0, left: 0, right: 0, zIndex: 20 }
              : platformPosition === 'after'
                ? { position: 'absolute', bottom: 0, left: 0, right: 0 }
                : { position: 'relative' }
          }
        >
          <div className="container mx-auto max-w-7xl">
            {/* Text - scramble title + fade subtitle */}
            <div className="text-center mb-12">
              <h2 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-[#00d395] to-emerald-300 bg-clip-text text-transparent mb-4 font-mono">
                {displayTitle}
              </h2>
              <div className="relative h-8">
                {platformTexts.map((text, i) => (
                  <p
                    key={i}
                    className="text-xl text-gray-400 absolute inset-0 transition-opacity duration-500"
                    style={{ opacity: currentPhase === i ? 1 : 0 }}
                  >
                    {text.subtitle}
                  </p>
                ))}
              </div>
            </div>

            {/* Images stack */}
            <div className="relative">
              {/* Base image - taptotrade */}
              <div
                className="relative rounded-xl overflow-hidden border border-[#00d395]/30 shadow-2xl shadow-[#00d395]/20"
                style={{
                  filter: platformProgress >= 0.3 && platformProgress < 0.65 ? 'blur(3px) brightness(0.7)' : 'blur(0px) brightness(1)',
                  transition: 'filter 0.6s ease-out',
                }}
              >
                <Image
                  src="/taptotrade.png"
                  alt="Tap to Trade"
                  width={1920}
                  height={1080}
                  className="w-full h-auto"
                  priority
                />
              </div>

              {/* Overlay image 2 - menucoin, slides in from top-left */}
              <div
                className="absolute top-[7%] left-[11%] w-[45%]"
                style={{
                  opacity: platformProgress >= 0.3 && platformProgress < 0.65 ? 1 : 0,
                  transform: platformProgress >= 0.3 && platformProgress < 0.65
                    ? 'translate(0, 0) scale(1)'
                    : platformProgress < 0.3
                      ? 'translate(-60px, 40px) scale(0.3)'
                      : 'translate(-60px, 40px) scale(0.3)',
                  transition: 'opacity 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
              >
                <div className="rounded-xl overflow-hidden shadow-2xl shadow-[#00d395]/30">
                  <Image
                    src="/menucoin.png"
                    alt="Choose Your Market"
                    width={800}
                    height={600}
                    className="w-full h-auto"
                  />
                </div>
              </div>

              {/* Base image swap - place-position, fades in as the full background for the final phase */}
              <div
                className="absolute inset-0 rounded-xl overflow-hidden border border-[#00d395]/30 shadow-2xl shadow-[#00d395]/20"
                style={{
                  opacity: platformProgress >= 0.65 ? 1 : 0,
                  transition: 'opacity 0.6s ease-out',
                }}
              >
                <Image
                  src="/homepage/place-position.png"
                  alt="Place Your Position"
                  width={1920}
                  height={1080}
                  className="w-full h-auto"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Supported Markets Section - Marquee */}
      <section
        id="supported-coins"
        ref={coinsRef}
        className="relative py-20 bg-black overflow-hidden"
      >
        {/* Section Title */}
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl text-white inline-flex items-center justify-center gap-3 w-full">
            Supported
            <span className="relative inline-block px-4 py-1">
              <span
                className="absolute inset-0 bg-[#00d395] transition-transform duration-700 ease-out"
                style={{
                  transform: coinsVisible ? 'scaleX(1)' : 'scaleX(0)',
                  transformOrigin: 'left center',
                }}
              />
              <span className="relative">Markets</span>
            </span>
          </h2>
        </div>

        {/* Coin Cards */}
        <div className="flex justify-center gap-6 md:gap-12 px-6">
          {[
            { name: 'BTC', logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/bitcoin/info/logo.png' },
            { name: 'ETH', logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png' },
            { name: 'SOL', logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/info/logo.png' },
          ].map((coin) => (
            <div
              key={coin.name}
              className="flex flex-col items-center gap-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#00d395]/40 rounded-2xl py-8 px-10 md:px-16 transition-all duration-300 cursor-pointer"
            >
              <img
                src={coin.logo}
                alt={coin.name}
                className="w-14 h-14 md:w-20 md:h-20 rounded-full"
              />
              <span className="text-white text-base md:text-lg font-semibold tracking-wide">{coin.name}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Bento Grid Section */}
      <section className="relative py-20 px-6 sm:px-12 bg-black">
        <div className="container mx-auto max-w-7xl">
          {/* Mobile: single column cards */}
          <div className="flex flex-col gap-4 md:hidden">
            <div className="rounded-2xl border border-white/10 bg-[#111111] p-6 flex flex-col overflow-hidden relative min-h-[180px]">
              <h3 className="text-xl font-bold text-white">Account Abstraction</h3>
              <p className="text-gray-400 text-sm leading-relaxed font-medium pr-20">
                Trade seamlessly with Privy-powered smart wallets — no seed phrases, no hassle.
              </p>
              <Image src="/homepage/privy.png" alt="Privy" width={200} height={200} className="absolute w-[25%] object-contain" style={{ bottom: '10px', right: '15px' }} />
            </div>
            <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-[#1a1a1a] to-[#111111] p-6 flex flex-col overflow-hidden min-h-[300px]">
              <h3 className="text-2xl font-bold text-white mb-2">Relayer Wallet</h3>
              <p className="text-gray-400 text-sm leading-relaxed font-medium">
                Zero gas fees for every trade. Our relayer wallet covers all transaction costs so you can focus on trading, not fees.
              </p>
              <div className="flex-1 flex items-center justify-center mt-4">
                <Image
                  src="/homepage/ethra copy.png"
                  alt="Relayer Wallet"
                  width={400}
                  height={400}
                  className="w-[60%] object-contain"
                />
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-[#111111] to-[#1a1a1a] p-6 flex flex-col overflow-hidden relative min-h-[180px]">
              <h3 className="text-xl font-bold text-white">Pyth Oracle</h3>
              <p className="text-gray-400 text-sm leading-relaxed font-medium pr-20">
                Integrated with Pyth Network for real-time, high-fidelity price feeds.
              </p>
              <Image src="/homepage/pythivon.png" alt="Pyth Oracle" width={200} height={200} className="absolute w-[25%] object-contain" style={{ bottom: '10px', right: '20px' }} />
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#111111] p-6 flex flex-col overflow-hidden relative min-h-[180px]">
              <h3 className="text-xl font-bold text-white">Build on Mantle</h3>
              <p className="text-gray-400 text-sm leading-relaxed font-medium pr-20">
                Powered by Mantle Network for fast, low-cost, and secure transactions.
              </p>
              <Image src="/homepage/mantle.png" alt="Mantle Network" width={200} height={200} className="absolute w-[25%] object-contain" style={{ bottom: '10px', right: '20px' }} />
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#111111] p-6 flex flex-col overflow-hidden min-h-[280px]">
              <h3 className="text-2xl font-bold text-white mb-2">Seamless Trading</h3>
              <p className="text-gray-400 text-sm leading-relaxed font-medium">
                Enjoy a frictionless trading experience and sidestep blockchain congestion with One-Click Trading. Tap to place trades and manage your portfolio — all without waiting for confirmations or dealing with failed transactions.
              </p>
              <div className="flex-1 flex items-center justify-center mt-4">
                <Image src="/homepage/seamlesstrade.png" alt="Seamless Trading" width={300} height={200} className="w-[50%] object-contain" />
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#111111] p-6 flex flex-col overflow-hidden relative min-h-[180px]">
              <h3 className="text-xl font-bold text-white">Multi-Tap Drag</h3>
              <p className="text-gray-400 text-sm leading-relaxed font-medium pr-24">
                Drag across the chart to open dozens of positions at once — all bundled into a single transaction.
              </p>
              <Image
                src="/homepage/multi-drag.png"
                alt="Multi-Tap Drag"
                width={200}
                height={200}
                className="absolute w-[25%] object-contain"
                style={{ bottom: '10px', right: '20px' }}
              />
            </div>
          </div>

          {/* Desktop: bento grid */}
          <div className="hidden md:grid grid-cols-12 auto-rows-[200px] gap-4">
            {/* Box 1: row 1, cols 1-4 - Account Abstraction */}
            <div className="col-span-4 row-start-1 rounded-2xl border border-white/10 bg-[#111111] p-6 flex flex-col overflow-hidden relative">
              <h3 className="text-xl font-bold text-white">Account Abstraction</h3>
              <p className="text-gray-400 text-sm leading-relaxed font-medium pr-16">
                Trade seamlessly with Privy-powered smart wallets — no seed phrases, no hassle.
              </p>
              <Image
                src="/homepage/privy.png"
                alt="Privy"
                width={200}
                height={200}
                className="absolute w-[27%] object-contain"
                style={{ bottom: '0px', right: '10px' }}
              />
            </div>
            {/* Box 2: rows 1-2, cols 5-8 (tall middle) - Relayer Wallet */}
            <div className="col-span-4 row-span-2 col-start-5 row-start-1 rounded-2xl border border-white/10 bg-gradient-to-r from-[#1a1a1a] to-[#111111] p-6 border-r-0 flex flex-col overflow-hidden">
              <h3 className="text-2xl font-bold text-white mb-2">Relayer Wallet</h3>
              <p className="text-gray-400 text-sm leading-relaxed font-medium">
                Zero gas fees for every trade. Our relayer wallet covers all transaction costs so you can focus on trading, not fees.
              </p>
              <div className="flex-1 relative">
                <Image
                  src="/homepage/ethra copy.png"
                  alt="Relayer Wallet"
                  width={800}
                  height={800}
                  className="absolute w-[60%] max-w-none object-contain"
                  style={{ bottom: '-40px', left: '-10%' }}
                />
              </div>
            </div>
            {/* Box 3: row 1, cols 9-12 - Pyth Oracle */}
            <div className="col-span-4 col-start-9 row-start-1 rounded-2xl border border-white/10 bg-gradient-to-r from-[#111111] to-[#1a1a1a] p-6 flex flex-col overflow-hidden relative border-l-0">
              <h3 className="text-xl font-bold text-white">Pyth Oracle</h3>
              <p className="text-gray-400 text-sm leading-relaxed font-medium pr-16">
                Integrated with Pyth Network for real-time, high-fidelity price feeds.
              </p>
              <Image
                src="/homepage/pythivon.png"
                alt="Pyth Oracle"
                width={200}
                height={200}
                className="absolute w-[27%] object-contain"
                style={{ bottom: '-30px', right: '40px' }}
              />
            </div>
            {/* Box 4: row 2, cols 1-4 - Build on Mantle */}
            <div className="col-span-4 col-start-1 row-start-2 rounded-2xl border border-white/10 bg-[#111111] p-6 flex flex-col overflow-hidden relative">
              <h3 className="text-xl font-bold text-white">Build on Mantle</h3>
              <p className="text-gray-400 text-sm leading-relaxed font-medium pr-16">
                Powered by Mantle Network for fast, low-cost, and secure transactions.
              </p>
              <Image
                src="/homepage/mantle.png"
                alt="Mantle Network"
                width={200}
                height={200}
                className="absolute w-[27%] object-contain"
                style={{ bottom: '10px', right: '20px' }}
              />
            </div>
            {/* Box 5: row 2, cols 9-12 - Privy Account Abstraction mini */}
            <div className="col-span-4 col-start-9 row-start-2 rounded-2xl border border-white/10 bg-[#111111] p-6 flex flex-col overflow-hidden relative border-l-0">
              <h3 className="text-xl font-bold text-white">Zero Gas Fees</h3>
              <p className="text-gray-400 text-sm leading-relaxed font-medium pr-16">
                Our relayer covers all on-chain costs — trade without ever worrying about gas.
              </p>
            </div>
            {/* Box 6: row 3, cols 1-8 - Seamless Trading */}
            <div className="col-span-8 col-start-1 row-start-3 rounded-2xl border border-white/10 bg-[#111111] p-8 flex items-center justify-between overflow-hidden">
              <div className="flex-1 min-w-0 pr-8">
                <h3 className="text-2xl font-bold text-white mb-2">Seamless Trading</h3>
                <p className="text-gray-400 text-sm leading-relaxed font-medium">
                  Enjoy a frictionless trading experience and sidestep blockchain congestion with One-Click Trading. Tap to place trades and manage your portfolio — all without waiting for confirmations or dealing with failed transactions.
                </p>
              </div>
              <div className="flex-shrink-0">
                <Image
                  src="/homepage/seamlesstrade.png"
                  alt="Seamless Trading"
                  width={300}
                  height={200}
                  className="h-[150px] w-auto object-contain"
                />
              </div>
            </div>
            {/* Box 7: row 3, cols 9-12 - Multi-Tap Trading */}
            <div className="col-span-4 col-start-9 row-start-3 rounded-2xl border border-white/10 bg-[#111111] p-6 flex flex-col overflow-hidden relative">
              <h3 className="text-xl font-bold text-white">Multi-Tap Drag</h3>
              <p className="text-gray-400 text-sm leading-relaxed font-medium pr-24">
                Drag across the chart to open dozens of positions at once — all bundled into a single transaction.
              </p>
              <Image
                src="/homepage/multi-drag.png"
                alt="Multi-Tap Drag"
                width={200}
                height={200}
                className="absolute w-[30%] object-contain"
                style={{ bottom: '10px', right: '20px' }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8 px-4 mt-20">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <Image
                src="/mantle-tap-polos.png"
                alt="MantleTap Finance Logo"
                width={24}
                height={24}
                className="w-6 h-6"
              />
              <span className="text-gray-400">© 2026 MantleTap. All rights reserved.</span>
            </div>
            <div className="flex gap-6 text-gray-400">
               <span className="hover:text-white transition-colors">X</span>
              <span className="hover:text-white transition-colors">Discord</span>
              <Link
                href="https://github.com/imferdinandd/mantle-tap"
                target="_blank"
                className="hover:text-white transition-colors"
              >
                GitHub
              </Link>
              <span className="hover:text-white transition-colors">Docs</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Custom Animations */}
      <style jsx global>{`
        /* Smooth scroll */
        html {
          scroll-behavior: smooth;
        }

        /* Hide scrollbar */
        body::-webkit-scrollbar {
          display: none;
        }
        body {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }

        @keyframes gradientShift {
          0%,
          100% {
            opacity: 0.3;
            transform: scale(1) rotate(0deg);
          }
          50% {
            opacity: 0.6;
            transform: scale(1.1) rotate(5deg);
          }
        }

        @keyframes gridMove {
          0% {
            transform: translate(0, 0);
          }
          100% {
            transform: translate(50px, 50px);
          }
        }

        @keyframes float {
          0%,
          100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(30px, -30px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
        }

        @keyframes floatSlow {
          0%,
          100% {
            transform: translate(0, 0) rotate(0deg);
          }
          25% {
            transform: translate(20px, -40px) rotate(90deg);
          }
          50% {
            transform: translate(-30px, -20px) rotate(180deg);
          }
          75% {
            transform: translate(-10px, 30px) rotate(270deg);
          }
        }

        @keyframes rotate {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes marqueeScroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }

        @keyframes shimmer {
          0% {
            background-position: -1000px 0;
          }
          100% {
            background-position: 1000px 0;
          }
        }

        /* Enhance existing animations */
        .animate-pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        @keyframes pulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }

        /* Scroll-based animations */
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .fade-in-up {
          animation: fadeInUp 0.6s ease-out forwards;
        }

        /* Glow effect */
        @keyframes glow {
          0%,
          100% {
            box-shadow: 0 0 20px rgba(6, 182, 212, 0.3);
          }
          50% {
            box-shadow: 0 0 40px rgba(6, 182, 212, 0.6), 0 0 60px rgba(16, 185, 129, 0.4);
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.8);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}
