
import { GoogleGenAI, Type } from "@google/genai";
import { Lead, SearchConfig, MiningResult, GroundingSource } from "./types";

/**
 * Função que utiliza a API do Gemini com Google Search Grounding para minerar perfis reais do Instagram.
 */
export const mineLeads = async (config: SearchConfig): Promise<MiningResult> => {
  const { niche, location, quantity, onlyWithoutWebsite } = config;

  if (!process.env.API_KEY) {
    throw new Error("API_KEY não configurada no ambiente. Adicione sua chave para minerar perfis reais.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const modelName = 'gemini-3-pro-preview';

  const systemInstruction = `
    Você é um agente especializado em pesquisa de perfis públicos reais do Instagram.
    Sua tarefa é retornar uma lista de perfis REAIS, EXISTENTES e PÚBLICOS do Instagram, com base nos parâmetros do usuário.

    ### REGRAS OBRIGATÓRIAS
    - Retorne APENAS perfis reais e públicos do Instagram.
    - NÃO invente usernames, nomes ou links.
    - NÃO gere exemplos fictícios.
    - Evite perfis corporativos gigantes; priorize profissionais autônomos ou pequenos negócios locais.
    - Use obrigatoriamente a ferramenta googleSearch para validar e encontrar os perfis.
    - Se encontrar perfis que usam Linktree ou Beacons no lugar de um site profissional próprio, considere-os como leads qualificados para venda de site.
  `;

  const prompt = `Localize exatamente ${quantity} perfis de Instagram para o nicho "${niche}" em "${location}". 
  ${onlyWithoutWebsite ? "Dê prioridade máxima para perfis que NÃO tenham site próprio oficial." : ""}`;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        systemInstruction,
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
                  name: { type: Type.STRING, description: "Nome visível no perfil" },
                  username: { type: Type.STRING, description: "Username do Instagram sem @" },
                  profileLink: { type: Type.STRING, description: "Link completo do perfil" },
                  bio: { type: Type.STRING, description: "Resumo ou Bio do perfil" },
                  location: { type: Type.STRING, description: "Localização se disponível" },
                  hasWebsite: { type: Type.BOOLEAN, description: "Se possui site profissional próprio" },
                  websiteUrl: { type: Type.STRING, nullable: true },
                  phone: { type: Type.STRING, nullable: true, description: "WhatsApp ou telefone extraído" },
                  followers: { type: Type.STRING, nullable: true }
                },
                required: ["name", "username", "profileLink", "bio", "location", "hasWebsite"]
              }
            }
          }
        }
      }
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("O modelo não retornou dados. Tente uma busca mais específica.");
    }

    const data = JSON.parse(resultText);
    let leads: Lead[] = (data.leads || []).map((l: any, idx: number) => ({
      ...l,
      id: `lead-real-${Date.now()}-${idx}`,
      niche: niche,
      hasInstagram: true
    }));

    if (onlyWithoutWebsite) {
      leads = leads.filter(l => !l.hasWebsite);
    }

    const sources: GroundingSource[] = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => ({
      title: chunk.web?.title || "Fonte da Busca",
      uri: chunk.web?.uri || ""
    })).filter((s: any) => s.uri) || [];

    return {
      leads,
      sources
    };
  } catch (error: any) {
    console.error("Mining error:", error);
    throw new Error(`Erro na engine de mineração: ${error.message}`);
  }
};
