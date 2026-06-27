import React from 'react';

export const Header: React.FC<{ onInfoClick?: () => void }> = React.memo(() => {
  return (
    <div className="absolute top-0 left-0 right-0 z-10 pointer-events-none">
      <div className="flex md:hidden justify-center pt-4">
        <div className="flex flex-col items-center gap-0.5">
          <h1 className="text-2xl font-black tracking-tighter text-white">
            SATPLEX<span className="text-brand">.IO</span>
          </h1>
          <div className="flex items-center gap-1.5">
            <div className="h-0.5 w-5 bg-brand" />
            <p className="text-zinc-500 uppercase tracking-[0.25em] text-[9px] font-bold">
              Orbital Tracker
            </p>
            <div className="h-0.5 w-5 bg-brand" />
          </div>
        </div>
      </div>

      <div className="hidden md:block absolute top-8 left-8">
        <div className="flex flex-col gap-1">
          <h1 className="text-4xl font-black tracking-tighter text-white">
            SATPLEX<span className="text-brand">.IO</span>
          </h1>
          <div className="flex items-center gap-2">
            <div className="h-1 w-8 bg-brand" />
            <p className="text-zinc-500 uppercase tracking-[0.3em] text-[10px] font-bold">
              Real-Time Orbital Tracking
            </p>
          </div>
        </div>
      </div>
    </div>
  );
});
