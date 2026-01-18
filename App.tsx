
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { AppStatus, Lead, SearchConfig, GroundingSource, TabType } from './types';
import { mineLeads } from './geminiService';

const App: React.FC = () => {
  const [config, setConfig] = useState<SearchConfig>({
    niche: 'Dentista',
    location: 'Brasil',
    quantity: 30,
    onlyWithoutWebsite: true
  });
  const [leads, setLeads] = useState<Lead[]>([]);
  const [favorites, setFavorites] = useState<Lead[]>(() => {
    const saved = localStorage.getItem('instalead_favorites');
    return saved ? JSON.parse(saved) : [];
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
    if (config.quantity <= 0) return;

    setActiveTab('EXPLORE');
    setStatus(AppStatus.SEARCHING);
    setError(null);
    setProgress(0);
    setLeads([]);
    setSources([]);

    // Dinamismo no tempo de espera baseado na quantidade solicitada
    const baseDuration = 8000;
    const extraDuration = Math.min(12000, (config.quantity / 10) * 2000);
    const duration = baseDuration + extraDuration; 
    const startTime = Date.now();

    if (progressIntervalRef.current) window.clearInterval(progressIntervalRef.current);
    
    progressIntervalRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startTime;
      const calculatedProgress = Math.min((elapsed / duration) * 100, 99);
      setProgress(calculatedProgress);
    }, 50);
    
    try {
      const result = await mineLeads(config);
      
      if (progressIntervalRef.current) {
        window.clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      
      if (!result.leads || result.leads.length === 0) {
        setError("Não conseguimos extrair dados estruturados. Dica: Tente colocar uma cidade real no campo 'Onde buscar' (Ex: São Paulo, Curitiba).");
        setStatus(AppStatus.ERROR);
      } else {
        setLeads(result.leads);
        setSources(result.sources);
        setProgress(100);
        setStatus(AppStatus.COMPLETED);
      }
    } catch (err: any) {
      if (progressIntervalRef.current) window.clearInterval(progressIntervalRef.current);
      setError(err.message || 'Falha na conexão com os motores de busca.');
      setStatus(AppStatus.ERROR);
    }
  };

  const toggleFavorite = (lead: Lead) => {
    setFavorites(prev => {
      const isFav = prev.find(f => f.name === lead.name && f.phone === lead.phone);
      if (isFav) {
        return prev.filter(f => !(f.name === lead.name && f.phone === lead.phone));
      } else {
        return [...prev, { ...lead, isFavorite: true }];
      }
    });
  };

  const isFavorited = (lead: Lead) => {
    return favorites.some(f => f.name === lead.name && f.phone === lead.phone);
  };

  const exportCSV = useCallback(() => {
    const listToExport = activeTab === 'EXPLORE' ? leads : favorites;
    if (listToExport.length === 0) return;

    const headers = ['Nome', 'Instagram', 'Telefone', 'Website', 'Localização', 'Tem Instagram?', 'Tem Site?'];
    const rows = listToExport.map(l => [
      `"${l.name}"`, `"${l.profileLink || ''}"`, `"${l.phone || ''}"`, `"${l.websiteUrl || ''}"`,
      `"${l.location}"`, l.hasInstagram ? 'Sim' : 'Não', l.hasWebsite ? 'Sim' : 'Não'
    ]);
    const csvContent = [headers, ...rows].map(e => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `LEADS_${config.niche.toUpperCase()}_${Date.now()}.csv`);
    link.click();
  }, [leads, favorites, activeTab, config.niche]);

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
            ULTRA MINER V6.5 | BUSCA MASSIVA
          </p>
          <div className="flex flex-col items-center gap-1 mt-2">
            <div className="flex items-center gap-2">
              <span className="h-[1px] w-8 bg-[#bc00ff]/30"></span>
              <span className="text-[10px] font-bold text-[#bc00ff] uppercase tracking-[0.2em] opacity-90">Deep Search Grounding Ativado</span>
              <span className="h-[1px] w-8 bg-[#bc00ff]/30"></span>
            </div>
          </div>
        </div>
      </header>

      <main className="w-full max-w-6xl px-4 pb-20 space-y-8">
        <section className="bg-[rgba(15,15,30,0.8)] border border-[rgba(0,243,255,0.2)] rounded-2xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-[#00f3ff]"></div>
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-[#bc00ff]"></div>
          
          <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 items-end">
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-[#00f3ff] tracking-widest ml-1">QUEM BUSCAR?</label>
              <input 
                type="text" 
                value={config.niche}
                onChange={e => setConfig({...config, niche: e.target.value})}
                placeholder="Ex: Dentistas, Médicos..."
                className="w-full terminal-input px-4 py-3 rounded-md transition duration-300"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-[#00f3ff] tracking-widest ml-1">ONDE BUSCAR?</label>
              <input 
                type="text" 
                value={config.location}
                onChange={e => setConfig({...config, location: e.target.value})}
                placeholder="Ex: São Paulo, Brasil"
                className="w-full terminal-input px-4 py-3 rounded-md transition duration-300"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-[#00f3ff] tracking-widest ml-1">VOLUME DESEJADO</label>
              <input 
                type="number"
                min="1"
                value={config.quantity}
                onChange={e => setConfig({...config, quantity: Number(e.target.value)})}
                className="w-full terminal-input px-4 py-3 rounded-md transition duration-300"
              />
            </div>
            <div className="flex flex-col gap-4">
              <label className="flex items-center gap-3 cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={config.onlyWithoutWebsite}
                  onChange={e => setConfig({...config, onlyWithoutWebsite: e.target.checked})}
                  className="w-5 h-5 bg-black border-[#00f3ff] rounded appearance-none checked:bg-[#00f3ff] transition-all cursor-pointer border"
                />
                <span className="text-[10px] font-bold text-gray-400 group-hover:text-[#00f3ff] tracking-tighter uppercase italic">Filtrar sem site próprio</span>
              </label>
              <button 
                type="submit"
                disabled={status === AppStatus.SEARCHING}
                className="w-full neon-button py-3 rounded-md font-bold text-sm shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {status === AppStatus.SEARCHING ? 'VARRENDO A WEB...' : 'INICIAR MINERAÇÃO'}
              </button>
            </div>
          </form>
        </section>

        <div className="flex justify-center md:justify-start gap-4 border-b border-white/10 pb-4">
          <button 
            onClick={() => setActiveTab('EXPLORE')}
            className={`font-orbitron text-xs font-black tracking-widest px-6 py-2 transition-all ${activeTab === 'EXPLORE' ? 'text-[#00f3ff] border-b-2 border-[#00f3ff]' : 'text-gray-500 hover:text-white'}`}
          >
            RESULTADOS ENCONTRADOS ({leads.length})
          </button>
          <button 
            onClick={() => setActiveTab('FAVORITES')}
            className={`font-orbitron text-xs font-black tracking-widest px-6 py-2 transition-all ${activeTab === 'FAVORITES' ? 'text-[#bc00ff] border-b-2 border-[#bc00ff]' : 'text-gray-500 hover:text-white'}`}
          >
            FAVORITOS ({favorites.length})
          </button>
        </div>

        {status === AppStatus.SEARCHING && (
          <div className="bg-[#0a0a1a] border border-[#00f3ff] rounded-xl p-10 text-center space-y-8 animate-pulse shadow-[0_0_50px_rgba(0,243,255,0.08)]">
            <div className="max-w-xl mx-auto space-y-6">
              <div className="flex justify-between items-end font-orbitron">
                <p className="text-[#00f3ff] text-xl font-black italic">MINERAÇÃO EM PROFUNDIDADE</p>
                <p className="text-[#00f3ff] text-2xl font-bold">{Math.round(progress)}%</p>
              </div>
              <div className="w-full bg-gray-900/50 h-3 rounded-full overflow-hidden border border-[rgba(0,243,255,0.2)]">
                <div 
                  className="bg-gradient-to-r from-[#00f3ff] to-[#bc00ff] h-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <div className="space-y-2">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em]">Varrendo Google Maps e resultados orgânicos...</p>
                <p className="text-[9px] text-gray-600 uppercase tracking-widest">Aguarde, estamos processando {config.quantity} leads simultâneos.</p>
              </div>
            </div>
          </div>
        )}

        <section className="space-y-8">
          {(activeTab === 'EXPLORE' ? leads : favorites).length > 0 ? (
            <>
              <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h2 className="font-orbitron text-xl font-black text-white italic tracking-tighter uppercase">
                  LEADS <span className={activeTab === 'EXPLORE' ? 'text-[#00f3ff]' : 'text-[#bc00ff]'}>MAPEADOS</span>
                </h2>
                <div className="flex gap-4">
                   <span className="text-[10px] text-gray-500 font-bold py-2 px-4 border border-white/5 rounded-full uppercase tracking-tighter">
                     {activeTab === 'EXPLORE' ? `${leads.length} encontrados` : `${favorites.length} favoritos`}
                   </span>
                   <button onClick={exportCSV} className="text-[10px] font-black border border-white/20 px-8 py-2 rounded-full hover:bg-white/10 transition-all uppercase tracking-widest shadow-lg">Exportar Tudo</button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {(activeTab === 'EXPLORE' ? leads : favorites).map((lead) => (
                  <div key={lead.id} className="lead-card border border-white/10 rounded-xl p-6 relative group border-l-4 border-l-transparent hover:border-l-[#00f3ff]">
                    <div className="flex justify-between items-start mb-4">
                      <div className="space-y-1">
                        <h3 className="text-white font-orbitron font-bold text-lg leading-tight group-hover:text-[#00f3ff] transition-colors line-clamp-1">
                          {lead.name}
                        </h3>
                        <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest flex items-center gap-1">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                          {lead.location}
                        </p>
                      </div>
                      <button 
                        onClick={() => toggleFavorite(lead)}
                        className={`transition-all duration-300 transform hover:scale-125 ${isFavorited(lead) ? 'text-[#bc00ff]' : 'text-gray-600 hover:text-[#bc00ff]'}`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill={isFavorited(lead) ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-6">
                      <div className={`p-2 rounded border ${lead.hasInstagram ? 'border-green-500/20 bg-green-500/5' : 'border-red-500/20 bg-red-500/5'} flex flex-col items-center justify-center gap-1`}>
                        <span className={`text-[9px] font-black ${lead.hasInstagram ? 'text-green-500' : 'text-red-500'}`}>INSTAGRAM</span>
                        <span className="text-[8px] font-bold text-gray-500 truncate max-w-full">{lead.hasInstagram ? (lead.username || 'LINK') : 'SEM INFO'}</span>
                      </div>
                      <div className={`p-2 rounded border ${lead.hasWebsite ? 'border-green-500/20 bg-green-500/5' : 'border-red-500/20 bg-red-500/5'} flex flex-col items-center justify-center gap-1`}>
                        <span className={`text-[9px] font-black ${lead.hasWebsite ? 'text-green-500' : 'text-red-500'}`}>SITE</span>
                        <span className="text-[8px] font-bold text-gray-500 uppercase">{lead.hasWebsite ? 'POSSUI' : 'NÃO TEM'}</span>
                      </div>
                    </div>

                    <div className="space-y-4 mb-6">
                      {lead.phone && (
                        <div className="flex items-center gap-3 bg-black/50 p-3 rounded-lg border border-white/5 group/phone hover:border-[#00f3ff]/30 transition-all">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#00f3ff]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          <span className="text-xs font-black text-white group-hover/phone:text-[#00f3ff] transition-colors">{lead.phone}</span>
                        </div>
                      )}
                      <p className="text-[10px] text-gray-500 italic border-l border-white/10 pl-3 line-clamp-3 leading-relaxed min-h-[3rem]">{lead.bio || "Sem descrição disponível no perfil."}</p>
                    </div>

                    <div className="flex gap-2">
                      {lead.hasInstagram && lead.profileLink && (
                        <a href={lead.profileLink} target="_blank" rel="noopener noreferrer" className="flex-1 bg-white/5 border border-white/10 py-2 rounded text-[9px] font-black text-center text-white hover:bg-[#bc00ff] hover:text-black transition-all uppercase tracking-widest">Instagram</a>
                      )}
                      <a 
                        href={`https://wa.me/${lead.phone?.replace(/\D/g, '') || ''}`} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className={`flex-1 ${lead.hasWebsite ? 'bg-white/5 text-gray-500 border-white/5' : 'bg-[#00f3ff]/20 border-[#00f3ff]/30 text-[#00f3ff] hover:bg-[#00f3ff] hover:text-black'} border py-2 rounded text-[9px] font-black text-center transition-all uppercase tracking-widest`}
                      >
                        {lead.hasWebsite ? 'Ver Site' : 'Ofertar Site'}
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-24 text-gray-700 font-orbitron text-[10px] tracking-[0.5em] uppercase opacity-40 border border-dashed border-white/10 rounded-3xl animate-pulse">
              Sistema em stand-by. Digite os termos e inicie a varredura.
            </div>
          )}

          {activeTab === 'EXPLORE' && sources.length > 0 && (
            <div className="bg-black/40 border border-white/5 p-6 rounded-xl mt-12">
              <h4 className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-4">FONTES DE DADOS ORIGINAIS:</h4>
              <div className="flex flex-wrap gap-4">
                {sources.slice(0, 5).map((s, i) => (
                  <a key={i} href={s.uri} target="_blank" rel="noopener noreferrer" className="text-[9px] text-gray-500 hover:text-[#00f3ff] truncate max-w-xs transition-colors">
                    [{i+1}] {s.title}
                  </a>
                ))}
              </div>
            </div>
          )}
        </section>

        {status === AppStatus.ERROR && (
          <div className="bg-red-950/20 border border-red-500/40 rounded-2xl p-10 text-center max-w-2xl mx-auto shadow-[0_0_40px_rgba(255,0,0,0.15)]">
            <div className="mb-6 inline-flex p-4 bg-red-500/10 rounded-full">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            <h4 className="font-orbitron font-black text-red-500 text-2xl mb-4 italic tracking-tighter uppercase underline decoration-2 underline-offset-8">Varredura Interrompida</h4>
            <p className="text-sm text-red-400 font-bold uppercase tracking-widest mb-8 leading-relaxed max-w-md mx-auto">{error}</p>
            <div className="flex flex-col md:flex-row gap-4 justify-center">
               <button onClick={() => setStatus(AppStatus.IDLE)} className="text-[10px] font-black bg-red-500 text-black px-12 py-4 rounded shadow-[0_0_20px_rgba(255,0,0,0.3)] hover:bg-red-400 transition-all uppercase tracking-widest">Recalibrar Filtros</button>
               <button onClick={handleSearch} className="text-[10px] font-black border border-red-500/50 text-red-500 px-12 py-4 rounded hover:bg-red-500/10 transition-all uppercase tracking-widest">Forçar Reinício</button>
            </div>
          </div>
        )}
      </main>

      <footer className="w-full bg-[#05050a] border-t border-white/5 py-12 px-6 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-10 opacity-30">
          <div className="flex items-center gap-4">
            <img src="https://i.imgur.com/XCTkJN0.png" alt="TECHVIEW" className="h-8" />
            <div className="h-6 w-[1px] bg-white/20"></div>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.3em]">Lead Miner System</span>
          </div>
          <div className="text-[9px] font-bold text-gray-600 tracking-widest uppercase flex gap-10">
            <span>ENGINE: GEMINI-3-FLASH-ULTRA</span>
            <span>SEARCH: GROUNDING V4.0</span>
            <span>DATA: REALTIME CLOUD</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
