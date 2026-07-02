import React, { useState } from 'react';

export const FilterPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="border-b border-white/10">
      <div 
        className="flex items-center justify-between p-4 cursor-pointer select-none hover:bg-white/5"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="text-[9px] tracking-[1.5px] text-white/40 flex items-center gap-2">
          <i className="ti ti-adjustments-horizontal" />
          FILTERS
          <span className="bg-[#0EA5E9] text-white text-[9px] font-bold rounded-full px-2">3</span>
        </span>
        <i className={`ti ti-chevron-down text-white/30 text-xs transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="p-4 pt-0 flex flex-col gap-4 text-white text-xs">
          <div>
            <div className="text-[9px] tracking-[1.5px] text-white/30 uppercase mb-2">Object type</div>
            <div className="flex flex-wrap gap-2">
              <button className="px-3 py-1 rounded-full border border-[#0EA5E9]/50 bg-[#0EA5E9]/15 text-[#0EA5E9] text-[10px]">Payload</button>
              <button className="px-3 py-1 rounded-full border border-[#334155]/50 bg-[#334155]/15 text-[#e2e8f0] text-[10px]">Debris</button>
            </div>
          </div>
          
        </div>
      )}
    </div>
  );
};
