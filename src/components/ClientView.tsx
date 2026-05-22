/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useBarber } from '../context/BarberContext';
import { getEstimatedWaitTime, formatFCFA } from '../utils';
import { motion, AnimatePresence } from 'motion/react';
import { Scissors, Clock, Users, Flame, ChevronRight, Sparkles, Check, User, ArrowLeft, Trash2, Calendar } from 'lucide-react';

export default function ClientView() {
  const {
    shopName,
    barbers,
    services,
    queue,
    joinQueue,
    leaveQueue,
    clientActiveTicketId,
  } = useBarber();

  const [currentUrlPath, setCurrentUrlPath] = useState(window.location.pathname);

  // Maintain client path routing state
  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentUrlPath(window.location.pathname);
    };
    window.addEventListener('popstate', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, []);

  const getPreselectedBarberId = () => {
    if (currentUrlPath.startsWith('/shop/') && currentUrlPath.includes('/join/')) {
      const parts = currentUrlPath.split('/');
      if (parts.length >= 5) {
        return parts[4];
      }
    }
    return null;
  };

  const getTicketIdFromPath = () => {
    if (currentUrlPath.startsWith('/ticket/')) {
      return currentUrlPath.split('/').pop() || null;
    }
    return null;
  };

  const [selectedBarberId, setSelectedBarberId] = useState<string | null>(() => {
    return getPreselectedBarberId();
  });

  useEffect(() => {
    const preMatch = getPreselectedBarberId();
    if (preMatch) {
      setSelectedBarberId(preMatch);
    } else {
      setSelectedBarberId(null);
    }
  }, [currentUrlPath]);

  const [selectedServiceId, setSelectedServiceId] = useState<string>(services[0]?.id || '');
  const [clientName, setClientName] = useState<string>('');
  const [clientPhone, setClientPhone] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [clientActiveElapsedTime, setClientActiveElapsedTime] = useState<string>('00:00');

  // Active client ticket if registered in local session or from URL route
  const ticketIdFromPath = getTicketIdFromPath();
  const activeTicketId = ticketIdFromPath || clientActiveTicketId;
  const activeTicket = queue.find((q) => q.id === activeTicketId);

  useEffect(() => {
    if (!activeTicket || activeTicket.status !== 'active' || !activeTicket.startedAt) {
      setClientActiveElapsedTime('00:00');
      return;
    }

    const updateTimer = () => {
      const start = new Date(activeTicket.startedAt!).getTime();
      const now = Date.now();
      const totalSeconds = Math.max(0, Math.floor((now - start) / 1000));
      const mm = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
      const ss = (totalSeconds % 60).toString().padStart(2, '0');
      setClientActiveElapsedTime(`${mm}:${ss}`);
    };

    updateTimer();
    const intervalId = setInterval(updateTimer, 1000);

    return () => clearInterval(intervalId);
  }, [activeTicket?.id, activeTicket?.status, activeTicket?.startedAt]);

  // Helper info for selected barber
  const selectedBarber = barbers.find((b) => b.id === selectedBarberId);

  // Handle joining queue
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBarberId || !clientName.trim()) return;

    setIsSubmitting(true);
    setTimeout(() => {
      const newItem = joinQueue(clientName.trim(), clientPhone.trim(), selectedBarberId, selectedServiceId);
      setIsSubmitting(false);
      // Reset form states
      setClientName('');
      setClientPhone('');
      setSelectedBarberId(null);
      // Navigate to the ticket page
      window.history.pushState({}, '', `/ticket/${newItem.id}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, 600);
  };

  const handleLeaveQueue = (ticketId: string) => {
    leaveQueue(ticketId);
    const shopId = localStorage.getItem('barberq_shop_id') || 'default-shop';
    window.history.pushState({}, '', `/shop/${shopId}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  // Compute stats for a single barber
  const getBarberStats = (barberId: string, barberAvgTime: number) => {
    const barberQueue = queue.filter(
      (q) => q.barberId === barberId && (q.status === 'waiting' || q.status === 'active')
    );
    const waitingCount = barberQueue.length;
    const estTime = getEstimatedWaitTime(queue, barberId, barberAvgTime);
    
    return {
      waitingCount,
      estTime,
    };
  };

  // Find exact index of active user's ticket in the queue
  const getQueuePosition = () => {
    if (!activeTicket) return 0;
    
    // Position is number of "waiting" or "active" people in line before of after (excluding completed/cancelled)
    const barberQueue = queue.filter(
      (q) => q.barberId === activeTicket.barberId && q.status === 'waiting'
    );
    
    const activePerson = queue.find(
      (q) => q.barberId === activeTicket.barberId && q.status === 'active'
    );

    const matchIndex = barberQueue.findIndex((q) => q.id === activeTicket.id);
    
    // If active ticket status is already active, position is 1
    if (activeTicket.status === 'active') {
      return 1;
    }
    
    // Else, position is activePerson counter + index in waitlist + 1
    return (activePerson ? 1 : 0) + matchIndex + 1;
  };

  // Get general wait position stats
  const getProgressStats = () => {
    if (!activeTicket) return { totalInLine: 0, currentPosition: 0, completedCount: 0 };
    
    const barberQueue = queue.filter(
      (q) => q.barberId === activeTicket.barberId && (q.status === 'waiting' || q.status === 'active')
    );
    
    const completedToday = queue.filter(
      (q) => q.barberId === activeTicket.barberId && q.status === 'completed'
    ).length;

    const currentPos = getQueuePosition();
    return {
      totalInLine: barberQueue.length,
      currentPosition: currentPos,
      completedCount: completedToday,
    };
  };

  return (
    <div className="w-full">
      <AnimatePresence mode="wait">
        {/* VIEW 1: ACTIVE DIGITAL TICKET */}
        {activeTicket && (activeTicket.status === 'waiting' || activeTicket.status === 'active') ? (
          <motion.div
            key="ticket-view"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3 }}
            className="px-4 py-3"
          >
            <div className="text-center mb-6">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-neutral-800 text-neutral-300 border border-neutral-700/50 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
                Ticket En Direct
              </span>
              <p className="text-sm font-medium text-neutral-400">{shopName}</p>
              <h3 className="text-base font-semibold text-white/90">
                Barbier : {barbers.find((b) => b.id === activeTicket.barberId)?.name || 'Moussa Keïta'}
              </h3>
            </div>

            {/* Print Ticket layout */}
            <div className="relative overflow-hidden bg-white rounded-2xl shadow-xl border border-neutral-200 text-neutral-800 mb-5">
              {/* Top ticket part */}
              <div className="bg-neutral-900 px-6 py-6 text-center text-white relative">
                <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-widest block mb-1">
                  Ta Position Active
                </span>
                <h1 className="text-6xl font-bold font-mono tracking-tight leading-none my-1">
                  {getQueuePosition()}
                </h1>
                <p className="text-xs text-neutral-400 mt-2">
                  dans la file d'attente
                </p>
                {activeTicket.status === 'active' && (
                  <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-500/20 text-green-400 border border-green-500/30 animate-pulse font-mono">
                    <Flame className="w-3.5 h-3.5 text-orange-400 animate-bounce" /> {clientActiveElapsedTime}
                  </div>
                )}
              </div>

              {/* Seamless ticket notches dashed border */}
              <div className="flex items-center bg-white h-5 pointer-events-none relative z-10">
                <div className="w-4 h-4 rounded-full bg-neutral-900 -ml-2 border-r border-neutral-200"></div>
                <div className="flex-1 border-t-2 border-dashed border-neutral-200 mx-2"></div>
                <div className="w-4 h-4 rounded-full bg-neutral-900 -mr-2 border-l border-neutral-200"></div>
              </div>

              {/* Bottom details and billing summary */}
              <div className="px-5 pb-6 pt-2 bg-white space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-neutral-100">
                  <span className="text-xs text-neutral-400 font-medium">Prénom</span>
                  <span className="text-sm text-neutral-800 font-semibold">{activeTicket.clientName}</span>
                </div>
                {activeTicket.phone && (
                  <div className="flex justify-between items-center py-2 border-b border-neutral-100">
                    <span className="text-xs text-neutral-400 font-medium">Numéro de tél.</span>
                    <span className="text-sm text-neutral-850 font-semibold">{activeTicket.phone}</span>
                  </div>
                )}
                <div className="flex justify-between items-center py-2 border-b border-neutral-100">
                  <span className="text-xs text-neutral-400 font-medium">Service sollicité</span>
                  <span className="text-sm text-neutral-800 font-semibold">{activeTicket.serviceName}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-neutral-100">
                  <span className="text-xs text-neutral-400 font-medium">Prix estimé</span>
                  <span className="text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 text-neutral-800 px-2.5 py-1 rounded-md">
                    {formatFCFA(activeTicket.price)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-xs text-neutral-400 font-medium">Temps d'attente estimé</span>
                  <span className="text-xs font-semibold bg-green-50 text-green-700 px-2.5 py-1 rounded-md flex items-center gap-1 font-mono">
                    <Clock className="w-3.5 h-3.5 animate-pulse" />
                    {activeTicket.status === 'active' ? `En cours (~${clientActiveElapsedTime})` : `~${getEstimatedWaitTime(queue, activeTicket.barberId, barbers.find((b) => b.id === activeTicket.barberId)?.avgTime || 20)} min`}
                  </span>
                </div>
              </div>
            </div>

            {/* Waiting list progress bars */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-medium text-neutral-400">Avancement de la file</span>
                <span className="text-xs font-semibold text-green-400">
                  Position {getQueuePosition()} de {getProgressStats().totalInLine} clients
                </span>
              </div>
              
              {/* Progress bar */}
              <div className="w-full bg-neutral-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-green-500 h-full rounded transition-all duration-500"
                  style={{
                    width: `${Math.max(
                      10,
                      Math.min(
                        100,
                        ((getProgressStats().totalInLine - getQueuePosition() + 1) /
                          Math.max(1, getProgressStats().totalInLine)) *
                          100
                      )
                    )}%`,
                  }}
                ></div>
              </div>
              <div className="flex justify-between text-[11px] text-neutral-500 mt-2">
                <span>{getProgressStats().completedCount} coupes terminées aujourd'hui</span>
                <span>File d'attente fluide</span>
              </div>
            </div>

            <button
              onClick={() => handleLeaveQueue(activeTicket.id)}
              className="w-full bg-neutral-900 hover:bg-red-950/20 text-neutral-400 hover:text-red-400 border border-neutral-800 hover:border-red-900/40 rounded-xl py-3 text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              Abandonner / Quitter la file d'attente
            </button>
          </motion.div>
        ) : (
          /* VIEW 2: BROWSE BARBERSHOP & JOIN LINE */
          <motion.div
            key="browse-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full"
          >
            {/* Shop Hero banner */}
            <div className="bg-neutral-950 px-5 pt-5 pb-5 border-b border-neutral-800">
              <div className="flex items-center gap-3.5 mb-4">
                <div className="w-12 h-12 rounded-xl bg-white text-neutral-900 flex items-center justify-center shadow-lg font-bold text-xl">
                  ✂️
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white tracking-tight">{shopName}</h3>
                  <p className="text-xs text-neutral-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                    Ouvert · jusqu'à 20h
                  </p>
                </div>
              </div>

              {/* Live quick performance stats */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-neutral-900 border border-neutral-800/80 rounded-xl py-2 px-1 text-center">
                  <span className="text-sm font-bold text-white block">4.9 ★</span>
                  <span className="text-[9px] text-neutral-500 block uppercase font-medium mt-0.5">Note</span>
                </div>
                <div className="bg-neutral-900 border border-neutral-800/80 rounded-xl py-2 px-1 text-center">
                  <span className="text-sm font-bold text-white block">
                    {queue.filter((q) => q.status === 'waiting' || q.status === 'active').length}
                  </span>
                  <span className="text-[9px] text-neutral-500 block uppercase font-medium mt-0.5">En Ligne</span>
                </div>
                <div className="bg-neutral-950 border border-neutral-800/85 rounded-xl py-2 px-1 text-center font-mono text-emerald-400">
                  <span className="text-xs font-bold block mt-1">Live</span>
                  <span className="text-[8px] text-neutral-500 uppercase font-medium tracking-wide">File</span>
                </div>
              </div>
            </div>

            <div className="p-4">
              <AnimatePresence mode="wait">
                {!selectedBarberId ? (
                  /* Step A: Choose Barber */
                  <motion.div
                    key="step-barber"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="space-y-3.5"
                  >
                    <p className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest px-1">
                      Choisir Votre Coiffeur
                    </p>

                    {barbers.map((barber) => {
                      const stats = getBarberStats(barber.id, barber.avgTime);
                      const isOffline = barber.status === 'offline';
                      return (
                        <div
                          key={barber.id}
                          onClick={() => {
                            if (!isOffline) {
                              setSelectedBarberId(barber.id);
                              const shopId = localStorage.getItem('barberq_shop_id') || 'default-shop';
                              window.history.pushState({}, '', `/shop/${shopId}/join/${barber.id}`);
                              window.dispatchEvent(new PopStateEvent('popstate'));
                            }
                          }}
                          className={`group relative flex items-center gap-3.5 p-3.5 bg-neutral-900 border rounded-2xl transition-all ${
                            isOffline
                              ? 'opacity-50 cursor-not-allowed border-neutral-800'
                              : 'active:scale-[0.98] border-neutral-800 hover:border-neutral-700 cursor-pointer'
                          }`}
                        >
                          <div
                            className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold shadow-sm ${
                              barber.id === 'moussa'
                                ? 'bg-amber-550 bg-neutral-800 text-stone-200 border border-stone-600'
                                : 'bg-neutral-800 text-neutral-300'
                            }`}
                          >
                            {barber.initials}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <h4 className="text-sm font-semibold text-white group-hover:text-green-400 transition-colors">
                                {barber.name}
                              </h4>
                              {isOffline && (
                                <span className="text-[10px] bg-neutral-850 px-1.5 py-0.5 rounded text-neutral-500 font-medium">
                                  Absent
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-neutral-400 truncate mt-0.5">
                              {barber.specialties.join(' · ')}
                            </p>
                          </div>

                          {!isOffline && (
                            <div className="text-right">
                              <span className="text-lg font-mono font-bold text-white block leading-none">
                                {stats.waitingCount}
                              </span>
                              <span className="text-[10px] text-neutral-500 font-mono">
                                {stats.estTime === 0 ? 'Disponible' : `~${stats.estTime}m`}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </motion.div>
                ) : (
                  /* Step B: Fill Check-in Details */
                  <motion.div
                    key="step-form"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="bg-neutral-900 border border-neutral-800/80 rounded-2xl p-4 shadow-md"
                  >
                    <button
                      onClick={() => {
                        setSelectedBarberId(null);
                        const shopId = localStorage.getItem('barberq_shop_id') || 'default-shop';
                        window.history.pushState({}, '', `/shop/${shopId}`);
                        window.dispatchEvent(new PopStateEvent('popstate'));
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-neutral-400 hover:text-white mb-4 bg-neutral-800 px-2.5 py-1 rounded-lg transition-colors"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> Changer de coiffeur
                    </button>

                    <h4 className="text-sm font-bold text-white mb-1">Prendre Un Ticket</h4>
                    <p className="text-xs text-neutral-400 mb-4">
                      Coiffeur sélectionné : <span className="text-green-400 font-medium">{selectedBarber?.name}</span>
                    </p>

                    <form onSubmit={handleSubmit} className="space-y-4">
                      {/* Name client Input */}
                      <div>
                        <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5">
                          Votre Prénom / Nom <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            required
                            placeholder="Ex: Thierno, Daouda, Seydou..."
                            value={clientName}
                            onChange={(e) => setClientName(e.target.value)}
                            maxLength={25}
                            className="w-full bg-neutral-950 border border-neutral-850 focus:border-green-500/50 outline-none text-white text-sm rounded-xl py-2.5 pl-3 pr-10 transition-colors"
                          />
                          <User className="absolute right-3 top-3 w-4 h-4 text-neutral-500" />
                        </div>
                      </div>

                      {/* Phone client Input */}
                      <div>
                        <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5">
                          Votre Numéro de téléphone <span className="text-neutral-500 text-[9px] lowercase font-normal">(optionnel)</span>
                        </label>
                        <div className="relative">
                          <input
                            type="tel"
                            placeholder="Ex: +224 622 00 00 00"
                            value={clientPhone}
                            onChange={(e) => setClientPhone(e.target.value)}
                            maxLength={20}
                            className="w-full bg-neutral-950 border border-neutral-850 focus:border-green-500/50 outline-none text-white text-sm rounded-xl py-2.5 pl-3 pr-10 transition-colors"
                          />
                          <span className="absolute right-3.5 top-3.5 text-xs text-neutral-500 font-mono">📱</span>
                        </div>
                        <p className="text-[10px] text-neutral-500 mt-1">
                          Sert au coiffeur pour vous contacter ou vous envoyer votre reçu.
                        </p>
                      </div>

                      {/* Service Selector */}
                      <div>
                        <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5">
                          Prestation demandée
                        </label>
                        <div className="space-y-2">
                          {services.map((service) => (
                            <label
                              key={service.id}
                              onClick={() => setSelectedServiceId(service.id)}
                              className={`flex justify-between items-center p-2.5 rounded-xl border transition-all cursor-pointer ${
                                selectedServiceId === service.id
                                  ? 'bg-green-500/10 border-green-500/40 text-green-300'
                                  : 'bg-neutral-950 text-neutral-300 border-neutral-850 hover:border-neutral-800'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                  selectedServiceId === service.id ? 'border-green-400' : 'border-neutral-600'
                                }`}>
                                  {selectedServiceId === service.id && <div className="w-2 h-2 rounded-full bg-green-400"></div>}
                                </div>
                                <div className="text-left">
                                  <p className="text-xs font-semibold">{service.name}</p>
                                  <p className="text-[10px] text-neutral-500">{service.duration} mins de coiffe</p>
                                </div>
                              </div>
                              <span className="text-xs font-bold font-mono">
                                {formatFCFA(service.price)}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Summary alert info before joining */}
                      <div className="rounded-xl bg-neutral-950 p-3 space-y-1 text-[11px] text-neutral-400 border border-neutral-850">
                        <div className="flex justify-between">
                          <span>Temps d'attente estimé :</span>
                          <span className="text-white font-medium">
                            ~{getEstimatedWaitTime(queue, selectedBarberId || '', selectedBarber?.avgTime || 20)} mins
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Clients devant vous :</span>
                          <span className="text-white font-medium">
                            {queue.filter((q) => q.barberId === selectedBarberId && (q.status === 'waiting' || q.status === 'active')).length}
                          </span>
                        </div>
                      </div>

                      {/* Submit */}
                      <button
                        type="submit"
                        disabled={isSubmitting || !clientName.trim()}
                        className="w-full bg-white hover:bg-neutral-100 disabled:bg-neutral-850 disabled:text-neutral-500 text-neutral-950 font-bold rounded-xl py-3 text-sm tracking-tight transition-all active:scale-[0.99] flex items-center justify-center gap-1.5 shadow-md shadow-white/5"
                      >
                        {isSubmitting ? (
                          <div className="w-4 h-4 rounded-full border-2 border-neutral-950 border-t-transparent animate-spin"></div>
                        ) : (
                          <>
                            Rejoindre la file d'attente
                            <ChevronRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
