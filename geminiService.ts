
import { GoogleGenAI, Type } from "@google/genai";
import { Lead, SearchConfig, MiningResult, GroundingSource } from "./types";

/**
 * Função que utiliza a API do Gemini com Google Search Grounding para minerar perfis reais do Instagram.
 */
export const mineLeads = async (config: SearchConfig): Promise<MiningResult> => {
  const { niche, location, quantity, onlyWithoutWebsite } = config;

  // Criamos a instância logo antes da chamada para garantir que pegue a chave mais atual do seletor.
  // API key is handled externally via process.env.API_KEY.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // O modelo 'gemini-3-pro-image-preview' é obrigatório para usar a ferramenta googleSearch
  const modelName = 'gemini-3-pro-image-preview';

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

    // Fix: Clean citations like [1], [2] that Google Search Grounding might inject into the JSON text
    // The library returns text as a property, not a method.
    let resultText = response.text || '';
    resultText = resultText.replace(/\[\d+\]/g, '').trim();
    
    // Attempt to extract JSON if there's any surrounding text mixed with grounding citations
    const jsonMatch = resultText.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (jsonMatch) {
      resultText = jsonMatch[0];
    }

    if (!resultText) {
      throw new Error("O modelo não retornou dados. Tente uma busca mais específica ou verifique sua chave API.");
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

    // Fix: Correct extraction of grounding sources following the library response structure.
    // Grounding URLs MUST be extracted and displayed as per guidelines.
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
    
    // Tratamento específico para erro de chave ausente no Pro como exigido pelas diretrizes.
    if (error.message?.includes("Requested entity was not found")) {
      throw new Error("Chave API inválida ou não encontrada. Por favor, clique em 'Configurar Chave API' e selecione um projeto faturável.");
    }
    
    throw new Error(`Erro na engine de mineração: ${error.message}`);
  }
};
