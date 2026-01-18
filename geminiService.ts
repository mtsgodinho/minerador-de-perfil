
import { GoogleGenAI, Type } from "@google/genai";
import { Lead, SearchConfig, MiningResult, GroundingSource } from "./types";

export const mineLeads = async (config: SearchConfig): Promise<MiningResult> => {
  const { niche, location, quantity, onlyWithoutWebsite } = config;

  // Instanciação dentro da função conforme as diretrizes
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    VOCÊ É UM AGENTE DE MINERAÇÃO DE DADOS DE ALTA PERFORMANCE.
    
    TAREFA: Localizar obrigatoriamente ${quantity} registros de profissionais/empresas para: "${niche}" em "${location}".
    
    PROCEDIMENTO:
    1. Utilize a ferramenta googleSearch para varrer resultados do Google Maps, LinkedIn, Instagram e sites locais.
    2. Identifique profissionais que possuem perfil no Instagram.
    3. Verifique rigorosamente a existência de um website institucional (domínio próprio).
    4. Extraia o telefone de contato (WhatsApp preferencialmente).
    
    CRITÉRIO DE INSTAGRAM:
    - Se encontrar o @usuario ou o link instagram.com/usuario, extraia obrigatoriamente.
    - O campo profileLink deve ser a URL completa (https://www.instagram.com/usuario/).
    
    REGRAS DE CLASSIFICAÇÃO DE SITE:
    - hasWebsite: TRUE apenas se o domínio for próprio (ex: .com.br, .com).
    - hasWebsite: FALSE se for Linktree, WhatsApp, Instagram ou agregador.
    
    IMPORTANTE: Retorne um JSON válido com a lista de leads. Se encontrar menos que ${quantity}, retorne o que encontrar, mas não retorne vazio.
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
    if (!resultText) throw new Error("A IA não gerou resposta.");

    const data = JSON.parse(resultText);
    let leads: Lead[] = data.leads || [];

    if (onlyWithoutWebsite) {
      leads = leads.filter(l => !l.hasWebsite);
    }

    const processedLeads: Lead[] = leads.map((l: any, idx: number) => {
      // Garantir que o link do instagram seja absoluto e funcional
      let finalProfileLink = l.profileLink;
      const cleanUsername = l.username ? l.username.replace('@', '').trim() : '';
      
      if (!finalProfileLink && cleanUsername) {
        finalProfileLink = `https://www.instagram.com/${cleanUsername}/`;
      } else if (finalProfileLink && !finalProfileLink.startsWith('http')) {
        finalProfileLink = `https://www.instagram.com/${finalProfileLink.replace(/^\//, '')}`;
      }

      return {
        ...l,
        id: `lead-v7-${Date.now()}-${idx}`,
        niche: niche,
        username: cleanUsername,
        profileLink: finalProfileLink
      };
    });

    const sources: GroundingSource[] = response.candidates?.[0]?.groundingMetadata?.groundingChunks
      ?.map((chunk: any) => ({
        title: chunk.web?.title || "Fonte de Dados",
        uri: chunk.web?.uri || ""
      }))
      .filter((s: any) => s.uri !== "") || [];

    return {
      leads: processedLeads,
      sources: sources
    };
  } catch (error: any) {
    console.error("Erro na mineração:", error);
    throw new Error(error.message || "Erro crítico na mineração de dados.");
  }
};
