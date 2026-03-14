import React from 'react';

interface LiquidBackgroundProps {
  enabled?: boolean;
}

const LiquidBackground: React.FC<LiquidBackgroundProps> = ({ enabled = true }) => {
  if (!enabled) return null;

  return (
    <div className="liquid-flow-scene" aria-hidden="true">
      <div className="liquid-flow-grid" />
      <div className="liquid-flow-blob liquid-flow-blob-a" />
      <div className="liquid-flow-blob liquid-flow-blob-b" />
      <div className="liquid-flow-blob liquid-flow-blob-c" />
      <div className="liquid-flow-blob liquid-flow-blob-d" />
      <div className="liquid-flow-ribbon liquid-flow-ribbon-a" />
      <div className="liquid-flow-ribbon liquid-flow-ribbon-b" />
      <div className="liquid-flow-glow liquid-flow-glow-top" />
      <div className="liquid-flow-glow liquid-flow-glow-bottom" />
      <div className="liquid-flow-noise" />
    </div>
  );
};

export default React.memo(LiquidBackground);
