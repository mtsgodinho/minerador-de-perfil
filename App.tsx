
import React, { useState, useCallback, useRef, useMemo } from 'react';
import { AppStatus, Lead, SearchConfig, GroundingSource } from './types';
import { mineLeads } from './geminiService';

const App: React.FC = () => {
  const [config, setConfig] = useState<SearchConfig>({
    niche: 'Cirurgião Dentista',
    location: 'São Paulo',
    quantity: 5,
    onlyWithoutWebsite: true
  });
  const [leads, setLeads] = useState<Lead[]>([]);
  const [sources, setSources] = useState<GroundingSource[]>([]);
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const progressIntervalRef = useRef<number | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (config.quantity <= 0) return;

    setStatus(AppStatus.SEARCHING);
    setError(null);
    setProgress(0);
    setLeads([]);
    setSources([]);

    // Tempo estimado para busca real com grounding (mais lento que mock)
    const duration = 8000; 
    const startTime = Date.now();

    if (progressIntervalRef.current) window.clearInterval(progressIntervalRef.current);
    
    progressIntervalRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startTime;
      const calculatedProgress = Math.min((elapsed / duration) * 100, 98);
      setProgress(calculatedProgress);
    }, 50);
    
    try {
      const result = await mineLeads(config);
      
      if (progressIntervalRef.current) {
        window.clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      
      if (result.leads.length === 0) {
        setError("Nenhum perfil real validado foi encontrado com os critérios atuais.");
        setStatus(AppStatus.ERROR);
      } else {
        setLeads(result.leads);
        setSources(result.sources);
        setProgress(100);
        setStatus(AppStatus.COMPLETED);
      }
    } catch (err: any) {
      setError(err.message || 'Falha crítica na mineração de dados reais.');
      setStatus(AppStatus.ERROR);
    }
  };

  const exportCSV = useCallback(() => {
    if (leads.length === 0) return;
    const headers = ['Nome', 'Username', 'Link', 'Seguidores', 'Bio', 'Localização', 'Tem Site'];
    const rows = leads.map(l => [
      `"${l.name}"`, `"${l.username}"`, `"${l.profileLink}"`, `"${l.followers}"`,
      `"${l.bio.replace(/"/g, '""').replace(/\n/g, ' ')}"`, `"${l.location}"`, l.hasWebsite ? 'Sim' : 'Não'
    ]);
    const csvContent = [headers, ...rows].map(e => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `LEADS_REAIS_${config.niche.toUpperCase().replace(/\s/g, '_')}.csv`);
    link.click();
  }, [leads, config.niche]);

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
            MINERADOR DE LEADS REAIS VIA GOOGLE SEARCH
          </p>
          <div className="flex flex-col items-center gap-1 mt-2">
            <div className="flex items-center gap-2">
              <span className="h-[1px] w-8 bg-[#bc00ff]/30"></span>
              <span className="text-[10px] font-bold text-[#bc00ff] uppercase tracking-[0.2em] opacity-90">Desenvolvido por Mateus Godinho</span>
              <span className="h-[1px] w-8 bg-[#bc00ff]/30"></span>
            </div>
          </div>
        </div>
      </header>

      <main className="w-full max-w-6xl px-4 pb-20 space-y-12">
        <section className="bg-[rgba(15,15,30,0.8)] border border-[rgba(0,243,255,0.2)] rounded-2xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-[#00f3ff]"></div>
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-[#bc00ff]"></div>
          
          <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 items-end">
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-[#00f3ff] tracking-widest ml-1">SETOR (EX: DENTISTA)</label>
              <input 
                type="text" 
                value={config.niche}
                onChange={e => setConfig({...config, niche: e.target.value})}
                className="w-full terminal-input px-4 py-3 rounded-md transition duration-300"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-[#00f3ff] tracking-widest ml-1">CIDADE / ESTADO</label>
              <input 
                type="text" 
                value={config.location}
                onChange={e => setConfig({...config, location: e.target.value})}
                className="w-full terminal-input px-4 py-3 rounded-md transition duration-300"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-[#00f3ff] tracking-widest ml-1">QUANTIDADE</label>
              <input 
                type="number"
                min="1" max="20"
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
                <span className="text-[10px] font-bold text-gray-400 group-hover:text-[#00f3ff] tracking-tighter uppercase">FILTRAR SEM SITE</span>
              </label>
              <button 
                type="submit"
                disabled={status === AppStatus.SEARCHING}
                className="w-full neon-button py-3 rounded-md font-bold text-sm shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {status === AppStatus.SEARCHING ? 'MINERANDO REAL...' : 'MINERAR LEADS REAIS'}
              </button>
            </div>
          </form>
        </section>

        {status === AppStatus.SEARCHING && (
          <div className="bg-[#0a0a1a] border border-[#00f3ff] rounded-xl p-10 text-center space-y-8 animate-pulse shadow-[0_0_50px_rgba(0,243,255,0.1)]">
            <div className="max-w-xl mx-auto space-y-6">
              <div className="flex justify-between items-end font-orbitron">
                <p className="text-[#00f3ff] text-xl font-black italic">SEARCH GROUNDING ATIVO</p>
                <p className="text-[#00f3ff] text-2xl font-bold">{Math.round(progress)}%</p>
              </div>
              <div className="w-full bg-gray-900/50 h-3 rounded-full overflow-hidden border border-[rgba(0,243,255,0.2)]">
                <div 
                  className="bg-gradient-to-r from-[#00f3ff] to-[#bc00ff] h-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <div className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em]">
                CONSULTANDO GOOGLE E VALIDANDO PERFIS NO INSTAGRAM...
              </div>
            </div>
          </div>
        )}

        {leads.length > 0 && status !== AppStatus.SEARCHING && (
          <section className="space-y-8 animate-in fade-in slide-in-from-bottom-10 duration-700">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-1 bg-[#00f3ff] shadow-[0_0_10px_#00f3ff]"></div>
                <div>
                  <h2 className="font-orbitron text-2xl font-black text-white italic tracking-tighter uppercase">
                    LEADS <span className="text-[#00f3ff]">VERIFICADOS</span>
                  </h2>
                  <p className="text-gray-500 text-[10px] uppercase font-bold tracking-widest">{leads.length} RESULTADOS REAIS</p>
                </div>
              </div>
              <button 
                onClick={exportCSV}
                className="bg-white/5 border border-white/20 px-10 py-3 rounded-full font-orbitron text-[10px] font-black text-white tracking-[0.2em] hover:bg-[#00f3ff] hover:text-black transition-all shadow-xl"
              >
                BAIXAR CSV REAIS
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {leads.map((lead) => (
                <div key={lead.id} className="lead-card border border-white/10 rounded-xl p-6 relative group overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-1 bg-gradient-to-l from-[#00f3ff] to-transparent"></div>
                  
                  <div className="mb-4">
                    <h3 className="text-[#00f3ff] font-orbitron font-bold text-lg leading-tight mb-1 group-hover:neon-text transition-all duration-300">
                      {lead.name}
                    </h3>
                  </div>

                  <div className="space-y-4 mb-6">
                    <div className="text-xs text-gray-400 flex items-center gap-2">
                      <span className="font-bold text-[#bc00ff] uppercase text-[9px]">User:</span>
                      <a href={lead.profileLink} target="_blank" rel="noopener noreferrer" className="hover:text-[#00f3ff] underline break-all">@{lead.username}</a>
                    </div>
                    <div className="text-[10px] text-gray-400 border-l-2 border-[#bc00ff]/30 pl-3 italic h-14 overflow-hidden leading-relaxed">
                      {lead.bio}
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-white/10 pt-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${lead.hasWebsite ? 'bg-green-500' : 'bg-red-500 animate-pulse shadow-[0_0_8px_red]'}`}></div>
                      <span className="text-[9px] font-black uppercase text-gray-400">
                        {lead.hasWebsite ? 'TEM SITE' : 'SEM SITE'}
                      </span>
                    </div>
                    <a 
                      href={lead.profileLink} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-[10px] font-orbitron font-bold text-[#00f3ff] hover:tracking-widest transition-all bg-[#00f3ff]/10 px-3 py-1 rounded border border-[#00f3ff]/20"
                    >
                      ABRIR PERFIL
                    </a>
                  </div>
                </div>
              ))}
            </div>

            {/* Fontes Reais de Pesquisa */}
            {sources.length > 0 && (
              <div className="bg-black/40 border border-white/5 p-6 rounded-xl mt-12">
                <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">FONTES DE DADOS GOOGLE:</h4>
                <div className="flex flex-wrap gap-4">
                  {sources.slice(0, 3).map((s, i) => (
                    <a key={i} href={s.uri} target="_blank" rel="noopener noreferrer" className="text-[9px] text-[#00f3ff]/50 hover:text-[#00f3ff] truncate max-w-xs">
                      [{i+1}] {s.title}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {status === AppStatus.ERROR && (
          <div className="bg-red-950/20 border border-red-500/50 rounded-xl p-8 text-center text-red-400 max-w-xl mx-auto">
            <p className="font-orbitron font-black text-xl mb-2 italic">ERRO DE MINERAÇÃO REAL</p>
            <p className="text-xs uppercase tracking-widest">{error}</p>
            <button onClick={() => setStatus(AppStatus.IDLE)} className="mt-8 text-[10px] font-orbitron font-black bg-red-500 text-black px-10 py-3 rounded shadow-lg hover:bg-red-400 transition">TENTAR NOVAMENTE</button>
          </div>
        )}
      </main>

      <footer className="w-full bg-[#05050a] border-t border-white/5 py-12 px-6 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex flex-col items-center md:items-start">
            <img src="https://i.imgur.com/XCTkJN0.png" alt="TECHVIEW" className="h-8 opacity-40" />
            <p className="mt-2 text-[9px] font-bold text-gray-700 tracking-[0.3em] uppercase">SISTEMA OPERACIONAL V5.0 // DADOS REAIS</p>
          </div>
          <div className="text-[10px] font-bold text-gray-600 tracking-widest uppercase flex gap-10">
            <span>MODO: GROUNDING_REAL_TIME</span>
            <span>STATUS: OPERACIONAL</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
