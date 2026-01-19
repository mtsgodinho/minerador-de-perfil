
import { Lead, SearchConfig, MiningResult, GroundingSource } from "./types";

/**
 * Função simulada para evitar erros de deploy e validar a interface.
 * Em produção, esta função deve chamar a API do Gemini.
 */
export const mineLeads = async (config: SearchConfig): Promise<MiningResult> => {
  const { niche, location, quantity, onlyWithoutWebsite } = config;

  // Simula delay de rede e processamento da IA
  await new Promise(resolve => setTimeout(resolve, 2500));

  // Gerador de leads mockados baseados nos inputs do usuário
  const mockLeads: Lead[] = Array.from({ length: quantity }).map((_, i) => {
    const hasWebsite = Math.random() > 0.7; // 30% de chance de ter site
    const name = `Dr(a). ${["Lucas", "Mariana", "Roberto", "Ana", "Carlos", "Beatriz"][i % 6]} ${["Silva", "Santos", "Oliveira", "Costa"][i % 4]}`;
    const user = `${niche.toLowerCase().replace(/\s/g, '_')}_${i + 100}`;

    return {
      id: `mock-${Date.now()}-${i}`,
      name: name,
      username: `@${user}`,
      profileLink: `https://www.instagram.com/${user}/`,
      hasInstagram: true,
      hasWebsite: hasWebsite,
      websiteUrl: hasWebsite ? `https://www.clinica${user}.com.br` : undefined,
      phone: `(11) 9${Math.floor(10000000 + Math.random() * 90000000)}`,
      location: `${location} - SP`,
      bio: `Especialista em ${niche}. Atendimento humanizado e tecnologia de ponta para sua saúde.`,
      niche: niche
    };
  });

  // Filtra se o usuário solicitou apenas sem site
  const filteredLeads = onlyWithoutWebsite 
    ? mockLeads.filter(l => !l.hasWebsite) 
    : mockLeads;

  const mockSources: GroundingSource[] = [
    { title: `Google Search: ${niche} em ${location}`, uri: "https://google.com" },
    { title: "Instagram Business Directory", uri: "https://instagram.com" }
  ];

  return {
    leads: filteredLeads,
    sources: mockSources
  };
};
