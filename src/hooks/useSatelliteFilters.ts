import { useState, useMemo, useEffect } from 'react';
import type { MergedSatellite } from '../services/satelliteData';
import { getSingleCountryName } from '../utils/countryUtils';
import { getOrbitRegime as getOrbitRegimeShared } from '../utils/orbitalPhysics';

export interface SatelliteFilters {
    search: string;
    setSearch: (v: string) => void;
    activeTypes: Set<string>;
    setActiveTypes: React.Dispatch<React.SetStateAction<Set<string>>>;
    activeOrbits: Set<string>;
    setActiveOrbits: React.Dispatch<React.SetStateAction<Set<string>>>;
    minYear: number;
    setMinYear: (v: number) => void;
    maxYear: number;
    setMaxYear: (v: number) => void;
    showStarlink: boolean;
    setShowStarlink: (v: boolean) => void;
    selectedCountries: Set<string>;
    setSelectedCountries: React.Dispatch<React.SetStateAction<Set<string>>>;
    countrySearch: string;
    setCountrySearch: (v: string) => void;
    countryOptions: { code: string; count: number; label: string }[];
    filteredCountryOptions: { code: string; count: number; label: string }[];
    toggleCountry: (code: string) => void;
    countryLabel: string;
    toggleSet: (
        set: Set<string>,
        val: string,
        setter: React.Dispatch<React.SetStateAction<Set<string>>>
    ) => void;
    getOrbitRegime: (params: {
        apoapsis?: number | null;
        eccentricity?: number | null;
        gcatOpOrbit?: string | null;
    }) => string | null;
    resetFilters: () => void;
    activeFilterCount: number;
    filteredSatellites: MergedSatellite[];
}

export function useSatelliteFilters(
    satellites: MergedSatellite[],
    showStarlink: boolean,
    setShowStarlink: (v: boolean) => void,
    onFilterChange?: (visibleIds: Set<number>) => void,
): SatelliteFilters {
    const [search, setSearch] = useState('');
    const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set());
    const [activeOrbits, setActiveOrbits] = useState<Set<string>>(new Set());
    const [minYear, setMinYear] = useState(1957);
    const [maxYear, setMaxYear] = useState(2026);
    const [selectedCountries, setSelectedCountries] = useState<Set<string>>(new Set());
    const [countrySearch, setCountrySearch] = useState('');

    const countryOptions = useMemo(() => {
        const counts: Record<string, number> = {};
        satellites.forEach(sat => {
            if (!sat.countries) return;
            const codes = sat.countries.split(/[,/]/).map((c: string) => c.trim().toUpperCase()).filter(Boolean);
            codes.forEach((code: string) => {
                if (code === 'TBD') return;
                counts[code] = (counts[code] || 0) + 1;
            });
        });
        return Object.entries(counts)
            .map(([code, count]) => ({ code, count, label: getSingleCountryName(code) }))
            .sort((a, b) => b.count - a.count);
    }, [satellites]);

    const filteredCountryOptions = useMemo(() =>
        countryOptions.filter(c =>
            c.label.toLowerCase().includes(countrySearch.toLowerCase()) ||
            c.code.toLowerCase().includes(countrySearch.toLowerCase())
        ), [countryOptions, countrySearch]);

    const toggleCountry = (code: string) => {
        setSelectedCountries(prev => {
            const next = new Set(prev);
            if (next.has(code)) next.delete(code);
            else next.add(code);
            return next;
        });
    };

    const countryLabel = useMemo(() => {
        if (selectedCountries.size === 0) return 'All origins';
        if (selectedCountries.size === 1) {
            const code = [...selectedCountries][0];
            const found = countryOptions.find(c => c.code === code);
            return found ? found.label : code;
        }
        return `${selectedCountries.size} origins`;
    }, [selectedCountries, countryOptions]);

    const toggleSet = (
        set: Set<string>,
        val: string,
        setter: React.Dispatch<React.SetStateAction<Set<string>>>
    ) => {
        const next = new Set(set);
        if (next.has(val)) next.delete(val);
        else next.add(val);
        setter(next);
    };

    const getOrbitRegime = (params: {
        apoapsis?: number | null;
        eccentricity?: number | null;
        gcatOpOrbit?: string | null;
    } | null | undefined): string | null => {
        return getOrbitRegimeShared(params);
    };


    const resetFilters = () => {
        setActiveTypes(new Set());
        setActiveOrbits(new Set());
        setMinYear(1957);
        setMaxYear(2026);
        setShowStarlink(true);
        setSelectedCountries(new Set());
        setCountrySearch('');
    };

    const activeFilterCount =
        activeTypes.size +
        activeOrbits.size +
        (minYear > 1957 || maxYear < 2026 ? 1 : 0) +
        (!showStarlink ? 1 : 0) +
        (selectedCountries.size > 0 ? 1 : 0);

    const filteredSatellites = useMemo(() => {
        let result = satellites;

        if (!showStarlink) {
            result = result.filter(s => !s.name.toUpperCase().startsWith('STARLINK'));
        }
        if (search) {
            const lower = search.toLowerCase();
            result = result.filter(
                sat => sat.name.toLowerCase().includes(lower) || sat.noradId.toString().includes(lower)
            );
        }
        if (activeTypes.size > 0) {
            result = result.filter(sat => sat.objectType && activeTypes.has(sat.objectType.toUpperCase()));
        }
        if (activeOrbits.size > 0) {
            result = result.filter(sat => {
                const regime = getOrbitRegime({
                    apoapsis: sat.apoapsis,
                    eccentricity: sat.omm?.ECCENTRICITY || sat.masterData?.spacetrack?.ECCENTRICITY,
                    gcatOpOrbit: sat.masterData?.gcat?.OpOrbit
                });
                return regime && activeOrbits.has(regime);
            });
        }
        if (minYear > 1957 || maxYear < 2026) {
            result = result.filter(sat => sat.launchYear && sat.launchYear >= minYear && sat.launchYear <= maxYear);
        }
        if (selectedCountries.size > 0) {
            result = result.filter(sat => {
                if (!sat.countries) return false;
                const satCodes = sat.countries.split(/[,/]/).map((c: string) => c.trim().toUpperCase());
                return satCodes.some((code: string) => selectedCountries.has(code));
            });
        }

        return result;
    }, [satellites, search, activeTypes, activeOrbits, minYear, maxYear, showStarlink, selectedCountries]);

    useEffect(() => {
        if (onFilterChange) {
            onFilterChange(new Set(filteredSatellites.map(s => s.noradId)));
        }
    }, [filteredSatellites, onFilterChange]);

    return {
        search, setSearch,
        activeTypes, setActiveTypes,
        activeOrbits, setActiveOrbits,
        minYear, setMinYear,
        maxYear, setMaxYear,
        showStarlink, setShowStarlink,
        selectedCountries, setSelectedCountries,
        countrySearch, setCountrySearch,
        countryOptions,
        filteredCountryOptions,
        toggleCountry,
        countryLabel,
        toggleSet,
        getOrbitRegime,
        resetFilters,
        activeFilterCount,
        filteredSatellites,
    };
}
