import React, { useState, useMemo, useCallback } from 'react';
import { Virtuoso } from 'react-virtuoso';
import type { MergedSatellite } from '../services/satelliteData';
import { BottomSheet } from './BottomSheet';
import { useIsMobile } from '../hooks/useIsMobile';

interface SearchHeaderProps {
  search: string;
  onSearch: (value: string) => void;
  resultCount: number;
}

const SearchHeader: React.FC<SearchHeaderProps> = ({ search, onSearch, resultCount }) => (
  <div className="p-4 border-b border-white/5">
    <div className="relative group">
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-brand transition-colors"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
      <input
        type="text"
        placeholder="Search name or ID..."
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        className="w-full bg-black/40 border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-base text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-brand/50 focus:border-brand/50 transition-all font-light"
      />
    </div>
    <div className="mt-2 flex items-center justify-between px-1">
      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
        {resultCount.toLocaleString()} Results
      </span>
      {search && (
        <button
          onClick={() => onSearch('')}
          className="text-[10px] font-bold text-brand hover:text-brand/80 uppercase tracking-widest transition-colors"
        >
          Clear
        </button>
      )}
    </div>
  </div>
);

interface SatRowProps {
  sat: MergedSatellite;
  selectedNoradId?: number;
  onSelect: (sat: MergedSatellite) => void;
}

const SatRow: React.FC<SatRowProps> = ({ sat, selectedNoradId, onSelect }) => (
  <div
    onClick={() => onSelect(sat)}
    className={`group flex items-center gap-4 p-4 cursor-pointer border-b border-white/[0.03] transition-all hover:bg-white/[0.05] ${selectedNoradId === sat.noradId
        ? 'bg-brand/10 border-l-2 border-l-brand'
        : 'border-l-2 border-l-transparent'
      }`}
  >
    <div className="min-w-0 flex-1">
      <div className="flex items-center justify-between mb-0.5">
        <h4
          className={`text-sm font-semibold truncate transition-colors ${selectedNoradId === sat.noradId
              ? 'text-brand'
              : 'text-zinc-200 group-hover:text-white'
            }`}
        >
          {sat.name}
        </h4>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-mono text-zinc-500">#{sat.noradId}</span>
        {sat.countries && (
          <span className="text-[9px] text-zinc-600 truncate underline decoration-zinc-800 underline-offset-2">
            {sat.countries.split(',')[0]}
          </span>
        )}
      </div>
    </div>
    <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
      <svg className="w-4 h-4 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
      </svg>
    </div>
  </div>
);

interface SatelliteListProps {
  satellites: MergedSatellite[];
  onSelect: (sat: MergedSatellite) => void;
  selectedNoradId?: number;
  isOpen?: boolean;
  onClose?: () => void;
}

export const SatelliteList: React.FC<SatelliteListProps> = ({
  satellites,
  onSelect,
  selectedNoradId,
  isOpen = false,
  onClose = () => {},
}) => {
  const [search, setSearch] = useState('');
  const isMobile = useIsMobile();

  const filteredSatellites = useMemo(() => {
    if (!search) return satellites;
    const lowerSearch = search.toLowerCase();
    return satellites.filter(
      (sat) =>
        sat.name.toLowerCase().includes(lowerSearch) ||
        sat.noradId.toString().includes(lowerSearch),
    );
  }, [satellites, search]);

  const handleSelect = useCallback((sat: MergedSatellite) => {
    onSelect(sat);
    if (isMobile) onClose();
  }, [onSelect, onClose, isMobile]);

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      snapPoints={['78vh']}
      header={
        <div className="flex justify-between items-center px-4 pt-2">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Catalog</h2>
          <button
            onClick={onClose}
            className="p-4 -m-4 text-zinc-500 hover:text-white transition-colors"
            aria-label="Close catalog"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="1" y1="1" x2="13" y2="13"/><line x1="13" y1="1" x2="1" y2="13"/>
            </svg>
          </button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <SearchHeader
          search={search}
          onSearch={setSearch}
          resultCount={filteredSatellites.length}
        />
        <div style={{ flex: 1, minHeight: 0 }}>
          <Virtuoso
            data={filteredSatellites}
            totalCount={filteredSatellites.length}
            itemContent={(_, sat) => (
              <SatRow
                key={sat.noradId}
                sat={sat}
                selectedNoradId={selectedNoradId}
                onSelect={handleSelect}
              />
            )}
            style={{
              height: '100%',
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(255,255,255,0.1) transparent',
            }}
          />
        </div>
      </div>
    </BottomSheet>
  );
};
