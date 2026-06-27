import React from 'react';
import SatplexSpinner from './SatplexSpinner';

export const GlobalLoadingOverlay: React.FC = () => {
  return (
    <div className="absolute inset-0 z-[1000] flex flex-col items-center justify-center bg-black">
      <div className="flex flex-col items-center gap-8">
        <SatplexSpinner size={104} />
        <p className="text-[#0ea5e9] font-mono text-xs tracking-[0.3em] uppercase opacity-70">
          Synchronizing
        </p>
      </div>
    </div>
  );
};
