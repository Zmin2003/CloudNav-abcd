import React, { useEffect, useState } from 'react';

interface LiquidBackgroundProps {
  enabled?: boolean;
}

const COMPACT_BACKGROUND_QUERY = '(max-width: 820px), (hover: none), (pointer: coarse), (prefers-reduced-motion: reduce)';

function getCompactMode(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }

  return window.matchMedia(COMPACT_BACKGROUND_QUERY).matches;
}

const LiquidBackground: React.FC<LiquidBackgroundProps> = ({ enabled = true }) => {
  const [isCompact, setIsCompact] = useState(getCompactMode);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const mediaQuery = window.matchMedia(COMPACT_BACKGROUND_QUERY);
    const syncCompactMode = () => setIsCompact(mediaQuery.matches);

    syncCompactMode();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', syncCompactMode);
      return () => mediaQuery.removeEventListener('change', syncCompactMode);
    }

    mediaQuery.addListener(syncCompactMode);
    return () => mediaQuery.removeListener(syncCompactMode);
  }, []);

  if (!enabled) return null;

  return (
    <div className={`liquid-flow-scene${isCompact ? ' liquid-flow-scene-compact' : ''}`} aria-hidden="true">
      {!isCompact && <div className="liquid-flow-grid" />}
      <div className="liquid-flow-blob liquid-flow-blob-a" />
      <div className="liquid-flow-blob liquid-flow-blob-b" />
      <div className="liquid-flow-blob liquid-flow-blob-c" />
      {!isCompact && <div className="liquid-flow-blob liquid-flow-blob-d" />}
      {!isCompact && <div className="liquid-flow-ribbon liquid-flow-ribbon-a" />}
      {!isCompact && <div className="liquid-flow-ribbon liquid-flow-ribbon-b" />}
      <div className="liquid-flow-glow liquid-flow-glow-top" />
      {!isCompact && <div className="liquid-flow-glow liquid-flow-glow-bottom" />}
      {!isCompact && <div className="liquid-flow-noise" />}
    </div>
  );
};

export default React.memo(LiquidBackground);
