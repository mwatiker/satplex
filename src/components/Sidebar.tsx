import React, { useRef, useEffect, useState } from 'react';
import { Virtuoso } from 'react-virtuoso';
import type { MergedSatellite } from '../services/satelliteData';
import type { SatelliteFilters } from '../hooks/useSatelliteFilters';

interface SidebarProps {
    satellites: MergedSatellite[];
    filters: SatelliteFilters;
    onSelect: (sat: MergedSatellite) => void;
    selectedNoradId?: number;
    loading: boolean;
    error: string | null;
    onInfoClick: () => void;
    width?: number;
    isNarrow?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
    filters,
    onSelect,
    selectedNoradId,
    loading,
    error,
    onInfoClick,
    width = 360,
    isNarrow = false,
}) => {
    const {
        search, setSearch,
        activeTypes, setActiveTypes,
        activeOrbits, setActiveOrbits,
        minYear, setMinYear,
        maxYear, setMaxYear,
        showStarlink, setShowStarlink,
        selectedCountries, setSelectedCountries,
        countrySearch, setCountrySearch,
        filteredCountryOptions,
        toggleCountry,
        countryLabel,
        toggleSet,
        resetFilters,
        activeFilterCount,
        filteredSatellites,
    } = filters;

    const [isFiltersOpen, setIsFiltersOpen] = React.useState(false);
    const [isCountryOpen, setIsCountryOpen] = React.useState(false);
    const [isCollapsed, setIsCollapsed] = React.useState(false);
    const countryDropdownRef = useRef<HTMLDivElement>(null);

    // Local UI state to keep the slider drag completely fluid
    const [localMinYear, setLocalMinYear] = useState(minYear);
    const [localMaxYear, setLocalMaxYear] = useState(maxYear);

    // Sync local state if parent state changes externally (e.g., Reset Filters button)
    useEffect(() => {
        setLocalMinYear(minYear);
    }, [minYear]);

    useEffect(() => {
        setLocalMaxYear(maxYear);
    }, [maxYear]);

    // Close country dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (countryDropdownRef.current && !countryDropdownRef.current.contains(e.target as Node)) {
                setIsCountryOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const getPillClass = (isActive: boolean, type?: string) => {
        const base = "text-[9px] px-2.5 py-1 rounded-sm border transition-all cursor-pointer select-none whitespace-nowrap font-mono uppercase tracking-wider";

        if (!isActive) {
            return `${base} border-white/10 text-zinc-600 hover:border-white/20 hover:text-zinc-400`;
        }

        switch (type) {
            case 'PAYLOAD':
                return `${base} border-[#0EA5E9]/40 text-[#0EA5E9]`;
            case 'ROCKET BODY':
                return `${base} border-[#F97316]/40 text-[#F97316]`;
            case 'DEBRIS':
                return `${base} border-[#94A3B8]/40 text-[#94A3B8]`;
            case 'UNKNOWN':
                return `${base} border-[#A8A29E]/40 text-[#A8A29E]`;
            default:
                return `${base} border-brand/40 text-brand`;
        }
    };


    return (
        <div
            className={`absolute top-0 left-0 h-full z-30 transition-transform duration-300 ease-in-out pointer-events-none ${isCollapsed ? '-translate-x-full' : 'translate-x-0'}`}
            style={{ width }}
        >
            <div className="w-full h-full flex flex-col bg-zinc-900/96 border-r border-white/10 shadow-2xl overflow-hidden overflow-x-hidden pointer-events-auto">

                <div className="px-5 pt-6 pb-4 flex-shrink-0">
                    <h1 className="text-[18px] font-bold tracking-[1px] text-white leading-none">
                        SATPLEX<span className="text-brand">.IO</span>
                    </h1>
                    <p className="text-white/35 uppercase tracking-[2.5px] text-[9px] mt-1">
                        {isNarrow ? 'Orbital Tracking' : 'Real-Time Orbital Tracking'}
                    </p>
                </div>

                <div className="px-4 pb-2 flex-shrink-0">
                    <div className="bg-white/5 border border-white/10 rounded-md flex items-center gap-2 px-3 py-2">
                        <svg className="w-3.5 h-3.5 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Search name or ID..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-transparent border-none outline-none text-xs text-white/70 placeholder:text-white/30"
                        />
                    </div>
                </div>

                <div className="px-5 pb-2 flex-shrink-0">
                    <span className={`${isNarrow ? 'text-[17px]' : 'text-[20px]'} font-light tracking-[-0.5px] text-white/80 tabular-nums leading-tight block mb-2`}>
                        Tracking {filteredSatellites.length.toLocaleString()} objects
                    </span>

                    <div
                        className="flex items-center justify-between cursor-pointer select-none group"
                        onClick={() => setIsFiltersOpen(!isFiltersOpen)}
                    >
                        <div className="flex items-center gap-1.5 text-[9px] tracking-[1.5px] text-white/40 uppercase">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                            </svg>
                            Filters
                            {activeFilterCount > 0 && (
                                <span className="bg-brand text-white text-[9px] font-semibold rounded-full px-1.5 py-0 leading-tight tracking-normal ml-1">
                                    {activeFilterCount}
                                </span>
                            )}
                        </div>
                        <svg
                            className={`w-3 h-3 text-white/30 transition-transform duration-200 ${isFiltersOpen ? 'rotate-180' : ''}`}
                            fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                </div>

                <div className={`px-5 flex-shrink-0 flex flex-col gap-5 overflow-hidden transition-all duration-300 ${isFiltersOpen ? 'max-h-[600px] opacity-100 pb-3 pt-2' : 'max-h-0 opacity-0 pb-0 pt-0'}`}>

                    <div className="flex flex-col gap-2">
                        <span className="text-[9px] tracking-[1.5px] text-white/30 uppercase">Object type</span>
                        <div className="flex flex-wrap gap-1.5">
                            {['PAYLOAD', 'DEBRIS', 'ROCKET BODY', 'UNKNOWN'].map(type => (
                                <div
                                    key={type}
                                    onClick={() => toggleSet(activeTypes, type, setActiveTypes)}
                                    className={getPillClass(activeTypes.has(type), type)}
                                >
                                    {type.charAt(0) + type.slice(1).toLowerCase()}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <span className="text-[9px] tracking-[1.5px] text-white/30 uppercase">Orbit regime</span>
                        <div className="flex flex-wrap gap-1.5">
                            {['LEO', 'MEO', 'GEO', 'HEO'].map(orbit => (
                                <div
                                    key={orbit}
                                    onClick={() => toggleSet(activeOrbits, orbit, setActiveOrbits)}
                                    className={getPillClass(activeOrbits.has(orbit))}
                                >
                                    {orbit}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <span className="text-[9px] tracking-[1.5px] text-white/30 uppercase">
                            Launch year: {localMinYear}–{localMaxYear}
                        </span>
                        <div className="relative w-full h-0.5 mt-2 mb-1 flex items-center">
                            <div className="absolute inset-0 bg-white/10 rounded-full" />
                            <div
                                className="absolute h-full bg-brand rounded-full pointer-events-none"
                                style={{
                                    left: `${((localMinYear - 1957) / (2026 - 1957)) * 100}%`,
                                    right: `${100 - ((localMaxYear - 1957) / (2026 - 1957)) * 100}%`
                                }}
                            />
                            <input
                                type="range" min="1957" max="2026" step="1"
                                value={localMinYear}
                                onChange={(e) => {
                                    const val = parseInt(e.target.value);
                                    if (val <= localMaxYear) setLocalMinYear(val);
                                }}
                                onPointerUp={() => setMinYear(localMinYear)}
                                onTouchEnd={() => setMinYear(localMinYear)}
                                className="absolute inset-0 w-full h-full appearance-none bg-transparent pointer-events-none z-[1] hover:z-[2] active:z-[2] focus:z-[2] [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-brand [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:w-2.5 [&::-moz-range-thumb]:h-2.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-brand [&::-moz-range-thumb]:border-none"
                            />
                            <input
                                type="range" min="1957" max="2026" step="1"
                                value={localMaxYear}
                                onChange={(e) => {
                                    const val = parseInt(e.target.value);
                                    if (val >= localMinYear) setLocalMaxYear(val);
                                }}
                                onPointerUp={() => setMaxYear(localMaxYear)}
                                onTouchEnd={() => setMaxYear(localMaxYear)}
                                className="absolute inset-0 w-full h-full appearance-none bg-transparent pointer-events-none z-[1] hover:z-[2] active:z-[2] focus:z-[2] [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-brand [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:w-2.5 [&::-moz-range-thumb]:h-2.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-brand [&::-moz-range-thumb]:border-none"
                            />
                        </div>
                        <div className="flex justify-between items-center w-full mt-1">
                            <span className="text-[9px] text-white/30">1957</span>
                            <span className="text-[9px] text-white/30">2026</span>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2" ref={countryDropdownRef}>
                        <span className="text-[9px] tracking-[1.5px] text-white/30 uppercase">Origin</span>

                        <button
                            onClick={() => setIsCountryOpen(prev => !prev)}
                            className={`w-full flex items-center justify-between px-3 py-1.5 rounded-md border text-[11px] transition-all cursor-pointer select-none
                                ${selectedCountries.size > 0
                                    ? 'bg-brand/10 border-brand/40 text-brand'
                                    : 'bg-white/5 border-white/10 text-white/45 hover:border-white/25 hover:text-white/65'
                                }`}
                        >
                            <span className="truncate">{countryLabel}</span>
                            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                {selectedCountries.size > 0 && (
                                    <span
                                        onClick={(e) => { e.stopPropagation(); setSelectedCountries(new Set()); setCountrySearch(''); }}
                                        className="text-white/30 hover:text-white/70 transition-colors leading-none"
                                        title="Clear"
                                    >
                                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                                            <line x1="1" y1="1" x2="9" y2="9"/><line x1="9" y1="1" x2="1" y2="9"/>
                                        </svg>
                                    </span>
                                )}
                                <svg
                                    className={`w-3 h-3 transition-transform duration-200 ${isCountryOpen ? 'rotate-180' : ''}`}
                                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </button>

                        {isCountryOpen && (
                            <div className="flex flex-col bg-zinc-900 border border-white/10 rounded-md overflow-hidden shadow-xl">
                                <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
                                    <svg className="w-3 h-3 text-white/25 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                    <input
                                        type="text"
                                        placeholder="Search origins..."
                                        value={countrySearch}
                                        onChange={(e) => setCountrySearch(e.target.value)}
                                        className="w-full bg-transparent border-none outline-none text-[11px] text-white/60 placeholder:text-white/25"
                                        autoFocus
                                    />
                                    {countrySearch && (
                                        <button onClick={() => setCountrySearch('')} className="text-white/25 hover:text-white/60 transition-colors flex-shrink-0">
                                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                                                <line x1="1" y1="1" x2="9" y2="9"/><line x1="9" y1="1" x2="1" y2="9"/>
                                            </svg>
                                        </button>
                                    )}
                                </div>

                                <div className="overflow-y-auto max-h-[180px]" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}>
                                    {filteredCountryOptions.length === 0 ? (
                                        <div className="px-3 py-3 text-[11px] text-white/25 text-center">No matches</div>
                                    ) : (
                                        filteredCountryOptions.map(({ code, label, count }) => {
                                            const isSelected = selectedCountries.has(code);
                                            return (
                                                <div
                                                    key={code}
                                                    onClick={() => toggleCountry(code)}
                                                    className={`flex items-center justify-between px-3 py-2 cursor-pointer transition-colors text-[11px]
                                                        ${isSelected
                                                            ? 'bg-brand/10 text-brand'
                                                            : 'text-white/50 hover:bg-white/[0.04] hover:text-white/80'
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                        <span className="text-[10px] font-mono text-white/25 w-6 flex-shrink-0">{code}</span>
                                                        <span className="truncate">{label}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                                        <span className="text-[10px] text-white/20 tabular-nums">{count}</span>
                                                        {isSelected && (
                                                            <svg className="w-3 h-3 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                                                            </svg>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>

                                {selectedCountries.size > 0 && (
                                    <div className="border-t border-white/5 px-3 py-1.5 flex items-center justify-between">
                                        <span className="text-[10px] text-white/30">{selectedCountries.size} selected</span>
                                        <button
                                            onClick={() => { setSelectedCountries(new Set()); setCountrySearch(''); }}
                                            className="text-[10px] text-rose-500/50 hover:text-rose-500/80 transition-colors"
                                        >
                                            Clear all
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-2">
                        <span className="text-[9px] tracking-[1.5px] text-white/30 uppercase">Megaconstellations</span>
                        <div className="flex items-center justify-between py-0.5">
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[11px] text-white/70">Hide Starlink</span>
                                <span className="text-[9px] text-white/30">Filter out SpaceX network</span>
                            </div>
                            <button
                                onClick={() => setShowStarlink(!showStarlink)}
                                className={`relative inline-flex h-4 w-[30px] items-center rounded-full transition-all duration-200 ${!showStarlink ? 'bg-brand' : 'bg-white/10'}`}
                            >
                                <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-all duration-200 ${!showStarlink ? 'translate-x-[16px]' : 'translate-x-[2px]'}`} />
                            </button>
                        </div>
                    </div>

                    <div
                        className="text-center text-[10px] text-white/40 hover:text-white/80 underline cursor-pointer select-none pb-1 transition-colors mt-2"
                        onClick={resetFilters}
                    >
                        Reset all filters
                    </div>
                </div>

                <div className="h-px bg-white/5 mx-3 flex-shrink-0" />

                <div className="px-4 py-2 flex items-center gap-1.5 flex-shrink-0 sticky top-0 bg-zinc-900/96 z-10">
                    <div className="w-[5px] h-[5px] rounded-full bg-brand flex-shrink-0" />
                    <h3 className="text-[9px] tracking-[1.5px] text-white/30 uppercase">
                        Satellite Catalog
                    </h3>
                </div>

                <div className="flex-1 min-h-0">
                    {loading ? (
                        <div className="flex items-center gap-3 px-5 py-6">
                            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand border-t-transparent flex-shrink-0" />
                            <span className="text-zinc-500 text-xs font-medium">Synchronizing catalog…</span>
                        </div>
                    ) : error ? (
                        <div className="px-5 py-6 space-y-3">
                            <p className="text-rose-400 text-sm">{error}</p>
                            <button
                                onClick={() => window.location.reload()}
                                className="w-full py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 rounded-lg text-xs font-semibold transition-all border border-rose-500/20"
                            >
                                Retry
                            </button>
                        </div>
                    ) : (
                        <Virtuoso
                            data={filteredSatellites}
                            totalCount={filteredSatellites.length}
                            itemContent={(_, sat) => (
                                <div
                                    onClick={() => onSelect(sat)}
                                    className={`group flex flex-col justify-center px-4 py-3 cursor-pointer border-l-2 border-b border-b-white/[0.03] transition-all hover:bg-white/[0.04] ${selectedNoradId === sat.noradId
                                        ? 'bg-brand/[0.08] border-l-brand'
                                        : 'border-l-transparent'
                                        }`}
                                >
                                    <h4 className={`text-xs font-medium tracking-[0.3px] truncate transition-colors ${selectedNoradId === sat.noradId ? 'text-brand' : 'text-white/85 group-hover:text-white'
                                        }`}>
                                        {sat.name}
                                    </h4>
                                    <span className="text-[10px] font-mono text-white/25 mt-0.5">#{sat.noradId}</span>
                                </div>
                            )}
                            style={{
                                scrollbarWidth: 'thin',
                                scrollbarColor: 'rgba(255,255,255,0.1) transparent',
                            }}
                        />
                    )}
                </div>

                <div className="p-3 border-t border-white/5 flex flex-col gap-2 flex-shrink-0">
                    <div className="flex items-center justify-between gap-1.5 text-[9px] tracking-[1px] text-white/35 uppercase">
                        <div className="flex items-center gap-1.5">
                            <div className="h-[5px] w-[5px] rounded-full bg-[#2ecc71] animate-pulse" />
                            System Live
                        </div>
                        <button
                            onClick={onInfoClick}
                            className="hover:text-white transition-colors cursor-pointer"
                        >
                            About This Project
                        </button>
                    </div>
                </div>

            </div>

            <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="absolute top-1/2 -right-[23px] -translate-y-1/2 w-[23px] h-[48px] bg-zinc-900/96 border border-l-0 border-white/10 rounded-r-[8px] flex items-center justify-center cursor-pointer hover:bg-zinc-800 transition-colors shadow-lg pointer-events-auto group"
                aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
                <svg
                    className={`w-3.5 h-3.5 text-white/50 group-hover:text-white transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''
                        }`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
                </svg>
            </button>

        </div>
    );
};
