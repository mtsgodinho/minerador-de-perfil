
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { AppStatus, Lead, SearchConfig, GroundingSource, TabType } from './types';
import { mineLeads } from './geminiService';

// Fix: Use AIStudio interface and declare it globally with readonly modifier to match expected environment definition.
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    readonly aistudio: AIStudio;
  }
}

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

  const handleOpenKeySelector = async () => {
    try {
      await window.aistudio.openSelectKey();
      setError(null);
    } catch (err) {
      console.error("Erro ao abrir seletor de chaves:", err);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === AppStatus.SEARCHING) return;

    // Verificar se a chave foi selecionada (obrigatório para Gemini Pro)
    const hasKey = await window.aistudio.hasSelectedApiKey();
    if (!hasKey) {
      setError("Você precisa configurar uma Chave API paga para usar a mineração Pro. Clique no botão de configuração acima.");
      setStatus(AppStatus.ERROR);
      return;
    }

    setActiveTab('EXPLORE');
    setStatus(AppStatus.SEARCHING);
    setError(null);
    setProgress(0);
    setLeads([]);
    setSources([]);

    const duration = 25000; 
    const startTime = Date.now();

    if (progressIntervalRef.current) window.clearInterval(progressIntervalRef.current);
    
    progressIntervalRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startTime;
      const calculatedProgress = Math.min((elapsed / duration) * 100, 99);
      setProgress(calculatedProgress);
    }, 100);
    
    try {
      const result = await mineLeads(config);
      if (progressIntervalRef.current) window.clearInterval(progressIntervalRef.current);
      
      if (!result.leads || result.leads.length === 0) {
        setError("Nenhum profissional encontrado. Tente mudar os termos de busca ou a localização.");
        setStatus(AppStatus.ERROR);
      } else {
        setLeads(result.leads);
        setSources(result.sources);
        setProgress(100);
        setStatus(AppStatus.COMPLETED);
      }
    } catch (err: any) {
      if (progressIntervalRef.current) window.clearInterval(progressIntervalRef.current);
      setError(err.message || 'Erro crítico na mineração.');
      setStatus(AppStatus.ERROR);
    }
  };

  const toggleFavorite = (lead: Lead) => {
    setFavorites(prev => {
      const exists = prev.find(f => f.name === lead.name);
      return exists ? prev.filter(f => f.name !== lead.name) : [...prev, { ...lead, isFavorite: true }];
    });
  };

  const isFavorited = (lead: Lead) => favorites.some(f => f.name === lead.name);

  const exportCSV = useCallback(() => {
    const list = activeTab === 'EXPLORE' ? leads : favorites;
    if (list.length === 0) return;
    const headers = ['Nome', 'Instagram Link', 'WhatsApp', 'Site Atual', 'Localização'];
    const rows = list.map(l => [`"${l.name}"`, `"${l.profileLink || ''}"`, `"${l.phone || ''}"`, `"${l.websiteUrl || ''}"`, `"${l.location}"`]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads_${config.niche}_${Date.now()}.csv`;
    a.click();
  }, [leads, favorites, activeTab, config.niche]);

  return (
    <div className="min-h-screen flex flex-col items-center">
      <header className="w-full max-w-7xl px-6 py-10 flex flex-col items-center">
        <div className="relative group animate-flicker">
          <img src="https://i.imgur.com/XCTkJN0.png" alt="TECHVIEW" className="h-20 md:h-24 relative" />
        </div>
        <div className="mt-4 flex flex-col items-center gap-2">
          <p className="font-orbitron text-[10px] tracking-[0.5em] text-[#00f3ff] opacity-80 uppercase">Ultra Miner Pro v7.0 | Grounding Ativo</p>
          <button 
            onClick={handleOpenKeySelector}
            className="mt-2 bg-[#bc00ff]/10 border border-[#bc00ff]/50 text-[#bc00ff] text-[9px] font-bold px-4 py-1 rounded hover:bg-[#bc00ff] hover:text-white transition-all uppercase tracking-widest"
          >
            Configurar Chave API (Pago)
          </button>
        </div>
      </header>

      <main className="w-full max-w-6xl px-4 pb-20 space-y-8">
        <section className="bg-[#0a0a14] border border-[#00f3ff]/20 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-2">
            <span className="text-[8px] font-bold text-[#00f3ff]/30 animate-pulse">ENGINE: GEMINI-3-PRO + SEARCH</span>
          </div>
          <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-end">
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-[#00f3ff] tracking-widest">Nicho / Profissão</label>
              <input type="text" value={config.niche} onChange={e => setConfig({...config, niche: e.target.value})} className="w-full terminal-input px-4 py-2 rounded-md" placeholder="Ex: Dentista" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-[#00f3ff] tracking-widest">Localização</label>
              <input type="text" value={config.location} onChange={e => setConfig({...config, location: e.target.value})} className="w-full terminal-input px-4 py-2 rounded-md" placeholder="Ex: Curitiba" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-[#00f3ff] tracking-widest">Quantidade Meta</label>
              <input type="number" value={config.quantity} onChange={e => setConfig({...config, quantity: Number(e.target.value)})} className="w-full terminal-input px-4 py-2 rounded-md" />
            </div>
            <div className="space-y-4">
              <label className="flex items-center gap-2 cursor-pointer text-[10px] uppercase text-gray-400 font-bold">
                <input type="checkbox" checked={config.onlyWithoutWebsite} onChange={e => setConfig({...config, onlyWithoutWebsite: e.target.checked})} className="w-4 h-4 border-[#00f3ff] bg-black" />
                Filtrar apenas Sem Site
              </label>
              <button disabled={status === AppStatus.SEARCHING} className="w-full neon-button py-3 rounded-md font-bold text-xs">
                {status === AppStatus.SEARCHING ? 'EXECUTANDO VARREDURA PRO...' : 'INICIAR MINERAÇÃO'}
              </button>
            </div>
          </form>
        </section>

        {status === AppStatus.SEARCHING && (
          <div className="bg-[#0a0a1a] border border-[#00f3ff]/40 rounded-xl p-8 text-center space-y-4 shadow-[0_0_30px_rgba(0,243,255,0.1)]">
            <div className="flex justify-between font-orbitron text-[#00f3ff] text-xs">
              <span className="animate-pulse">MAPEANDO REDE MUNDIAL...</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-black h-1 rounded-full overflow-hidden">
              <div className="bg-gradient-to-r from-[#00f3ff] to-[#bc00ff] h-full transition-all duration-300 shadow-[0_0_15px_#00f3ff]" style={{ width: `${progress}%` }}></div>
            </div>
            <p className="text-[9px] text-gray-500 uppercase tracking-widest">A ferramenta Google Search está localizando perfis públicos reais agora.</p>
          </div>
        )}

        <div className="flex gap-4 border-b border-white/5 pb-2">
          <button onClick={() => setActiveTab('EXPLORE')} className={`font-orbitron text-[10px] tracking-widest px-4 py-2 transition-all ${activeTab === 'EXPLORE' ? 'text-[#00f3ff] border-b border-[#00f3ff]' : 'text-gray-500'}`}>LEADS ENCONTRADOS ({leads.length})</button>
          <button onClick={() => setActiveTab('FAVORITES')} className={`font-orbitron text-[10px] tracking-widest px-4 py-2 transition-all ${activeTab === 'FAVORITES' ? 'text-[#bc00ff] border-b border-[#bc00ff]' : 'text-gray-500'}`}>SALVOS ({favorites.length})</button>
          {(leads.length > 0 || favorites.length > 0) && (
            <button onClick={exportCSV} className="ml-auto text-[9px] font-bold text-[#00f3ff] uppercase hover:underline">Exportar CSV</button>
          )}
        </div>

        {/* Fix: Always extract the URLs from groundingChunks and list them on the web app when Google Search is used. */}
        {sources.length > 0 && activeTab === 'EXPLORE' && (
          <div className="bg-black/40 border border-[#00f3ff]/10 rounded-lg p-4 space-y-2">
            <h5 className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Fontes de Grounding (Google Search):</h5>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {sources.map((source, idx) => (
                <a key={idx} href={source.uri} target="_blank" rel="noopener noreferrer" className="text-[9px] text-[#00f3ff]/60 hover:text-[#00f3ff] transition-colors underline truncate max-w-[200px]">
                  {source.title}
                </a>
              ))}
            </div>
          </div>
        )}

        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {(activeTab === 'EXPLORE' ? leads : favorites).map((lead) => (
            <div key={lead.id} className="lead-card border border-white/5 rounded-xl p-5 flex flex-col group">
              <div className="flex justify-between items-start mb-4">
                <div className="overflow-hidden">
                  <h3 className="text-white font-bold text-base truncate group-hover:text-[#00f3ff] transition-colors">{lead.name}</h3>
                  <p className="text-[8px] text-[#00f3ff] uppercase font-bold tracking-widest">{lead.location}</p>
                </div>
                <button onClick={() => toggleFavorite(lead)} className={`transition-all ${isFavorited(lead) ? 'text-[#bc00ff] scale-110' : 'text-gray-700 hover:text-[#bc00ff]'}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                </button>
              </div>

              <div className="space-y-3 flex-1">
                <div className="flex gap-2">
                  <div className={`flex-1 p-2 rounded border text-center ${lead.hasInstagram ? 'border-green-900/30 bg-green-950/10' : 'border-red-900/30 bg-red-950/10'}`}>
                    <p className="text-[7px] text-gray-500 font-bold uppercase">Instagram</p>
                    <p className="text-[9px] font-bold text-white truncate">{lead.username ? `@${lead.username}` : (lead.hasInstagram ? 'LINK ATIVO' : 'N/A')}</p>
                  </div>
                  <div className={`flex-1 p-2 rounded border text-center ${lead.hasWebsite ? 'border-green-900/30 bg-green-950/10' : 'border-red-900/30 bg-red-950/10'}`}>
                    <p className="text-[7px] text-gray-500 font-bold uppercase">Website</p>
                    <p className="text-[9px] font-bold text-white">{lead.hasWebsite ? 'POSSUI' : 'NÃO TEM'}</p>
                  </div>
                </div>
                {lead.phone && <p className="text-[10px] text-[#00f3ff] font-bold bg-white/5 p-2 rounded border border-white/5 flex items-center gap-2"><span>📞</span> {lead.phone}</p>}
                <p className="text-[9px] text-gray-400 italic line-clamp-3 leading-relaxed">{lead.bio || "Perfis analisados via Grounding Search Engine."}</p>
              </div>

              <div className="flex gap-2 mt-4">
                {lead.profileLink ? (
                  <a href={lead.profileLink} target="_blank" rel="noopener noreferrer" className="flex-1 bg-white/5 border border-white/10 py-2 rounded text-[9px] font-bold text-center text-white hover:bg-[#bc00ff] hover:text-black transition-all uppercase tracking-widest">Abrir Insta</a>
                ) : (
                  <div className="flex-1 bg-gray-900/50 py-2 rounded text-[9px] font-bold text-center text-gray-600 border border-white/5 uppercase italic">Sem Perfil</div>
                )}
                <a href={lead.phone ? `https://wa.me/${lead.phone.replace(/\D/g, '')}` : `https://www.google.com/search?q=${encodeURIComponent(lead.name)}`} target="_blank" rel="noopener noreferrer" className={`flex-1 ${lead.hasWebsite ? 'bg-white/5 text-gray-500 border-white/5' : 'bg-[#00f3ff]/10 text-[#00f3ff] border border-[#00f3ff]/20'} py-2 rounded text-[9px] font-bold text-center uppercase tracking-widest hover:bg-[#00f3ff] hover:text-black transition-all`}>
                  {lead.hasWebsite ? 'Ver Site' : 'Ofertar Site'}
                </a>
              </div>
            </div>
          ))}
        </section>

        {status === AppStatus.ERROR && (
          <div className="bg-red-900/10 border border-red-500/30 rounded-xl p-8 text-center space-y-4">
            <h4 className="font-orbitron text-red-500 font-bold uppercase">Erro na Matriz Pro</h4>
            <p className="text-xs text-red-400/80">{error}</p>
            <div className="flex gap-4 justify-center">
              <button onClick={() => setStatus(AppStatus.IDLE)} className="bg-white/10 text-white px-6 py-2 rounded text-[10px] font-bold uppercase hover:bg-white/20 transition-all">Resetar</button>
              <button onClick={handleOpenKeySelector} className="bg-red-500 text-black px-6 py-2 rounded text-[10px] font-bold uppercase hover:bg-red-400 transition-all">Configurar Chave API</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
