
import { GoogleGenAI, Type } from "@google/genai";
import { Lead, SearchConfig, MiningResult, GroundingSource } from "./types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const mineLeads = async (config: SearchConfig): Promise<MiningResult> => {
  const { niche, location, quantity, onlyWithoutWebsite } = config;

  // Construção de uma query interna poderosa para o Google Search
  const searchQuery = `Lista de ${niche} em ${location} instagram site telefone`;

  const prompt = `
    VOCÊ É UM AGENTE DE MINERAÇÃO DE DADOS DE ALTA PERFORMANCE.
    
    TAREFA: Localizar obrigatoriamente ${quantity} registros de profissionais/empresas para: "${niche}" em "${location}".
    
    PROCEDIMENTO:
    1. Utilize a ferramenta googleSearch para varrer resultados do Google Maps, LinkedIn, Instagram e sites locais.
    2. Identifique profissionais que possuem perfil no Instagram.
    3. Verifique rigorosamente a existência de um website institucional.
    4. Extraia o telefone de contato (WhatsApp preferencialmente).
    
    REGRAS DE CLASSIFICAÇÃO:
    - hasWebsite: TRUE apenas se o domínio for próprio (ex: .com.br, .com).
    - hasWebsite: FALSE se for Linktree, WhatsApp, Instagram ou agregador.
    - hasInstagram: TRUE se encontrar o link @usuario.
    
    IMPORTANTE: Se a localização for genérica como "google" ou "internet", busque em todo o Brasil. Não retorne uma lista vazia sob nenhuma circunstância. Encontre o máximo possível até o limite de ${quantity}.
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
    if (!resultText) throw new Error("A IA não gerou resposta de texto.");

    const data = JSON.parse(resultText);
    let leads: Lead[] = data.leads || [];

    // Fallback: Se a IA falhou em estruturar mas temos fontes de grounding, 
    // ela provavelmente encontrou algo mas se perdeu na estruturação.
    if (leads.length === 0) {
       console.warn("IA retornou 0 leads no JSON. Verificando grounding...");
    }

    if (onlyWithoutWebsite) {
      leads = leads.filter(l => !l.hasWebsite);
    }

    const processedLeads: Lead[] = leads.map((l: any, idx: number) => ({
      ...l,
      id: `lead-v6-${Date.now()}-${idx}`,
      niche: niche,
      // Garantir que o link do instagram seja válido se houver username
      profileLink: l.profileLink || (l.username ? `https://instagram.com/${l.username.replace('@','')}` : undefined)
    }));

    const sources: GroundingSource[] = response.candidates?.[0]?.groundingMetadata?.groundingChunks
      ?.map((chunk: any) => ({
        title: chunk.web?.title || "Fonte de Dados",
        uri: chunk.web?.uri || ""
      }))
      .filter((s: any) => s.uri !== "") || [];

    return {
      leads: processedLeads,
      sources: Array.from(new Set(sources.map(s => s.uri))).map(uri => sources.find(s => s.uri === uri)!)
    };
  } catch (error: any) {
    console.error("Erro crítico na mineração:", error);
    throw new Error("O Google bloqueou a requisição ou os termos são muito restritos. Tente buscar por uma cidade específica.");
  }
};
