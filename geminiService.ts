
import { GoogleGenAI, Type } from "@google/genai";
import { Lead, SearchConfig, MiningResult, GroundingSource } from "./types";

export const mineLeads = async (config: SearchConfig): Promise<MiningResult> => {
  const { niche, location, quantity, onlyWithoutWebsite } = config;

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    VOCÊ É UM AGENTE DE MINERAÇÃO DE DADOS DE ALTA PERFORMANCE.
    
    TAREFA: Localizar profissionais de: "${niche}" em "${location}".
    OBJETIVO: Retornar EXATAMENTE ${quantity} resultados distintos.
    
    INSTRUÇÕES RÍGIDAS DE DADOS:
    1. Pesquise no Google Search/Maps e identifique perfis reais.
    2. Instagram: Se o profissional tiver Instagram, forneça obrigatoriamente a URL completa (ex: https://www.instagram.com/nome_do_perfil/).
    3. Website: Marque hasWebsite como TRUE apenas se for um domínio profissional (.com, .com.br, .clinic, etc).
    4. Website: Marque hasWebsite como FALSE se for Linktree, Beacons, WhatsApp ou se não tiver site.
    
    RETORNE EM JSON COM ESTES CAMPOS:
    - name: Nome do Profissional
    - hasInstagram: booleano
    - username: Apenas o @ (ex: @joao_dentista)
    - profileLink: A URL completa do perfil (https://instagram.com/...)
    - hasWebsite: booleano
    - websiteUrl: URL do site ou null
    - phone: Telefone com DDD
    - location: Cidade/Bairro
    - bio: Resumo do perfil
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            leads: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  hasInstagram: { type: Type.BOOLEAN },
                  username: { type: Type.STRING },
                  profileLink: { type: Type.STRING },
                  hasWebsite: { type: Type.BOOLEAN },
                  websiteUrl: { type: Type.STRING },
                  phone: { type: Type.STRING },
                  location: { type: Type.STRING },
                  bio: { type: Type.STRING }
                },
                required: ["name", "hasInstagram", "hasWebsite", "location"]
              }
            }
          }
        }
      }
    });

    const resultText = response.text;
    if (!resultText) throw new Error("A IA não retornou dados estruturados.");

    const data = JSON.parse(resultText);
    let leads: Lead[] = data.leads || [];

    if (onlyWithoutWebsite) {
      leads = leads.filter(l => !l.hasWebsite);
    }

    const processedLeads: Lead[] = leads.map((l: any, idx: number) => {
      // Normalização do Link do Instagram
      let finalLink = l.profileLink;
      let cleanUser = l.username ? l.username.replace('@', '').trim() : '';

      // Se a IA mandou o link, garante que é absoluto
      if (finalLink && !finalLink.startsWith('http')) {
        finalLink = `https://www.instagram.com/${finalLink.replace(/^\//, '')}`;
      }
      
      // Se não tem link mas tem username, cria o link
      if (!finalLink && cleanUser) {
        finalLink = `https://www.instagram.com/${cleanUser}/`;
      }

      // Fallback radical: se diz que tem mas não tem link, usa o nome para gerar link (riscado mas funcional)
      if (l.hasInstagram && !finalLink) {
         finalLink = `https://www.instagram.com/reels/`; // Fallback genérico ou URL de busca
      }

      return {
        ...l,
        id: `lead-v8-${Date.now()}-${idx}`,
        niche: niche,
        username: cleanUser ? `@${cleanUser}` : undefined,
        profileLink: finalLink || undefined
      };
    });

    const sources: GroundingSource[] = response.candidates?.[0]?.groundingMetadata?.groundingChunks
      ?.map((chunk: any) => ({
        title: chunk.web?.title || "Resultado Google",
        uri: chunk.web?.uri || ""
      }))
      .filter((s: any) => s.uri !== "") || [];

    return {
      leads: processedLeads,
      sources: sources
    };
  } catch (error: any) {
    console.error("Mining Error:", error);
    throw new Error("Falha na varredura. Verifique os termos de busca.");
  }
};
