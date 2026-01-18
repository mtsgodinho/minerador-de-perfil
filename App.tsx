
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { AppStatus, Lead, SearchConfig, GroundingSource, TabType } from './types';
import { mineLeads } from './geminiService';

const App: React.FC = () => {
  const [config, setConfig] = useState<SearchConfig>({
    niche: 'Dentista',
    location: 'São Paulo',
    quantity: 30,
    onlyWithoutWebsite: true
  });
  const [leads, setLeads] = useState<Lead[]>([]);
  const [favorites, setFavorites] = useState<Lead[]>(() => {
    try {
      const saved = localStorage.getItem('instalead_favorites');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [activeTab, setActiveTab] = useState<TabType>('EXPLORE');
  const [sources, setSources] = useState<GroundingSource[]>([]);
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const progressIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    localStorage.setItem('instalead_favorites', JSON.stringify(favorites));
  }, [favorites]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === AppStatus.SEARCHING) return;

    setActiveTab('EXPLORE');
    setStatus(AppStatus.SEARCHING);
    setError(null);
    setProgress(0);
    setLeads([]);
    setSources([]);

    const duration = 15000; 
    const startTime = Date.now();

    if (progressIntervalRef.current) window.clearInterval(progressIntervalRef.current);
    
    progressIntervalRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startTime;
      const calculatedProgress = Math.min((elapsed / duration) * 100, 99);
      setProgress(calculatedProgress);
    }, 100);
    
    try {
      const result = await mineLeads(config);
      
      if (progressIntervalRef.current) {
        window.clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      
      if (!result.leads || result.leads.length === 0) {
        setError("Nenhum profissional encontrado. Tente ser mais específico com a cidade.");
        setStatus(AppStatus.ERROR);
      } else {
        setLeads(result.leads);
        setSources(result.sources);
        setProgress(100);
        setStatus(AppStatus.COMPLETED);
      }
    } catch (err: any) {
      if (progressIntervalRef.current) window.clearInterval(progressIntervalRef.current);
      setError(err.message || 'Erro inesperado. Tente novamente.');
      setStatus(AppStatus.ERROR);
    }
  };

  const toggleFavorite = (lead: Lead) => {
    setFavorites(prev => {
      const isFav = prev.find(f => f.name === lead.name && (f.phone === lead.phone || f.username === lead.username));
      if (isFav) {
        return prev.filter(f => !(f.name === lead.name));
      } else {
        return [...prev, { ...lead, isFavorite: true }];
      }
    });
  };

  const isFavorited = (lead: Lead) => {
    return favorites.some(f => f.name === lead.name);
  };

  const exportCSV = useCallback(() => {
    const listToExport = activeTab === 'EXPLORE' ? leads : favorites;
    if (listToExport.length === 0) return;

    const headers = ['Nome', 'Instagram', 'Telefone', 'Website', 'Localização', 'Tem Instagram?', 'Tem Site?'];
    const rows = listToExport.map(l => [
      `"${l.name.replace(/"/g, '""')}"`, 
      `"${l.profileLink || ''}"`, 
      `"${l.phone || ''}"`, 
      `"${l.websiteUrl || ''}"`,
      `"${l.location.replace(/"/g, '""')}"`, 
      l.hasInstagram ? 'Sim' : 'Não', 
      l.hasWebsite ? 'Sim' : 'Não'
    ]);
    const csvContent = [headers, ...rows].map(e => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `leads_${Date.now()}.csv`);
    link.click();
  }, [leads, favorites, activeTab]);

  return (
    <div className="min-h-screen flex flex-col items-center">
      <header className="w-full max-w-7xl px-6 py-10 flex flex-col items-center justify-center">
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-[#00f3ff] to-[#bc00ff] rounded-lg blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
          <img 
            src="https://i.imgur.com/XCTkJN0.png" 
            alt="TECHVIEW LOGO" 
            className="h-20 md:h-28 relative animate-flicker"
          />
        </div>
        <div className="flex flex-col items-center gap-1">
          <p className="mt-4 font-orbitron text-xs md:text-sm tracking-[0.5em] text-[#00f3ff] opacity-80 uppercase text-center">
            ULTRA MINER V6.6 | VERIFIED LINKS
          </p>
        </div>
      </header>

      <main className="w-full max-w-6xl px-4 pb-20 space-y-8">
        <section className="bg-[rgba(15,15,30,0.8)] border border-[rgba(0,243,255,0.2)] rounded-2xl p-8 shadow-2xl relative">
          <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 items-end">
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-[#00f3ff] tracking-widest ml-1">QUEM BUSCAR?</label>
              <input 
                type="text" 
                value={config.niche}
                onChange={e => setConfig({...config, niche: e.target.value})}
                placeholder="Ex: Dentistas..."
                className="w-full terminal-input px-4 py-3 rounded-md transition duration-300"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-[#00f3ff] tracking-widest ml-1">ONDE BUSCAR?</label>
              <input 
                type="text" 
                value={config.location}
                onChange={e => setConfig({...config, location: e.target.value})}
                placeholder="Ex: São Paulo"
                className="w-full terminal-input px-4 py-3 rounded-md transition duration-300"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-[#00f3ff] tracking-widest ml-1">VOLUME</label>
              <input 
                type="number"
                min="1"
                value={config.quantity}
                onChange={e => setConfig({...config, quantity: Number(e.target.value)})}
                className="w-full terminal-input px-4 py-3 rounded-md transition duration-300"
              />
            </div>
            <div className="flex flex-col gap-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={config.onlyWithoutWebsite}
                  onChange={e => setConfig({...config, onlyWithoutWebsite: e.target.checked})}
                  className="w-5 h-5 bg-black border-[#00f3ff] rounded appearance-none checked:bg-[#00f3ff] transition-all border"
                />
                <span className="text-[10px] font-bold text-gray-400 uppercase">Filtrar sem site</span>
              </label>
              <button 
                type="submit"
                disabled={status === AppStatus.SEARCHING}
                className="w-full neon-button py-3 rounded-md font-bold text-sm shadow-lg disabled:opacity-50"
              >
                {status === AppStatus.SEARCHING ? 'MINERANDO...' : 'BUSCAR AGORA'}
              </button>
            </div>
          </form>
        </section>

        <div className="flex justify-center md:justify-start gap-4 border-b border-white/10 pb-4">
          <button 
            onClick={() => setActiveTab('EXPLORE')}
            className={`font-orbitron text-xs font-black tracking-widest px-6 py-2 transition-all ${activeTab === 'EXPLORE' ? 'text-[#00f3ff] border-b-2 border-[#00f3ff]' : 'text-gray-500 hover:text-white'}`}
          >
            RESULTADOS ({leads.length})
          </button>
          <button 
            onClick={() => setActiveTab('FAVORITES')}
            className={`font-orbitron text-xs font-black tracking-widest px-6 py-2 transition-all ${activeTab === 'FAVORITES' ? 'text-[#bc00ff] border-b-2 border-[#bc00ff]' : 'text-gray-500 hover:text-white'}`}
          >
            FAVORITOS ({favorites.length})
          </button>
        </div>

        {status === AppStatus.SEARCHING && (
          <div className="bg-[#0a0a1a] border border-[#00f3ff] rounded-xl p-10 text-center space-y-6">
            <div className="flex justify-between items-end font-orbitron">
              <p className="text-[#00f3ff] text-xl font-black italic">MINERANDO A WEB</p>
              <p className="text-[#00f3ff] text-2xl font-bold">{Math.round(progress)}%</p>
            </div>
            <div className="w-full bg-gray-900/50 h-2 rounded-full overflow-hidden border border-[#00f3ff]/20">
              <div 
                className="bg-gradient-to-r from-[#00f3ff] to-[#bc00ff] h-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        )}

        <section className="space-y-8">
          {(activeTab === 'EXPLORE' ? leads : favorites).length > 0 ? (
            <>
              <div className="flex justify-between items-center">
                <h2 className="font-orbitron text-xl font-black text-white italic tracking-tighter uppercase">LISTA DE <span className="text-[#00f3ff]">LEADS</span></h2>
                <button onClick={exportCSV} className="text-[10px] font-black border border-white/20 px-8 py-2 rounded-full hover:bg-white/10 transition-all uppercase tracking-widest">Exportar CSV</button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {(activeTab === 'EXPLORE' ? leads : favorites).map((lead) => (
                  <div key={lead.id} className="lead-card border border-white/10 rounded-xl p-6 relative flex flex-col">
                    <div className="flex justify-between items-start mb-4">
                      <div className="space-y-1 overflow-hidden">
                        <h3 className="text-white font-orbitron font-bold text-lg leading-tight truncate">{lead.name}</h3>
                        <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest truncate">{lead.location}</p>
                      </div>
                      <button 
                        onClick={() => toggleFavorite(lead)}
                        className={`transition-all duration-300 ${isFavorited(lead) ? 'text-[#bc00ff]' : 'text-gray-600 hover:text-[#bc00ff]'}`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill={isFavorited(lead) ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-6">
                      <div className={`p-2 rounded border ${lead.hasInstagram ? 'border-green-500/20 bg-green-500/5' : 'border-red-500/20 bg-red-500/5'} flex flex-col items-center justify-center`}>
                        <span className={`text-[9px] font-black ${lead.hasInstagram ? 'text-green-500' : 'text-red-500'}`}>INSTAGRAM</span>
                        <span className="text-[8px] font-bold text-gray-500 truncate w-full text-center">{lead.hasInstagram ? (lead.username || 'LINK OK') : 'NÃO TEM'}</span>
                      </div>
                      <div className={`p-2 rounded border ${lead.hasWebsite ? 'border-green-500/20 bg-green-500/5' : 'border-red-500/20 bg-red-500/5'} flex flex-col items-center justify-center`}>
                        <span className={`text-[9px] font-black ${lead.hasWebsite ? 'text-green-500' : 'text-red-500'}`}>WEBSITE</span>
                        <span className="text-[8px] font-bold text-gray-500 uppercase">{lead.hasWebsite ? 'POSSUI' : 'NÃO TEM'}</span>
                      </div>
                    </div>

                    <div className="flex-1 space-y-4 mb-6">
                      {lead.phone && (
                        <div className="flex items-center gap-3 bg-black/50 p-3 rounded-lg border border-white/5">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#00f3ff]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                          <span className="text-xs font-black text-white">{lead.phone}</span>
                        </div>
                      )}
                      <p className="text-[10px] text-gray-500 italic border-l border-white/10 pl-3 line-clamp-3 leading-relaxed">{lead.bio || "Sem bio disponível."}</p>
                    </div>

                    <div className="flex gap-2 mt-auto">
                      {lead.hasInstagram && lead.profileLink && (
                        <a 
                          href={lead.profileLink} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="flex-1 bg-white/5 border border-white/10 py-2 rounded text-[9px] font-black text-center text-white hover:bg-[#bc00ff] hover:text-black transition-all uppercase tracking-widest"
                        >
                          Instagram
                        </a>
                      )}
                      <a 
                        href={lead.phone ? `https://wa.me/${lead.phone.replace(/\D/g, '')}` : `https://google.com/search?q=${encodeURIComponent(lead.name)}`}
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className={`flex-1 ${lead.hasWebsite ? 'bg-white/5 text-gray-500' : 'bg-[#00f3ff]/20 border-[#00f3ff]/30 text-[#00f3ff] hover:bg-[#00f3ff] hover:text-black'} border py-2 rounded text-[9px] font-black text-center transition-all uppercase tracking-widest`}
                      >
                        {lead.hasWebsite ? 'Ver Detalhes' : 'Ofertar Site'}
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-24 text-gray-700 font-orbitron text-[10px] tracking-[0.5em] uppercase opacity-40 border border-dashed border-white/10 rounded-3xl">
              Sistema pronto. Inicie a mineração.
            </div>
          )}
        </section>

        {status === AppStatus.ERROR && (
          <div className="bg-red-950/20 border border-red-500/40 rounded-2xl p-10 text-center max-w-2xl mx-auto shadow-2xl">
            <h4 className="font-orbitron font-black text-red-500 text-2xl mb-4 italic uppercase">Erro de Grounding</h4>
            <p className="text-sm text-red-400 font-bold uppercase tracking-widest mb-8">{error}</p>
            <button onClick={() => setStatus(AppStatus.IDLE)} className="text-[10px] font-black bg-red-500 text-black px-12 py-4 rounded hover:bg-red-400 transition-all uppercase tracking-widest shadow-lg">Reiniciar Sistema</button>
          </div>
        )}
      </main>

      <footer className="w-full bg-[#05050a] border-t border-white/5 py-12 px-6 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-10 opacity-30 text-center">
          <div className="flex items-center gap-4">
            <img src="https://i.imgur.com/XCTkJN0.png" alt="TECHVIEW" className="h-8" />
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.3em]">Cloud Miner 6.6</span>
          </div>
          <div className="text-[9px] font-bold text-gray-600 tracking-widest uppercase flex gap-10">
            <span>ENGINE: GEMINI-3-FLASH</span>
            <span>DATA: REALTIME CLOUD</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
