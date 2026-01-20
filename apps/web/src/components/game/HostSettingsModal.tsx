'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { Room, Stakes, CustomRules } from '@poker/shared';

interface HostSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: Room;
  onSave: (settings: RoomSettingsUpdate) => void;
}

export interface RoomSettingsUpdate {
  stakes?: Partial<Stakes>;
  maxPlayers?: number;
  customRules?: Partial<CustomRules>;
}

export function HostSettingsModal({ isOpen, onClose, room, onSave }: HostSettingsModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Local state for form values (use strings for number inputs to allow clearing)
  const [smallBlindStr, setSmallBlindStr] = useState(String(room.stakes.smallBlind));
  const [bigBlindStr, setBigBlindStr] = useState(String(room.stakes.bigBlind));
  const [anteStr, setAnteStr] = useState(String(room.stakes.ante || 0));
  const [maxPlayers, setMaxPlayers] = useState(room.maxPlayers);
  const [bombPotEnabled, setBombPotEnabled] = useState(room.customRules.bombPotEnabled);
  const [bombPotAmountStr, setBombPotAmountStr] = useState(String(room.customRules.bombPotAmount || room.stakes.bigBlind * 10));
  const [straddleEnabled, setStraddleEnabled] = useState(room.customRules.straddleEnabled);
  const [runItTwice, setRunItTwice] = useState(room.customRules.runItTwice);
  const [runItThrice, setRunItThrice] = useState(room.customRules.runItThrice);
  const [runOutOnFold, setRunOutOnFold] = useState(room.customRules.runOutOnFold);
  const [sevenDeuce, setSevenDeuce] = useState(room.customRules.sevenDeuce);
  const [sevenDeuceBonusStr, setSevenDeuceBonusStr] = useState(String(room.customRules.sevenDeuceBonus || room.stakes.bigBlind * 5));

  // Parse string values to numbers (with defaults)
  const smallBlind = parseInt(smallBlindStr) || 0;
  const bigBlind = parseInt(bigBlindStr) || 0;
  const ante = parseInt(anteStr) || 0;
  const bombPotAmount = parseInt(bombPotAmountStr) || 0;
  const sevenDeuceBonus = parseInt(sevenDeuceBonusStr) || 0;

  // Reset form when room changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setSmallBlindStr(String(room.stakes.smallBlind));
      setBigBlindStr(String(room.stakes.bigBlind));
      setAnteStr(String(room.stakes.ante || 0));
      setMaxPlayers(room.maxPlayers);
      setBombPotEnabled(room.customRules.bombPotEnabled);
      setBombPotAmountStr(String(room.customRules.bombPotAmount || room.stakes.bigBlind * 10));
      setStraddleEnabled(room.customRules.straddleEnabled);
      setRunItTwice(room.customRules.runItTwice);
      setRunItThrice(room.customRules.runItThrice);
      setRunOutOnFold(room.customRules.runOutOnFold);
      setSevenDeuce(room.customRules.sevenDeuce);
      setSevenDeuceBonusStr(String(room.customRules.sevenDeuceBonus || room.stakes.bigBlind * 5));
    }
  }, [isOpen, room]);

  // Handle click outside to close
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    // Add slight delay to prevent immediate close on button click
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const handleSave = () => {
    onSave({
      stakes: {
        smallBlind, // Allow 0
        bigBlind,   // Allow 0
        ante: ante || undefined, // Only include if > 0
        minBuyIn: room.stakes.minBuyIn,
        maxBuyIn: room.stakes.maxBuyIn,
      },
      maxPlayers,
      customRules: {
        bombPotEnabled,
        bombPotAmount, // Allow 0 for bomb pot ante
        straddleEnabled,
        runItTwice,
        runItThrice: runItTwice && runItThrice, // Only enable if runItTwice is also enabled
        runOutOnFold,
        sevenDeuce,
        sevenDeuceBonus: sevenDeuce ? sevenDeuceBonus : undefined,
      },
    });
    onClose();
  };

  // Check if any settings have changed
  const hasChanges =
    smallBlind !== room.stakes.smallBlind ||
    bigBlind !== room.stakes.bigBlind ||
    ante !== (room.stakes.ante || 0) ||
    maxPlayers !== room.maxPlayers ||
    bombPotEnabled !== room.customRules.bombPotEnabled ||
    bombPotAmount !== (room.customRules.bombPotAmount || room.stakes.bigBlind * 10) ||
    straddleEnabled !== room.customRules.straddleEnabled ||
    runItTwice !== room.customRules.runItTwice ||
    runItThrice !== room.customRules.runItThrice ||
    runOutOnFold !== room.customRules.runOutOnFold ||
    sevenDeuce !== room.customRules.sevenDeuce ||
    sevenDeuceBonus !== (room.customRules.sevenDeuceBonus || room.stakes.bigBlind * 5);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={panelRef}
          initial={{ opacity: 0, y: -10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={{ duration: 0.15 }}
          className="fixed top-14 right-4 z-50 w-80"
        >
          <div className="bg-purple-950 border border-purple-700/50 rounded-xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-purple-700/30 bg-purple-900/50">
              <h2 className="text-base font-display font-bold text-white">Game Settings</h2>
              <p className="text-xs text-gray-400">Changes take effect next hand</p>
            </div>

            {/* Content */}
            <div className="px-4 py-3 space-y-4 max-h-[60vh] overflow-y-auto">
              {/* Blinds & Ante Section */}
              <div>
                <h3 className="text-xs font-medium text-gold mb-2">Blinds & Ante</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Small Blind</label>
                    <input
                      type="number"
                      value={smallBlindStr}
                      onChange={(e) => setSmallBlindStr(e.target.value)}
                      min={0}
                      className="input font-mono text-sm py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Big Blind</label>
                    <input
                      type="number"
                      value={bigBlindStr}
                      onChange={(e) => setBigBlindStr(e.target.value)}
                      min={0}
                      className="input font-mono text-sm py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Ante</label>
                    <input
                      type="number"
                      value={anteStr}
                      onChange={(e) => setAnteStr(e.target.value)}
                      min={0}
                      className="input font-mono text-sm py-1.5"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Set any to 0 to disable. Ante is collected from all players each hand.
                </p>
              </div>

              {/* Table Size Section */}
              <div>
                <h3 className="text-xs font-medium text-gold mb-2">Table Size</h3>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    Max Players: {maxPlayers}
                  </label>
                  <input
                    type="range"
                    min={2}
                    max={10}
                    value={maxPlayers}
                    onChange={(e) => setMaxPlayers(Number(e.target.value))}
                    className="w-full accent-gold"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>2</span>
                    <span>10</span>
                  </div>
                </div>
              </div>

              {/* Bomb Pots Section */}
              <div>
                <h3 className="text-xs font-medium text-gold mb-2">Bomb Pots</h3>
                <div className="space-y-2">
                  <ToggleRow
                    label="Enable Bomb Pots"
                    description="Allow players to trigger bomb pots"
                    checked={bombPotEnabled}
                    onChange={setBombPotEnabled}
                  />
                  {bombPotEnabled && (
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Bomb Pot Ante</label>
                      <input
                        type="number"
                        value={bombPotAmountStr}
                        onChange={(e) => setBombPotAmountStr(e.target.value)}
                        min={0}
                        className="input font-mono text-sm py-1.5"
                      />
                      <p className="text-xs text-gray-500 mt-0.5">
                        {bigBlind > 0 ? (bombPotAmount / bigBlind).toFixed(1) : 0}x big blind
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Run It Options Section */}
              <div>
                <h3 className="text-xs font-medium text-gold mb-2">Run It Options</h3>
                <div className="space-y-2">
                  <ToggleRow
                    label="Run It Twice"
                    description="Option to run board twice when all-in"
                    checked={runItTwice}
                    onChange={(v) => {
                      setRunItTwice(v);
                      if (!v) setRunItThrice(false);
                    }}
                  />
                  {runItTwice && (
                    <ToggleRow
                      label="Run It Thrice"
                      description="Option to run board three times"
                      checked={runItThrice}
                      onChange={setRunItThrice}
                    />
                  )}
                  <ToggleRow
                    label="Run Out on Fold"
                    description="Show remaining cards when all fold"
                    checked={runOutOnFold}
                    onChange={setRunOutOnFold}
                  />
                </div>
              </div>

              {/* 7-2 Game Section */}
              <div>
                <h3 className="text-xs font-medium text-gold mb-2">7-2 Game</h3>
                <div className="space-y-2">
                  <ToggleRow
                    label="Enable 7-2 Bonus"
                    description="Win with 7-2 at showdown for bonus"
                    checked={sevenDeuce}
                    onChange={setSevenDeuce}
                  />
                  {sevenDeuce && (
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Bonus per Player</label>
                      <input
                        type="number"
                        value={sevenDeuceBonusStr}
                        onChange={(e) => setSevenDeuceBonusStr(e.target.value)}
                        min={0}
                        className="input font-mono text-sm py-1.5"
                      />
                      <p className="text-xs text-gray-500 mt-0.5">
                        Each player pays {bigBlind > 0 ? (sevenDeuceBonus / bigBlind).toFixed(1) : 0}x BB to the winner
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Other Rules Section */}
              <div>
                <h3 className="text-xs font-medium text-gold mb-2">Other Rules</h3>
                <div className="space-y-2">
                  <ToggleRow
                    label="Straddles"
                    description="Allow unlimited straddle bets"
                    checked={straddleEnabled}
                    onChange={setStraddleEnabled}
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-purple-700/30 bg-purple-900/30 flex justify-end gap-2">
              <button
                onClick={onClose}
                className="px-3 py-1.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-purple-800/50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!hasChanges}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                  hasChanges
                    ? "bg-gold text-black hover:bg-gold-light"
                    : "bg-gray-700 text-gray-500 cursor-not-allowed"
                )}
              >
                Save
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Toggle row sub-component
function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between cursor-pointer group">
      <div>
        <div className="text-sm font-medium text-white group-hover:text-gold transition-colors">
          {label}
        </div>
        <div className="text-xs text-gray-500">{description}</div>
      </div>
      <div
        className={cn(
          "relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ml-3",
          checked ? "bg-gold" : "bg-gray-700"
        )}
        onClick={() => onChange(!checked)}
      >
        <div
          className={cn(
            "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-md transition-transform",
            checked ? "translate-x-5" : "translate-x-0.5"
          )}
        />
      </div>
    </label>
  );
}
