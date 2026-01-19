
import { GoogleGenAI, Type } from "@google/genai";
import { Lead, SearchConfig, MiningResult, GroundingSource } from "./types";

/**
 * Função que utiliza a API do Gemini com Google Search Grounding para minerar perfis reais do Instagram.
 */
export const mineLeads = async (config: SearchConfig): Promise<MiningResult> => {
  const { niche, location, quantity, onlyWithoutWebsite } = config;

  // Criamos a instância logo antes da chamada para garantir que pegue a chave mais atual do seletor.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Use 'gemini-3-pro-preview' for complex text reasoning and structured JSON output.
  // This model supports googleSearch grounding and responseSchema simultaneously.
  const modelName = 'gemini-3-pro-preview';

  const systemInstruction = `
    Você é um agente especializado em pesquisa de perfis públicos reais do Instagram.
    Sua tarefa é retornar uma lista de perfis REAIS, EXISTENTES e PÚBLICOS do Instagram, com base nos parâmetros do usuário.

    ### REGRAS OBRIGATÓRIAS
    - Retorne APENAS perfis reais e públicos do Instagram.
    - NÃO invente usernames, nomes ou links.
    - NÃO gere exemplos fictícios.
    - Priorize profissionais autônomos ou pequenos negócios locais.
    - Use a ferramenta googleSearch para validar a existência dos perfis antes de listá-los.
    - O campo "hasWebsite" deve ser true somente se o profissional tiver um site oficial próprio (ex: .com.br). Linktree/Instagram direto contam como false.
    - Retorne estritamente um JSON válido seguindo o esquema solicitado.
  `;

  const prompt = `Encontre ${quantity} perfis REAIS do Instagram para o nicho "${niche}" na cidade de "${location}". 
  Foque em profissionais que ${onlyWithoutWebsite ? "não pareçam ter um site profissional próprio ainda" : "atuem no setor"}.`;

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
                  name: { type: Type.STRING },
                  username: { type: Type.STRING },
                  profileLink: { type: Type.STRING },
                  bio: { type: Type.STRING },
                  location: { type: Type.STRING },
                  hasWebsite: { type: Type.BOOLEAN },
                  websiteUrl: { type: Type.STRING, nullable: true },
                  phone: { type: Type.STRING, nullable: true },
                  followers: { type: Type.STRING, nullable: true }
                },
                required: ["name", "username", "profileLink", "bio", "location", "hasWebsite"]
              }
            }
          }
        }
      }
    });

    // Access text property directly (not as a method)
    let resultText = response.text || '';
    
    // Remove grounding citations [1], [2] etc that might be present in the output
    resultText = resultText.replace(/\[\d+\]/g, '');
    
    // Clean potential markdown blocks
    resultText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    // Ensure we extract only the JSON object part
    const firstBrace = resultText.indexOf('{');
    const lastBrace = resultText.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      resultText = resultText.substring(firstBrace, lastBrace + 1);
    }

    if (!resultText) {
      throw new Error("A IA não gerou uma resposta válida para os termos pesquisados.");
    }

    const data = JSON.parse(resultText);
    let leads: Lead[] = (data.leads || []).map((l: any, idx: number) => ({
      ...l,
      id: `lead-${Date.now()}-${idx}`,
      niche: niche,
      hasInstagram: true
    }));

    if (onlyWithoutWebsite) {
      leads = leads.filter(l => !l.hasWebsite);
    }

    // Extract grounding sources as required when using googleSearch tool
    const sources: GroundingSource[] = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => ({
      title: chunk.web?.title || "Referência Web",
      uri: chunk.web?.uri || ""
    })).filter((s: any) => s.uri) || [];

    return {
      leads,
      sources
    };
  } catch (error: any) {
    console.error("Critical Mining Failure:", error);
    
    if (error.message?.includes("Requested entity was not found") || error.message?.includes("API key")) {
      throw new Error("A Chave API selecionada expirou ou não tem créditos para o modelo Pro. Reconfigure sua chave.");
    }
    
    throw new Error(`A varredura falhou: ${error.message}`);
  }
};
