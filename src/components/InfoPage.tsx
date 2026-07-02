import React from 'react';

interface InfoPageProps {
  onClose: () => void;
}

export const InfoPage: React.FC<InfoPageProps> = ({ onClose }) => {
  return (
    <div className="h-full flex flex-col p-6 text-zinc-300">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-white">About Satplex</h2>
        <button onClick={onClose} className="p-4 -m-4 text-zinc-500 hover:text-white" aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="1" y1="1" x2="13" y2="13"/><line x1="13" y1="1" x2="1" y2="13"/>
          </svg>
        </button>
      </div>

      <div className="space-y-6 overflow-y-auto">
        <section>
          <h3 className="font-semibold text-white mb-2">Connect</h3>
          <ul className="space-y-2">
            <li>Email: contact@satplex.io</li>
            <li>
              GitHub:{' '}
              <a
                href="https://github.com/mwatiker/satplex"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white"
              >
                github.com/mwatiker/satplex
              </a>
            </li>
          </ul>
        </section>

        <section>
          <h3 className="font-semibold text-white mb-2">Attribution</h3>
          <ul className="text-sm space-y-1.5 text-zinc-400">
            <li><a href="https://www.space-track.org" className="hover:text-white">Space-Track</a></li>
            <li><a href="https://satnogs.org" className="hover:text-white">SatNOGS</a></li>
            <li><a href="https://celestrak.org" className="hover:text-white">Celestrak</a></li>
            <li><a href="https://space.skyrocket.de" className="hover:text-white">Gunter's Space Page</a></li>
            <li><a href="https://ucsusa.org" className="hover:text-white">Union of Concerned Scientists</a></li>
            <li><a href="https://www.solarsystemscope.com/textures/" className="hover:text-white">Solar System Scope</a></li>
          </ul>
        </section>

        <section className="pt-4 border-t border-white/10">
          <a
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-zinc-400 hover:text-white"
          >
            Privacy Policy
          </a>
        </section>

        <section className="hidden md:block pt-4 border-t border-white/10">
          <a
            href="https://ko-fi.com/mwatiker"
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full py-3 bg-[#0ea5e9]/10 border border-[#0ea5e9]/50 text-[#0ea5e9] text-center rounded-lg hover:bg-[#0ea5e9]/20 transition font-medium"
          >
            Buy me a coffee
          </a>
        </section>
      </div>
    </div>
  );
};
