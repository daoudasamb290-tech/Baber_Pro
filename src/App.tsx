/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { BarberProvider, useBarber } from './context/BarberContext';
import ClientView from './components/ClientView';
import BarberDashboard from './components/BarberDashboard';
import AccountingView from './components/AccountingView';
import HelpGuide from './components/HelpGuide';
import { BarberLogin, BarberRegister, BarberSetup } from './components/BarberAuth';
import { supabase } from './lib/supabase';
import { Scissors, User, DollarSign, Wifi, Battery, Smartphone, Clock, Sparkles, Sun, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

function AppContent() {
  const { currentRole, setCurrentRole, queue, shopName } = useBarber();
  const [currentPath, setCurrentPath] = useState<string>(window.location.pathname);
  const isBarberSide = currentPath === '/barber/dashboard' || currentPath === '/barber/accounting';
  const [currentTime, setCurrentTime] = useState<string>('12:00');
  const [user, setUser] = useState<any>(null);
  const [userLoading, setUserLoading] = useState<boolean>(true);
  const [isLight, setIsLight] = useState<boolean>(() => {
    return localStorage.getItem('barberpro_theme') === 'light';
  });

  // Sync light/dark theme with document body/root element
  useEffect(() => {
    if (isLight) {
      document.documentElement.classList.add('light');
      localStorage.setItem('barberpro_theme', 'light');
    } else {
      document.documentElement.classList.remove('light');
      localStorage.setItem('barberpro_theme', 'dark');
    }
  }, [isLight]);

  // Sync Supabase Auth session dynamically
  useEffect(() => {
    const isOffline = localStorage.getItem('barberq_offline_session') === 'true';
    if (isOffline) {
      setUser({ id: 'offline-barber', email: 'demo@barberpro.fr', isOffline: true });
      setUserLoading(false);
      return;
    }

    if (!supabase) {
      setUserLoading(false);
      return;
    }

    // Get current logged in user
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setUserLoading(false);
    });

    // Listen to real-time auth status updates
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (localStorage.getItem('barberq_offline_session') === 'true') {
        return;
      }
      setUser(session?.user ?? null);
      setUserLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Monitor location back/forward popstate trigger
  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, []);

  // Main custom navigation utility
  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  // Keep Role Tab synchronized with pathname state
  useEffect(() => {
    if (currentPath === '/barber/dashboard') {
      setCurrentRole('barber');
    } else if (currentPath === '/barber/accounting') {
      setCurrentRole('admin');
    } else if (currentPath === '/' || currentPath.startsWith('/shop/') || currentPath.startsWith('/ticket/')) {
      setCurrentRole('client');
    }
  }, [currentPath, setCurrentRole]);

  // Protected Routes verification
  const securePaths = ['/barber/dashboard', '/barber/setup', '/barber/accounting'];
  const isSecurePath = securePaths.includes(currentPath);

  useEffect(() => {
    if (isSecurePath && !user && !userLoading) {
      navigate('/barber/login');
    }
  }, [currentPath, user, userLoading, isSecurePath]);

  // Dynamic ticking clock for top mobile status bar
  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      const hh = d.getHours().toString().padStart(2, '0');
      const mm = d.getMinutes().toString().padStart(2, '0');
      setCurrentTime(`${hh}:${mm}`);
    };
    updateTime();
    const id = setInterval(updateTime, 1000 * 30);
    return () => clearInterval(id);
  }, []);

  const totalWaiting = queue.filter(
    (q) => q.status === 'waiting' || q.status === 'active'
  ).length;

  // Render Full Screen auth & onboarding screens (centrées sur fond #f5f5f3)
  if (currentPath === '/barber/login') {
    return <BarberLogin navigate={navigate} onAuthSuccess={() => {}} />;
  }

  if (currentPath === '/barber/register') {
    return <BarberRegister navigate={navigate} />;
  }

  if (currentPath === '/barber/setup') {
    if (userLoading) {
      return (
        <div className="min-h-screen bg-[#f5f5f3] flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-neutral-900 border-t-transparent animate-spin"></div>
        </div>
      );
    }
    return <BarberSetup navigate={navigate} />;
  }

  if (userLoading && isSecurePath) {
    return (
      <div className="min-h-screen bg-[#0a0a09] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-amber-500 border-t-transparent animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-theme-bg-outer flex flex-col items-center justify-center p-0 sm:p-6 overflow-x-hidden select-none transition-colors duration-200">
      
      {/* Upper Desktop Branding Panel (hidden on small screens) */}
      <div className="hidden sm:flex flex-col items-center gap-1.5 mb-5 text-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-neutral-900 border border-neutral-800 text-green-400 font-mono transition-colors">
          <Sparkles className="w-3.5 h-3.5 text-yellow-500 animate-pulse" />
          Barber_Pro App
        </div>
        <h1 className="text-2xl font-black text-neutral-100 tracking-widest uppercase font-mono transition-colors">
          Barber_Pro
        </h1>
        <p className="text-xs text-neutral-500 font-medium font-mono transition-colors">
          Queue & comptabilité en temps réel
        </p>
      </div>

      {/* Main Interactive Smartphone Mock Frame */}
      <div className="w-full max-w-sm sm:h-[812px] sm:rounded-[44px] bg-theme-bg-frame sm:border-4 sm:border-theme-border-frame sm:shadow-[0_0_80px_rgba(0,0,0,0.15)] relative overflow-hidden flex flex-col select-none transition-all duration-200">
        
        {/* Dynamic Mobile Status Bar Header (hidden/custom styled looking clean) */}
        <div className="bg-theme-bg-header border-b border-theme-border-header px-4 pt-3 pb-2 flex justify-between items-center shrink-0 relative z-20 transition-colors">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-black text-neutral-100 tracking-wider font-mono transition-colors">
              BARBER_PRO
            </span>
          </div>
          {/* Speaker Notch for high-fidelity phone look (Only on desktop frame) */}
          <div className="hidden sm:block w-20 h-4 bg-neutral-800 rounded-full -mt-2 absolute top-2 left-1/2 -translate-x-1/2 border border-neutral-700"></div>
          
          {/* Mode Switch Button */}
          <button
            onClick={() => setIsLight(prev => !prev)}
            className="flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 hover:border-neutral-500 transition-all cursor-pointer font-mono"
            aria-label="Changer de thème"
          >
            {isLight ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-500 animate-[spin_8s_linear_infinite]" />
                <span>CLAIR</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                <span>SOMBRE</span>
              </>
            )}
          </button>
        </div>

        {/* Dynamic App Sub Header Role-tabs Router */}
        {!(currentPath.startsWith('/shop/') || currentPath.startsWith('/ticket/')) && (
          <div className="bg-theme-bg-header border-b border-theme-border-header p-2 flex gap-1 justify-center shrink-0 transition-colors">
            <button
              onClick={() => navigate('/')}
              className={`flex-1 flex flex-col items-center justify-center py-2.5 px-1 rounded-xl transition-all relative ${
                currentPath === '/'
                  ? 'bg-theme-bg-tab-selected text-neutral-100 border border-neutral-700/50'
                  : 'text-neutral-500 hover:text-neutral-400'
              }`}
            >
              <Smartphone className="w-4 h-4 mb-1" />
              <span className="text-[10px] font-bold block font-mono">Boutique</span>
              {totalWaiting > 0 && currentPath !== '/' && (
                <span className="absolute top-1.5 right-2 min-w-4 h-4 px-1 rounded-full bg-green-500 text-[9px] font-bold text-neutral-950 flex items-center justify-center font-mono">
                  {totalWaiting}
                </span>
              )}
            </button>

            <button
              onClick={() => navigate('/barber/dashboard')}
              className={`flex-1 flex flex-col items-center justify-center py-2.5 px-1 rounded-xl transition-all relative ${
                currentPath === '/barber/dashboard'
                  ? 'bg-theme-bg-tab-selected text-neutral-100 border border-neutral-700/50'
                  : 'text-neutral-500 hover:text-neutral-400'
              }`}
            >
              <Scissors className="w-4 h-4 mb-1" />
              <span className="text-[10px] font-bold block font-mono">Barbiers</span>
            </button>

            <button
              onClick={() => navigate('/barber/accounting')}
              className={`flex-1 flex flex-col items-center justify-center py-2.5 px-1 rounded-xl transition-all relative ${
                currentPath === '/barber/accounting'
                  ? 'bg-theme-bg-tab-selected text-neutral-100 border border-neutral-700/50'
                  : 'text-neutral-500 hover:text-neutral-400'
              }`}
            >
              <DollarSign className="w-4 h-4 mb-1" />
              <span className="text-[10px] font-bold block font-mono">Compta</span>
            </button>
          </div>
        )}

        {/* Phone screen main interactive scroll body area */}
        <div className="flex-1 overflow-y-auto bg-neutral-950 text-neutral-200 transition-colors duration-200">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPath}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
              className="w-full"
            >
              {(currentPath === '/' || currentPath.startsWith('/shop/') || currentPath.startsWith('/ticket/') || currentRole === 'client') && <ClientView />}
              {currentPath === '/barber/dashboard' && <BarberDashboard />}
              {currentPath === '/barber/accounting' && <AccountingView />}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Dynamic soft-key bottom home bar (For high-quality native design iOS look on Desktop) */}
        <div className="hidden sm:block h-6 bg-neutral-950 shrink-0 relative transition-colors">
          <div className="w-28 h-1 bg-neutral-700/80 rounded-full absolute bottom-1.5 left-1/2 -translate-x-1/2"></div>
        </div>
      </div>

      {/* Embedded Help Guide floating panel for barbers */}
      {isBarberSide && <HelpGuide />}

      {/* Footer copyright */}
      <p className="text-[10px] text-neutral-700 font-mono mt-6 hidden sm:block">
        © 2026 Barber_Pro Inc. All rights reserved.
      </p>
    </div>
  );
}

export default function App() {
  return (
    <BarberProvider>
      <AppContent />
    </BarberProvider>
  );
}
