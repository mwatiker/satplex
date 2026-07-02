import React, { useRef, useEffect, useState } from 'react';
import { BottomSheet } from './BottomSheet';
import type { SatelliteFilters } from '../hooks/useSatelliteFilters';

interface FilterSheetProps {
    filters: SatelliteFilters;
    isOpen: boolean;
    onClose: () => void;
}

export const FilterSheet: React.FC<FilterSheetProps> = ({ filters, isOpen, onClose }) => {
    const {
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
    } = filters;

    const [isCountryOpen, setIsCountryOpen] = React.useState(false);
    const countryDropdownRef = useRef<HTMLDivElement>(null);

    // Local UI state to keep the mobile slider touch interactions fluid
    const [localMinYear, setLocalMinYear] = useState(minYear);
    const [localMaxYear, setLocalMaxYear] = useState(maxYear);

    // Sync local state if parent state changes externally
    useEffect(() => {
        setLocalMinYear(minYear);
    }, [minYear]);

    useEffect(() => {
        setLocalMaxYear(maxYear);
    }, [maxYear]);

    useEffect(() => {
        if (!isOpen) setIsCountryOpen(false);
    }, [isOpen]);

    const getPillClass = (type: string, isActive: boolean) => {
        const base = 'text-[10px] px-3 py-1.5 rounded-sm border transition-all cursor-pointer select-none whitespace-nowrap font-mono uppercase tracking-wider';

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
        <BottomSheet
            isOpen={isOpen}
            onClose={onClose}
                snapPoints={['78vh']}
                header={
                    <div className="flex justify-between items-center px-4 pt-2">
                        <div className="flex items-center gap-2">
                            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Filters</h2>
                            {activeFilterCount > 0 && (
                                <span className="bg-brand/20 border border-brand/40 text-brand text-[10px] font-semibold rounded-full px-2 py-0.5 leading-tight">
                                    {activeFilterCount} active
                                </span>
                            )}
                        </div>
                        <button
                            onClick={onClose}
                            className="p-4 -m-4 text-zinc-500 hover:text-white transition-colors"
                            aria-label="Close filters"
                        >
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                <line x1="1" y1="1" x2="13" y2="13"/><line x1="13" y1="1" x2="1" y2="13"/>
                            </svg>
                        </button>
                    </div>
                }
            >
                <div className="flex flex-col gap-6 px-4 py-4 pb-12">

                    <div className="flex flex-col gap-3">
                        <span className="text-[10px] tracking-[1.5px] text-white/40 uppercase font-semibold">
                            Object Type
                        </span>
                        <div className="flex flex-wrap gap-2">
                            {['PAYLOAD', 'DEBRIS', 'ROCKET BODY', 'UNKNOWN'].map(type => (
                                <div
                                    key={type}
                                    onClick={() => toggleSet(activeTypes, type, setActiveTypes)}
                                    className={getPillClass(type, activeTypes.has(type))}
                                >
                                    {type.charAt(0) + type.slice(1).toLowerCase()}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="h-px bg-white/5" />

                    <div className="flex flex-col gap-3">
                        <span className="text-[10px] tracking-[1.5px] text-white/40 uppercase font-semibold">
                            Orbit Regime
                        </span>
                        <div className="flex flex-wrap gap-2">
                            {['LEO', 'MEO', 'GEO', 'HEO'].map(orbit => (
                                <div
                                    key={orbit}
                                    onClick={() => toggleSet(activeOrbits, orbit, setActiveOrbits)}
                                    className={getPillClass(orbit, activeOrbits.has(orbit))}
                                >
                                    {orbit}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="h-px bg-white/5" />

                    <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] tracking-[1.5px] text-white/40 uppercase font-semibold">
                                Launch Year: {localMinYear}–{localMaxYear}
                            </span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-[11px] text-white/30 tabular-nums w-8">1957</span>
                            <div className="relative flex-1 h-1 flex items-center">
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
                                    className="absolute inset-0 w-full h-full appearance-none bg-transparent pointer-events-none z-[1] hover:z-[2] active:z-[2] focus:z-[2] [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-brand [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-brand [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:shadow-md"
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
                                    className="absolute inset-0 w-full h-full appearance-none bg-transparent pointer-events-none z-[1] hover:z-[2] active:z-[2] focus:z-[2] [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-brand [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-brand [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:shadow-md"
                                />
                            </div>
                            <span className="text-[11px] text-white/30 tabular-nums w-8 text-right">2026</span>
                        </div>
                    </div>

                    <div className="h-px bg-white/5" />

                    <div className="flex flex-col gap-3" ref={countryDropdownRef}>
                        <span className="text-[10px] tracking-[1.5px] text-white/40 uppercase font-semibold">
                            Origin
                        </span>
                        <button
                            onClick={() => setIsCountryOpen(prev => !prev)}
                            className={`w-full flex items-center justify-between px-4 py-3 rounded-md border text-[12px] transition-all cursor-pointer select-none
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
                                    >
                                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                                            <line x1="1" y1="1" x2="9" y2="9"/><line x1="9" y1="1" x2="1" y2="9"/>
                                        </svg>
                                    </span>
                                )}
                                <svg
                                    className={`w-3.5 h-3.5 transition-transform duration-200 ${isCountryOpen ? 'rotate-180' : ''}`}
                                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </button>

                        {isCountryOpen && (
                            <div className="flex flex-col bg-zinc-900 border border-white/10 rounded-md overflow-hidden shadow-xl">
                                <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/5">
                                    <svg className="w-3.5 h-3.5 text-white/25 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                    <input
                                        type="text"
                                        placeholder="Search origins..."
                                        value={countrySearch}
                                        onChange={(e) => setCountrySearch(e.target.value)}
                                        className="w-full bg-transparent border-none outline-none text-base text-white/60 placeholder:text-white/25"
                                    />
                                    {countrySearch && (
                                        <button onClick={() => setCountrySearch('')} className="text-white/25 hover:text-white/60 transition-colors flex-shrink-0">
                                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                                                <line x1="1" y1="1" x2="9" y2="9"/><line x1="9" y1="1" x2="1" y2="9"/>
                                            </svg>
                                        </button>
                                    )}
                                </div>
                                <div className="overflow-y-auto max-h-[200px]" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}>
                                    {filteredCountryOptions.length === 0 ? (
                                        <div className="px-3 py-4 text-[12px] text-white/25 text-center">No matches</div>
                                    ) : (
                                        filteredCountryOptions.map(({ code, label, count }) => {
                                            const isSelected = selectedCountries.has(code);
                                            return (
                                                <div
                                                    key={code}
                                                    onClick={() => toggleCountry(code)}
                                                    className={`flex items-center justify-between px-3 py-2.5 cursor-pointer transition-colors text-[12px]
                                                        ${isSelected
                                                            ? 'bg-brand/10 text-brand'
                                                            : 'text-white/50 hover:bg-white/[0.04] hover:text-white/80'
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <span className="text-[10px] font-mono text-white/25 w-7 flex-shrink-0">{code}</span>
                                                        <span className="truncate">{label}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                                        <span className="text-[10px] text-white/20 tabular-nums">{count}</span>
                                                        {isSelected && (
                                                            <svg className="w-3.5 h-3.5 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                                    <div className="border-t border-white/5 px-3 py-2 flex items-center justify-between">
                                        <span className="text-[11px] text-white/30">{selectedCountries.size} selected</span>
                                        <button
                                            onClick={() => { setSelectedCountries(new Set()); setCountrySearch(''); }}
                                            className="text-[11px] text-rose-500/50 hover:text-rose-500/80 transition-colors"
                                        >
                                            Clear all
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="h-px bg-white/5" />

                    <div className="flex flex-col gap-3">
                        <span className="text-[10px] tracking-[1.5px] text-white/40 uppercase font-semibold">
                            Megaconstellations
                        </span>
                        <div className="flex items-center justify-between py-1">
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[13px] text-white/70">Hide Starlink</span>
                                <span className="text-[10px] text-white/30">Filter out SpaceX network</span>
                            </div>
                            <button
                                onClick={() => setShowStarlink(!showStarlink)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-200 flex-shrink-0 ${!showStarlink ? 'bg-brand' : 'bg-white/10'}`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-all duration-200 ${!showStarlink ? 'translate-x-[26px]' : 'translate-x-[3px]'}`} />
                            </button>
                        </div>
                    </div>

                    {activeFilterCount > 0 && (
                        <>
                            <div className="h-px bg-white/5 mt-2" />
                            <button
                                onClick={() => { resetFilters(); onClose(); }}
                                className="w-full py-2 text-white/40 hover:text-white/80 underline text-[12px] font-medium transition-colors"
                            >
                                Reset all filters
                            </button>
                        </>
                    )}
                </div>
            </BottomSheet>
    );
};
