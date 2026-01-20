'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ActionType } from '@poker/shared';
import { cn, formatChips } from '@/lib/utils';
import { useSoundContext } from '@/hooks/useSound';

// =============================================================================
// TYPES
// =============================================================================

interface ActionButtonsProps {
  validActions: ActionType[];
  currentBet: number;
  playerBet: number;
  playerChips: number;
  pot: number;
  minRaise: number;
  bigBlind: number;
  onAction: (action: ActionType, amount?: number) => void;
  disabled?: boolean;
  className?: string;
}

type PreTurnAction = 'check-fold' | 'fold' | 'call' | 'call-any' | null;

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function ActionButtons({
  validActions,
  currentBet,
  playerBet,
  playerChips,
  pot,
  minRaise,
  bigBlind,
  onAction,
  disabled = false,
  className,
}: ActionButtonsProps) {
  const { playAction } = useSoundContext();

  const toCall = currentBet - playerBet;
  const canRaise = playerChips > toCall;
  const effectivePot = pot + toCall; // Pot after calling

  // Calculate min/max for "raise TO" amounts (total bet, not increment)
  // minRaise from server is the increment, so min total = currentBet + minRaise
  const minRaiseTotal = currentBet + minRaise;
  const maxRaiseTotal = playerBet + playerChips; // Max we can bet to

  const [raiseToAmount, setRaiseToAmount] = useState(minRaiseTotal);
  const [inputValue, setInputValue] = useState(String(minRaiseTotal));
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  // Calculate raise presets based on pot (these are TOTAL amounts)
  const raisePresets = useRaisePresets(effectivePot, minRaiseTotal, maxRaiseTotal);

  // Update raise amount when minRaise changes
  useEffect(() => {
    if (raiseToAmount < minRaiseTotal) {
      setRaiseToAmount(minRaiseTotal);
      setInputValue(String(minRaiseTotal));
    }
  }, [minRaiseTotal, raiseToAmount]);

  const handleAction = useCallback((action: ActionType, amount?: number) => {
    playAction(action as any);
    onAction(action, amount);
  }, [onAction, playAction]);

  // Convert "raise TO" amount to "raise BY" increment for server
  const getRaiseIncrement = useCallback((totalAmount: number) => {
    return totalAmount - currentBet;
  }, [currentBet]);

  const handleRaisePreset = useCallback((totalAmount: number, label: string) => {
    setRaiseToAmount(totalAmount);
    setInputValue(String(totalAmount));
    setSelectedPreset(label);
  }, []);

  const handleRaiseSubmit = useCallback(() => {
    const increment = getRaiseIncrement(raiseToAmount);
    if (validActions.includes('raise')) {
      handleAction('raise', increment);
    } else if (validActions.includes('bet')) {
      handleAction('bet', raiseToAmount);
    }
  }, [validActions, raiseToAmount, handleAction, getRaiseIncrement]);

  const handleInputChange = useCallback((value: string) => {
    setInputValue(value);
    setSelectedPreset(null);
    const num = Number(value);
    if (!isNaN(num) && num >= minRaiseTotal && num <= maxRaiseTotal) {
      setRaiseToAmount(num);
    }
  }, [minRaiseTotal, maxRaiseTotal]);

  const handleInputBlur = useCallback(() => {
    const num = Number(inputValue);
    if (isNaN(num) || num < minRaiseTotal) {
      setRaiseToAmount(minRaiseTotal);
      setInputValue(String(minRaiseTotal));
    } else if (num > maxRaiseTotal) {
      setRaiseToAmount(maxRaiseTotal);
      setInputValue(String(maxRaiseTotal));
    } else {
      setRaiseToAmount(num);
      setInputValue(String(num));
    }
  }, [inputValue, minRaiseTotal, maxRaiseTotal]);

  const handleSliderChange = useCallback((value: number) => {
    setRaiseToAmount(value);
    setInputValue(String(value));
    setSelectedPreset(null);
  }, []);

  const canBetOrRaise = validActions.includes('bet') || validActions.includes('raise');

  return (
    <div className={cn('action-bar', className)}>
      <div className={cn(
        'action-bar-content',
        !canBetOrRaise && 'action-bar-content-centered'
      )}>
        {/* LEFT SECTION - Fold button */}
        {validActions.includes('fold') && (
          <ActionButton
            action="fold"
            label="Fold"
            onClick={() => handleAction('fold')}
            disabled={disabled}
            variant="fold"
          />
        )}

        {/* CENTER SECTION - Call/Check */}
        {validActions.includes('check') && (
          <ActionButton
            action="check"
            label="Check"
            onClick={() => handleAction('check')}
            disabled={disabled}
            variant="check"
          />
        )}
        {validActions.includes('call') && (
          <ActionButton
            action="call"
            label={`Call ${formatChips(Math.min(toCall, playerChips))}`}
            onClick={() => handleAction('call')}
            disabled={disabled}
            variant="call"
          />
        )}

        {/* RIGHT SECTION - Raise controls */}
        {canBetOrRaise && (
          <div className="raise-section">
            {/* Preset pills */}
            <div className="preset-pills">
              {raisePresets.slice(0, 4).map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => handleRaisePreset(preset.value, preset.label)}
                  disabled={disabled}
                  className={cn(
                    'preset-pill',
                    selectedPreset === preset.label && 'selected'
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Slider */}
            <input
              type="range"
              min={minRaiseTotal}
              max={maxRaiseTotal}
              value={raiseToAmount}
              onChange={(e) => handleSliderChange(Number(e.target.value))}
              className="raise-slider"
              disabled={disabled}
            />

            {/* Amount input */}
            <div className="amount-input-wrapper">
              <span className="currency-symbol">$</span>
              <input
                type="number"
                value={inputValue}
                onChange={(e) => handleInputChange(e.target.value)}
                onBlur={handleInputBlur}
                min={minRaiseTotal}
                max={maxRaiseTotal}
                disabled={disabled}
                className="amount-input"
              />
            </div>

            {/* Raise button */}
            <ActionButton
              action={validActions.includes('raise') ? 'raise' : 'bet'}
              label={validActions.includes('raise') ? `Raise to ${formatChips(raiseToAmount)}` : `Bet ${formatChips(raiseToAmount)}`}
              onClick={handleRaiseSubmit}
              disabled={disabled}
              variant="raise"
            />

            {/* All-In button */}
            {validActions.includes('all-in') && (
              <ActionButton
                action="all-in"
                label="All In"
                onClick={() => handleAction('all-in')}
                disabled={disabled}
                variant="allin"
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// PRE-TURN ACTIONS (shown when it's not your turn)
// =============================================================================

interface PreTurnActionsProps {
  selectedAction: PreTurnAction;
  onSelectAction: (action: PreTurnAction) => void;
  canCheck: boolean;
  toCall: number;
  className?: string;
}

export function PreTurnActions({
  selectedAction,
  onSelectAction,
  canCheck,
  toCall,
  className,
}: PreTurnActionsProps) {
  const options: { id: PreTurnAction; label: string; show: boolean }[] = [
    { id: 'check-fold', label: 'Check/Fold', show: canCheck },
    { id: 'fold', label: 'Fold', show: true },
    { id: 'call', label: `Call ${formatChips(toCall)}`, show: toCall > 0 },
    { id: 'call-any', label: 'Call Any', show: toCall > 0 },
  ];

  return (
    <div className={cn('pre-turn-bar', className)}>
      <span className="pre-turn-label">Pre-select action:</span>
      <div className="pre-turn-options">
        {options.filter(o => o.show).map((option) => (
          <label
            key={option.id}
            className={cn(
              'pre-turn-option',
              selectedAction === option.id && 'selected'
            )}
          >
            <input
              type="checkbox"
              checked={selectedAction === option.id}
              onChange={() => onSelectAction(selectedAction === option.id ? null : option.id)}
              className="pre-turn-checkbox"
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

interface ActionButtonProps {
  action: ActionType;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'fold' | 'check' | 'call' | 'raise' | 'allin';
}

function ActionButton({
  action,
  label,
  onClick,
  disabled,
  variant = 'call',
}: ActionButtonProps) {
  const [isRippling, setIsRippling] = useState(false);
  const [ripplePosition, setRipplePosition] = useState({ x: 0, y: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;

    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      setRipplePosition({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }

    setIsRippling(true);
    setTimeout(() => setIsRippling(false), 600);

    onClick();
  };

  const variantClasses = {
    fold: 'action-button-fold',
    check: 'action-button-check',
    call: 'action-button-call',
    raise: 'action-button-raise',
    allin: 'action-button-allin',
  };

  return (
    <motion.button
      ref={buttonRef}
      whileHover={!disabled ? { scale: 1.02, y: -1 } : {}}
      whileTap={!disabled ? { scale: 0.98 } : {}}
      onClick={handleClick}
      disabled={disabled}
      className={cn(
        'action-button',
        variantClasses[variant],
        disabled && 'disabled'
      )}
    >
      {/* Ripple effect */}
      <AnimatePresence>
        {isRippling && (
          <motion.span
            initial={{ scale: 0, opacity: 0.5 }}
            animate={{ scale: 4, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="action-button-ripple"
            style={{
              left: ripplePosition.x,
              top: ripplePosition.y,
            }}
          />
        )}
      </AnimatePresence>

      <span className="action-button-label">{label}</span>
    </motion.button>
  );
}

// =============================================================================
// HELPERS
// =============================================================================

function useRaisePresets(
  pot: number,
  minRaiseTotal: number,
  maxRaiseTotal: number
): { label: string; value: number }[] {
  // Presets are TOTAL bet amounts (raise TO X)
  const presets = [
    { label: '½ Pot', value: Math.max(minRaiseTotal, Math.floor(pot * 0.5)) },
    { label: '¾ Pot', value: Math.max(minRaiseTotal, Math.floor(pot * 0.75)) },
    { label: 'Pot', value: Math.max(minRaiseTotal, pot) },
    { label: '2x Pot', value: Math.max(minRaiseTotal, pot * 2) },
  ];

  // Filter out presets that exceed max or are below min
  return presets
    .filter(p => p.value <= maxRaiseTotal && p.value >= minRaiseTotal)
    .reduce((acc, preset) => {
      // Remove duplicates
      if (!acc.find(p => p.value === preset.value)) {
        acc.push(preset);
      }
      return acc;
    }, [] as typeof presets)
    .slice(0, 4); // Max 4 presets
}
