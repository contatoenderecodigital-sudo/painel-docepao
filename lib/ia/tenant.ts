// ============================================================================
//  TENANT — carrega a persona + o cardápio (motor de orçamento) de um negócio
//  a partir do banco (negocios.config). É o que faz a IA falar com o cardápio
//  e as regras de CADA padaria. Sem cardápio no banco, cai no padrão (Doce Pão).
// ============================================================================

import { queryUm } from "../banco/db";
import { motorPadrao } from "./orcamento";
import { DOCE_PAO, type ConfigNegocio } from "./persona";
import { ehHojeBR } from "../aviso";
import type { Tenant } from "./cerebro";

type ConfigDB = {
  persona?: { horario?: string; prazoMinimoDias?: number; cobraSinal?: boolean };
  rendimento?: { salgado_por_pessoa?: number; doce_por_pessoa?: number; cento_serve_pessoas?: number };
  cardapio?: Record<string, { nome: string; preco: number }[]>;
  cerebro_texto?: string; // cérebro PRÓPRIO do tenant (não padaria): system prompt livre
  provedor_ia?: string; // 'claude' | 'openai' | 'gemini' (LLM deste tenant)
  modelo?: string; // ex: 'claude-haiku-4-5', 'gpt-4o-mini', 'gemini-2.5-flash'
  aviso_do_dia?: string;
  aviso_atualizado_em?: string;
};

export async function carregarTenant(negocioId: string): Promise<Tenant> {
  const n = await queryUm<{ nome: string; cidade: string | null; config: ConfigDB | null }>(
    "select nome, cidade, config from negocios where id = $1",
    [negocioId],
  );
  if (!n) return { persona: DOCE_PAO, motor: motorPadrao };

  const cfg = n.config || {};
  const persona: ConfigNegocio = {
    nome: n.nome,
    cidade: n.cidade || DOCE_PAO.cidade,
    horario: cfg.persona?.horario || DOCE_PAO.horario,
    endereco: DOCE_PAO.endereco,
    prazoMinimoDias: cfg.persona?.prazoMinimoDias ?? 2,
    cobraSinal: cfg.persona?.cobraSinal ?? false,
  };

  // Aviso do dia: só entra se foi escrito HOJE (senão expira sozinho).
  const avisoDoDia = ehHojeBR(cfg.aviso_atualizado_em) ? cfg.aviso_do_dia ?? null : null;

  // Se o tenant tem cérebro PRÓPRIO no config (cerebro_texto), ele não é padaria:
  // usa esse prompt e a IA responde com as ferramentas básicas (só passar pro
  // humano). É o que faz o WhatsApp da Endereço Digital (ou outro nicho) ter o
  // cérebro dele, sem herdar o cardápio da Doce Pão.
  const sistemaCustom = cfg.cerebro_texto?.trim() || null;

  // LLM escolhido por este tenant (senão cai na cadeia global de provedores).
  const provedorIa = cfg.provedor_ia?.trim().toLowerCase() || null;
  const modeloIa = cfg.modelo?.trim() || null;

  // Preço e rendimento vêm do catalogo.json (Doce Pão) quando é padaria sem
  // cardápio próprio. Isso evita dado bugado de seed antigo gerar orçamento errado.
  return { persona, motor: motorPadrao, avisoDoDia, sistemaCustom, provedorIa, modeloIa };
}
