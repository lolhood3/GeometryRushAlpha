import React, { useState } from 'react';
import { motion, type HTMLMotionProps } from 'motion/react';
import { SoundUtility } from '../../engine/audio/SoundUtility.ts';

export interface MenuButtonProps extends HTMLMotionProps<'button'> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg' | 'hero';
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  subtitle?: string;
  isSelected?: boolean;
  pulseAccent?: boolean;
  soundType?: 'click' | 'confirm' | 'back' | 'error' | 'none';
  children?: React.ReactNode;
}

export function MenuButton({
  id,
  variant = 'secondary',
  size = 'md',
  icon,
  iconRight,
  subtitle,
  isSelected = false,
  pulseAccent = false,
  soundType = 'click',
  className = '',
  onClick,
  onMouseEnter,
  onFocus,
  children,
  disabled,
  ...props
}: MenuButtonProps) {
  const [isHovered, setIsHovered] = useState(false);

  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return 'bg-gradient-to-r from-[#00E5FF] via-[#00FFCC] to-[#00FF88] text-neutral-950 font-black shadow-[0_0_25px_rgba(0,229,255,0.3)] hover:shadow-[0_0_35px_rgba(0,229,255,0.5)] border-0';
      case 'success':
        return 'bg-gradient-to-r from-emerald-500 to-teal-400 text-neutral-950 font-bold shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] border border-emerald-400/40';
      case 'danger':
        return 'bg-neutral-950/70 border border-rose-900/60 text-rose-300 hover:bg-rose-950/40 hover:border-rose-600 hover:text-rose-100 hover:shadow-[0_0_20px_rgba(244,63,94,0.25)]';
      case 'ghost':
        return 'bg-transparent text-neutral-400 hover:text-white hover:bg-white/5 border border-transparent hover:border-neutral-800';
      case 'secondary':
      default:
        return 'bg-neutral-900/80 border border-neutral-800/90 text-neutral-200 hover:border-neutral-700 hover:bg-neutral-800/90 hover:text-white hover:shadow-[0_0_20px_rgba(255,255,255,0.06)]';
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return 'px-3 py-1.5 text-xs rounded-xl gap-2';
      case 'lg':
        return 'px-5 py-3 text-sm rounded-2xl gap-3.5';
      case 'hero':
        return 'p-4 sm:p-4.5 text-base rounded-2xl gap-4';
      case 'md':
      default:
        return 'px-4 py-2.5 text-xs sm:text-sm rounded-2xl gap-3';
    }
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    setIsHovered(true);
    if (!disabled && soundType !== 'none') {
      SoundUtility.hover();
    }
    onMouseEnter?.(e);
  };

  const handleFocus = (e: React.FocusEvent<HTMLButtonElement>) => {
    if (!disabled && soundType !== 'none') {
      SoundUtility.hover();
    }
    onFocus?.(e);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) {
      SoundUtility.error();
      return;
    }

    if (soundType === 'confirm') {
      SoundUtility.confirm();
    } else if (soundType === 'back') {
      SoundUtility.back();
    } else if (soundType === 'error') {
      SoundUtility.error();
    } else if (soundType !== 'none') {
      SoundUtility.click();
    }

    onClick?.(e);
  };

  return (
    <motion.button
      id={id}
      type="button"
      disabled={disabled}
      whileHover={disabled ? undefined : { scale: 1.012, y: -1 }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      onMouseEnter={handleMouseEnter}
      onFocus={handleFocus}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      className={`group relative flex items-center justify-between overflow-hidden backdrop-blur-md transition-colors cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00E5FF] ${getVariantStyles()} ${getSizeStyles()} ${
        isSelected
          ? 'border-[#00E5FF] ring-2 ring-[#00E5FF]/60 shadow-[0_0_25px_rgba(0,229,255,0.25)]'
          : ''
      } ${disabled ? 'opacity-50 cursor-not-allowed hover:scale-100 shadow-none' : ''} ${className}`}
      {...props}
    >
      {/* Selected / Pulsing Accent Line */}
      {(isSelected || pulseAccent) && (
        <span className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#00E5FF] to-[#00FF88] shadow-[0_0_10px_#00E5FF] animate-pulse" />
      )}

      {/* Glow highlight sweep on hover */}
      {isHovered && !disabled && (
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
      )}

      {/* Left Icon & Text Content */}
      <div className="flex items-center gap-3">
        {icon && (
          <motion.div
            animate={isHovered && !disabled ? { rotate: [0, -6, 6, 0] } : { rotate: 0 }}
            transition={{ duration: 0.3 }}
            className="shrink-0"
          >
            {icon}
          </motion.div>
        )}

        <div className="flex flex-col text-left">
          {children && (
            <span className="tracking-wide uppercase whitespace-nowrap leading-tight">
              {children}
            </span>
          )}
          {subtitle && (
            <span
              className={`text-[11px] font-mono leading-tight ${
                variant === 'primary' ? 'text-neutral-900/80 font-medium' : 'text-neutral-400'
              }`}
            >
              {subtitle}
            </span>
          )}
        </div>
      </div>

      {/* Right Icon / Extra */}
      {iconRight && (
        <motion.div
          animate={isHovered && !disabled ? { x: 3 } : { x: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          className="shrink-0 ml-2"
        >
          {iconRight}
        </motion.div>
      )}
    </motion.button>
  );
}
