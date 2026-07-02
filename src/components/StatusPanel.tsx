import React from 'react';

interface StatusPanelProps {
  loading: boolean;
  error: string | null;
  metrics: { total: number; withTelemetry: number };
  showStarlink: boolean;
  setShowStarlink: (show: boolean) => void;
  currentTime: Date;
  onInfoClick: () => void;
}

export const StatusPanel: React.FC<StatusPanelProps> = React.memo(({
  loading,
  error,
  metrics,
  showStarlink,
  setShowStarlink,
  onInfoClick
}) => {
  if (loading) {
    return (
      <>
        <div className="md:hidden absolute bottom-24 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <div className="bg-zinc-900/80 backdrop-blur-md border border-white/10 rounded-full px-4 py-2 flex items-center gap-2 shadow-lg">
            <div className="h-3 w-3 animate-spin rounded-full border-2 border-brand border-t-transparent" />
            <p className="text-zinc-400 text-xs font-medium">Synchronizing…</p>
          </div>
        </div>
        <div className="hidden md:block absolute bottom-8 left-8 z-10 w-80">
          <div className="bg-zinc-900/40 backdrop-blur-md border border-white/5 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center gap-3 py-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand border-t-transparent" />
              <p className="text-zinc-400 text-sm font-medium">Synchronizing Catalog...</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <div className="md:hidden absolute bottom-24 left-4 right-4 z-10">
          <div className="bg-zinc-900/90 backdrop-blur-md border border-rose-500/20 rounded-2xl p-4 shadow-xl space-y-2">
            <p className="text-rose-400 text-sm">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 rounded-lg text-xs font-semibold transition-all border border-rose-500/20"
            >
              Retry
            </button>
          </div>
        </div>
        <div className="hidden md:block absolute bottom-8 left-8 z-10 w-80">
          <div className="bg-zinc-900/40 backdrop-blur-md border border-white/5 rounded-2xl p-6 shadow-2xl space-y-3">
            <p className="text-rose-400 text-sm">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 rounded-lg text-xs font-semibold transition-all border border-rose-500/20"
            >
              Retry
            </button>
          </div>
        </div>
      </>
    );
  }

  const objectCount = metrics.total;

  return (
    <>
      <div className="hidden md:block absolute bottom-8 left-8 z-10 w-80">
        <div className="bg-zinc-900/40 backdrop-blur-md border border-white/5 rounded-2xl p-6 shadow-2xl">
          <div className="space-y-6">
            <div className="space-y-1">
              <span className="text-zinc-500 text-[10px] uppercase tracking-widest font-bold">
                Total Objects
              </span>
              <p className="text-2xl font-light text-zinc-100 tabular-nums">
                {objectCount.toLocaleString()}
              </p>
            </div>

            <div className="h-[1px] w-full bg-zinc-800/50" />

            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-0.5">
                <span className="text-zinc-500 text-[10px] uppercase tracking-widest font-bold">Starlink Visibility</span>
                <span className="text-zinc-600 text-[9px] font-medium leading-none">Global Mega-Constellation</span>
              </div>
              <button
                onClick={() => setShowStarlink(!showStarlink)}
                className={`group relative inline-flex h-5 w-10 items-center rounded-full transition-all duration-300 ease-in-out outline-none focus:ring-1 focus:ring-brand/50 ${showStarlink ? 'bg-brand/20 border border-brand/30' : 'bg-zinc-800 border border-white/5'
                  }`}
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full transition-all duration-300 ease-in-out ${showStarlink ? 'translate-x-6 bg-brand shadow-[0_0_8px_rgba(14,165,233,0.5)]' : 'translate-x-1 bg-zinc-500'
                    }`}
                />
              </button>
            </div>

            <div className="h-[1px] w-full bg-zinc-800/50" />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-zinc-400 text-[10px] font-medium uppercase tracking-tight">System Live</span>
              </div>
              <button
                onClick={onInfoClick}
                className="text-zinc-400 hover:text-white text-[10px] font-medium uppercase tracking-tight transition-colors"
              >
                About Project
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
});
