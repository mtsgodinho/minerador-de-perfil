
import { GoogleGenAI, Type } from "@google/genai";
import { Lead, SearchConfig, MiningResult, GroundingSource } from "./types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const mineLeads = async (config: SearchConfig): Promise<MiningResult> => {
  const { niche, location, quantity, onlyWithoutWebsite } = config;

  // Prompt otimizado para evitar perfis "quebrados" ou indisponíveis
  const prompt = `
    INSTRUÇÃO DE MINERAÇÃO DE ALTA PRECISÃO:
    Localize ${quantity} perfis profissionais REAIS no Instagram para o nicho "${niche}" em "${location}".
    
    CRITÉRIOS OBRIGATÓRIOS:
    1. PADRÃO DE NOME: O nome do perfil deve seguir o formato "Nome | Profissão" ou similar (ex: "Dr. João Silva | Dentista").
    2. VALIDAÇÃO DE URL: Certifique-se de que a URL extraída é o link direto do perfil (instagram.com/usuario/) e que o perfil está ATIVO.
    3. STATUS DO PERFIL: Priorize perfis com bios profissionais que mencionem serviços ou agendamentos.
    4. SITE: Classifique 'hasWebsite' como false se o perfil NÃO possuir um link de site próprio (ex: domínios .com, .br). Se usar Linktree ou WhatsApp, marque como false.
    
    SCHEMA DE RESPOSTA (JSON):
    Retorne um objeto 'leads' contendo:
    - name: String (Ex: "Mateus Godinho | Barbeiro")
    - username: String (Ex: "mateusgodinho")
    - profileLink: String (URL completa: https://www.instagram.com/username/)
    - followers: String (Ex: "5k")
    - bio: String (Bio real do perfil)
    - location: String (Localização confirmada)
    - hasWebsite: Boolean (True se tiver site próprio, False se não tiver)

    FOCO: QUALIDADE E VERACIDADE. Retorne apenas perfis que você confirmou através dos resultados da busca.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
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
                  username: { type: Type.STRING },
                  profileLink: { type: Type.STRING },
                  followers: { type: Type.STRING },
                  bio: { type: Type.STRING },
                  location: { type: Type.STRING },
                  hasWebsite: { type: Type.BOOLEAN }
                },
                required: ["name", "username", "profileLink"]
              }
            }
          }
        }
      }
    });

    const resultText = response.text;
    if (!resultText) throw new Error("O motor de busca não retornou dados válidos.");

    const data = JSON.parse(resultText);
    let leads: Lead[] = data.leads || [];

    if (onlyWithoutWebsite) {
      leads = leads.filter(l => !l.hasWebsite);
    }

    const processedLeads: Lead[] = leads.map((l: any, idx: number) => ({
      ...l,
      id: `lead-real-${Date.now()}-${idx}`,
      niche: niche
    }));

    const sources: GroundingSource[] = response.candidates?.[0]?.groundingMetadata?.groundingChunks
      ?.map((chunk: any) => ({
        title: chunk.web?.title || "Instagram Result",
        uri: chunk.web?.uri || ""
      }))
      .filter((s: any) => s.uri !== "") || [];

    return {
      leads: processedLeads,
      sources: sources
    };
  } catch (error: any) {
    console.error("Erro na busca real:", error);
    throw new Error("Erro ao minerar dados reais. Tente ajustar os termos de busca ou a localização.");
  }
};
