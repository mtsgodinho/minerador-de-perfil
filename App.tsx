
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { AppStatus, Lead, SearchConfig, GroundingSource, TabType } from './types';
import { mineLeads } from './geminiService';

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    // Removed readonly to avoid "identical modifiers" error with potential existing declarations
    aistudio: AIStudio;
  }
}

const App: React.FC = () => {
  const [config, setConfig] = useState<SearchConfig>({
    niche: 'Dentista',
    location: 'São Paulo',
    quantity: 10,
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
      if (window.aistudio) {
        await window.aistudio.openSelectKey();
        setError(null);
      }
    } catch (err) {
      console.error("Erro ao abrir seletor de chaves:", err);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === AppStatus.SEARCHING) return;

    // Resetar UI antes de começar
    setError(null);
    setLeads([]);
    setSources([]);
    setProgress(0);
    setStatus(AppStatus.SEARCHING);
    setActiveTab('EXPLORE');

    try {
      // Verificar se a chave foi selecionada (obrigatório para Gemini Pro)
      // Adicionamos um fallback caso window.aistudio não esteja disponível momentaneamente
      let hasKey = false;
      if (window.aistudio) {
        hasKey = await window.aistudio.hasSelectedApiKey();
      } else {
        // Se aistudio não existe, provavelmente estamos em ambiente sem suporte a chave dinâmica
        hasKey = !!process.env.API_KEY;
      }

      if (!hasKey) {
        setError("Nenhuma chave API detectada. Clique no botão de configuração acima para autorizar o uso do modelo Pro.");
        setStatus(AppStatus.ERROR);
        return;
      }

      // Iniciar animação de progresso
      const duration = 20000; 
      const startTime = Date.now();
      if (progressIntervalRef.current) window.clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = window.setInterval(() => {
        const elapsed = Date.now() - startTime;
        const calculatedProgress = Math.min((elapsed / duration) * 100, 98);
        setProgress(calculatedProgress);
      }, 100);
      
      const result = await mineLeads(config);
      
      if (progressIntervalRef.current) window.clearInterval(progressIntervalRef.current);
      
      if (!result.leads || result.leads.length === 0) {
        setError("A busca retornou zero resultados. Tente ser mais genérico no nicho ou mudar a localização.");
        setStatus(AppStatus.ERROR);
      } else {
        setLeads(result.leads);
        setSources(result.sources);
        setProgress(100);
        setStatus(AppStatus.COMPLETED);
      }
    } catch (err: any) {
      if (progressIntervalRef.current) window.clearInterval(progressIntervalRef.current);
      console.error("Search Handler Error:", err);
      setError(err.message || 'Erro inesperado na operação.');
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
    const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
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
          <p className="font-orbitron text-[10px] tracking-[0.5em] text-[#00f3ff] opacity-80 uppercase text-center">Ultra Miner Pro v7.1 | Grounding Ativo</p>
          <button 
            type="button"
            onClick={handleOpenKeySelector}
            className="mt-2 bg-[#bc00ff]/10 border border-[#bc00ff]/50 text-[#bc00ff] text-[9px] font-bold px-4 py-1 rounded hover:bg-[#bc00ff] hover:text-white transition-all uppercase tracking-widest shadow-[0_0_10px_rgba(188,0,255,0.2)]"
          >
            Configurar Chave API (Pago)
          </button>
        </div>
      </header>

      <main className="w-full max-w-6xl px-4 pb-20 space-y-8">
        <section className="bg-[#0a0a14]/80 backdrop-blur-xl border border-[#00f3ff]/20 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-3">
            <span className="text-[8px] font-bold text-[#00f3ff]/40 animate-pulse font-orbitron">GEMINI-3-PRO-SEARCH-ENGINE</span>
          </div>
          <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-end">
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-[#00f3ff] tracking-widest ml-1">Nicho / Profissão</label>
              <input type="text" value={config.niche} onChange={e => setConfig({...config, niche: e.target.value})} className="w-full terminal-input px-4 py-3 rounded-md text-sm outline-none focus:border-[#00f3ff] transition-colors" placeholder="Ex: Dentista" required />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-[#00f3ff] tracking-widest ml-1">Localização</label>
              <input type="text" value={config.location} onChange={e => setConfig({...config, location: e.target.value})} className="w-full terminal-input px-4 py-3 rounded-md text-sm outline-none focus:border-[#00f3ff] transition-colors" placeholder="Ex: Curitiba" required />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-[#00f3ff] tracking-widest ml-1">Qtd. Alvo</label>
              <input type="number" min="1" max="100" value={config.quantity} onChange={e => setConfig({...config, quantity: Number(e.target.value)})} className="w-full terminal-input px-4 py-3 rounded-md text-sm outline-none focus:border-[#00f3ff] transition-colors" required />
            </div>
            <div className="space-y-4">
              <label className="flex items-center gap-2 cursor-pointer text-[10px] uppercase text-gray-400 font-bold hover:text-white transition-colors">
                <input type="checkbox" checked={config.onlyWithoutWebsite} onChange={e => setConfig({...config, onlyWithoutWebsite: e.target.checked})} className="w-4 h-4 rounded border-[#00f3ff] bg-black accent-[#00f3ff]" />
                Somente Sem Site
              </label>
              <button 
                type="submit"
                disabled={status === AppStatus.SEARCHING} 
                className={`w-full neon-button py-3 rounded-md font-bold text-xs shadow-lg flex items-center justify-center gap-2 ${status === AppStatus.SEARCHING ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-95'}`}
              >
                {status === AppStatus.SEARCHING ? (
                  <>
                    <div className="w-3 h-3 border-2 border-t-transparent border-current rounded-full animate-spin"></div>
                    MINERANDO...
                  </>
                ) : 'INICIAR MINERAÇÃO'}
              </button>
            </div>
          </form>
        </section>

        {status === AppStatus.SEARCHING && (
          <div className="bg-[#0a0a1a] border border-[#00f3ff]/40 rounded-xl p-10 text-center space-y-6 shadow-[0_0_40px_rgba(0,243,255,0.15)] animate-pulse-slow">
            <div className="flex justify-between font-orbitron text-[#00f3ff] text-[10px] tracking-widest">
              <span>SCANNING GLOBAL WEB NODES...</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-black h-2 rounded-full overflow-hidden border border-white/5">
              <div className="bg-gradient-to-r from-[#00f3ff] via-[#bc00ff] to-[#00f3ff] h-full transition-all duration-300 shadow-[0_0_20px_#00f3ff] bg-[length:200%_100%] animate-gradient-move" style={{ width: `${progress}%` }}></div>
            </div>
            <div className="flex flex-col items-center gap-1">
              <p className="text-[10px] text-gray-400 uppercase tracking-widest">Identificando perfis públicos no Instagram via Grounding...</p>
              <p className="text-[8px] text-gray-600 uppercase">Isso pode levar até 40 segundos para validar perfis reais.</p>
            </div>
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-4 justify-between items-center border-b border-white/5 pb-2">
          <div className="flex gap-4">
            <button onClick={() => setActiveTab('EXPLORE')} className={`font-orbitron text-[10px] tracking-widest px-4 py-2 transition-all border-b-2 ${activeTab === 'EXPLORE' ? 'text-[#00f3ff] border-[#00f3ff]' : 'text-gray-500 border-transparent hover:text-white'}`}>LEADS ENCONTRADOS ({leads.length})</button>
            <button onClick={() => setActiveTab('FAVORITES')} className={`font-orbitron text-[10px] tracking-widest px-4 py-2 transition-all border-b-2 ${activeTab === 'FAVORITES' ? 'text-[#bc00ff] border-[#bc00ff]' : 'text-gray-500 border-transparent hover:text-white'}`}>SALVOS ({favorites.length})</button>
          </div>
          {(leads.length > 0 || favorites.length > 0) && (
            <button onClick={exportCSV} className="text-[10px] font-bold text-[#00f3ff] uppercase hover:underline flex items-center gap-1">
              <span>⬇</span> Exportar Lista (CSV)
            </button>
          )}
        </div>

        {sources.length > 0 && activeTab === 'EXPLORE' && (
          <div className="bg-black/60 border border-[#00f3ff]/10 rounded-lg p-5 space-y-3">
            <h5 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              Caminhos da Varredura (Google Search):
            </h5>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {sources.map((source, idx) => (
                <a key={idx} href={source.uri} target="_blank" rel="noopener noreferrer" className="text-[9px] text-[#00f3ff]/50 hover:text-[#00f3ff] transition-colors underline truncate max-w-[250px] font-mono">
                  {source.title}
                </a>
              ))}
            </div>
          </div>
        )}

        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {(activeTab === 'EXPLORE' ? leads : favorites).map((lead) => (
            <div key={lead.id} className="lead-card border border-white/5 rounded-xl p-6 flex flex-col group hover:border-[#00f3ff]/30 transition-all hover:translate-y-[-4px] shadow-lg">
              <div className="flex justify-between items-start mb-5">
                <div className="overflow-hidden">
                  <h3 className="text-white font-bold text-lg truncate group-hover:text-[#00f3ff] transition-colors">{lead.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="w-2 h-2 bg-[#00f3ff] rounded-full"></span>
                    <p className="text-[9px] text-[#00f3ff] uppercase font-bold tracking-widest">{lead.location}</p>
                  </div>
                </div>
                <button onClick={() => toggleFavorite(lead)} className={`transition-all p-2 rounded-full hover:bg-white/5 ${isFavorited(lead) ? 'text-[#bc00ff] scale-125 shadow-[0_0_15px_rgba(188,0,255,0.4)]' : 'text-gray-700 hover:text-[#bc00ff]'}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                </button>
              </div>

              <div className="space-y-4 flex-1">
                <div className="flex gap-2">
                  <div className={`flex-1 p-3 rounded-lg border text-center ${lead.hasInstagram ? 'border-green-500/20 bg-green-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
                    <p className="text-[8px] text-gray-500 font-bold uppercase mb-1">Perfil Insta</p>
                    <p className="text-[10px] font-bold text-white truncate">{lead.username ? `@${lead.username}` : (lead.hasInstagram ? 'VERIFICADO' : 'N/A')}</p>
                  </div>
                  <div className={`flex-1 p-3 rounded-lg border text-center ${lead.hasWebsite ? 'border-green-500/20 bg-green-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
                    <p className="text-[8px] text-gray-500 font-bold uppercase mb-1">Site Atual</p>
                    <p className="text-[10px] font-bold text-white">{lead.hasWebsite ? 'POSSUI' : 'SEM SITE'}</p>
                  </div>
                </div>
                {lead.phone && (
                   <p className="text-[11px] text-[#00f3ff] font-bold bg-[#00f3ff]/5 p-3 rounded-lg border border-[#00f3ff]/20 flex items-center justify-center gap-3">
                     <span className="text-lg">📱</span> {lead.phone}
                   </p>
                )}
                <p className="text-[10px] text-gray-400 italic line-clamp-3 leading-relaxed bg-black/20 p-3 rounded-lg min-h-[60px]">{lead.bio || "Bio não capturada. Analise via link direto."}</p>
              </div>

              <div className="flex gap-3 mt-6">
                {lead.profileLink ? (
                  <a href={lead.profileLink} target="_blank" rel="noopener noreferrer" className="flex-1 bg-white/5 border border-white/10 py-3 rounded-md text-[10px] font-bold text-center text-white hover:bg-[#bc00ff] hover:text-black transition-all uppercase tracking-widest shadow-md">Abrir Insta</a>
                ) : (
                  <div className="flex-1 bg-gray-900/50 py-3 rounded-md text-[10px] font-bold text-center text-gray-600 border border-white/5 uppercase italic">Link Off</div>
                )}
                <a href={lead.phone ? `https://wa.me/${lead.phone.replace(/\D/g, '')}` : `https://www.google.com/search?q=${encodeURIComponent(lead.name + " " + lead.location + " instagram")}`} target="_blank" rel="noopener noreferrer" className={`flex-1 ${lead.hasWebsite ? 'bg-white/5 text-gray-500 border-white/5 opacity-50' : 'bg-[#00f3ff]/10 text-[#00f3ff] border border-[#00f3ff]/30 shadow-[0_0_15px_rgba(0,243,255,0.1)]'} py-3 rounded-md text-[10px] font-bold text-center uppercase tracking-widest hover:bg-[#00f3ff] hover:text-black transition-all`}>
                  {lead.hasWebsite ? 'Ver Site' : 'Oportunidade'}
                </a>
              </div>
            </div>
          ))}
        </section>

        {status === AppStatus.ERROR && (
          <div className="bg-red-950/20 border border-red-500/30 rounded-2xl p-10 text-center space-y-6 shadow-2xl animate-shake">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">⚠️</span>
            </div>
            <h4 className="font-orbitron text-red-500 font-bold text-lg uppercase tracking-widest">Falha na Conexão Matrix</h4>
            <p className="text-sm text-red-300/80 max-w-md mx-auto">{error}</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button onClick={() => setStatus(AppStatus.IDLE)} className="bg-white/10 text-white px-8 py-3 rounded-md text-[11px] font-bold uppercase hover:bg-white/20 transition-all border border-white/10">Voltar</button>
              <button onClick={handleOpenKeySelector} className="bg-red-500 text-black px-8 py-3 rounded-md text-[11px] font-bold uppercase hover:bg-red-400 transition-all shadow-[0_0_20px_rgba(239,68,68,0.4)]">Reconfigurar Chave</button>
            </div>
          </div>
        )}
      </main>
      
      <style>{`
        @keyframes gradient-move { 0% { background-position: 0% 50%; } 100% { background-position: 200% 50%; } }
        .animate-gradient-move { animation: gradient-move 3s linear infinite; }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
        .animate-shake { animation: shake 0.3s ease-in-out 3; }
      `}</style>
    </div>
  );
};

export default App;
