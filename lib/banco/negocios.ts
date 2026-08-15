// ============================================================================
//  NEGÓCIOS — dados do tenant (nome, cores). Usado pra brandar o painel com o
//  negócio do usuário logado (multi-tenant). Isolado por negocio_id.
// ============================================================================

import { query, queryUm } from "./db";

// Mapeia o WhatsApp conectado (Embedded Signup) pro tenant: grava phone_id,
// waba_id, token, numero/perfil e a hora da conexao no config. O webhook usa
// whatsapp_phone_id pra rotear as mensagens desse numero pra este negocio.
export async function salvarWhatsappTenant(
  negocioId: string,
  dados: {
    phoneId: string;
    wabaId: string;
    token: string;
    numero?: string | null;
    perfil?: string | null;
    conectadoEm?: string;
  },
): Promise<void> {
  await query(
    `update negocios set config = coalesce(config, '{}'::jsonb) || jsonb_build_object(
       'whatsapp_phone_id', $2::text,
       'whatsapp_waba_id', $3::text,
       'whatsapp_token', $4::text,
       'whatsapp_numero', $5::text,
       'whatsapp_perfil', $6::text,
       'whatsapp_conectado_em', $7::text,
       'ia_ativa', true
     ) where id = $1`,
    [
      negocioId,
      dados.phoneId,
      dados.wabaId,
      dados.token,
      dados.numero ?? null,
      dados.perfil ?? null,
      dados.conectadoEm ?? new Date().toISOString(),
    ],
  );
}

// Estado atual do liga/desliga da IA (pra pintar o toggle no painel).
export async function carregarIaAtiva(negocioId: string): Promise<boolean> {
  const n = await queryUm<{ a: boolean }>(
    `select coalesce((config->>'ia_ativa')::boolean, true) as a from negocios where id = $1`,
    [negocioId],
  );
  return n?.a ?? true;
}

// Liga/desliga a resposta automatica da IA (sem desconectar o numero).
export async function definirIaAtiva(negocioId: string, ativa: boolean): Promise<void> {
  await query(
    `update negocios set config = coalesce(config, '{}'::jsonb) || jsonb_build_object('ia_ativa', $2::boolean)
     where id = $1`,
    [negocioId, ativa],
  );
}

// Desconecta o WhatsApp: limpa as chaves do config (o numero deixa de rotear).
export async function desconectarWhatsapp(negocioId: string): Promise<void> {
  await query(
    `update negocios set config = config
       - 'whatsapp_phone_id' - 'whatsapp_waba_id' - 'whatsapp_token'
       - 'whatsapp_numero' - 'whatsapp_perfil' - 'whatsapp_conectado_em'
     where id = $1`,
    [negocioId],
  );
}

// Estado da conexao pro painel: conectado?, numero, perfil, IA ligada, quando
// conectou e quantas respostas a IA enviou hoje.
export type ConexaoWhatsapp = {
  conectado: boolean;
  phoneId: string | null;
  numero: string | null;
  perfil: string | null;
  iaAtiva: boolean;
  conectadoEm: string | null;
  mensagensHoje: number;
  problema?: boolean; // conexao caiu (alerta vermelho). Deteccao de queda: futuro.
};
// Confere na Meta se o numero ainda esta vivo (token valido). Evita a "conexao
// fantasma": phone_id salvo no banco de um teste antigo, com token ja morto.
// Defensivo: so trata como MORTO em erro claro de token/permissao; rede/timeout
// nao derruba (pode ser transitorio).
async function verificarNumero(
  phoneId: string,
  token: string,
): Promise<{ vivo: boolean; numero?: string | null; perfil?: string | null }> {
  try {
    const r = await fetch(
      `https://graph.facebook.com/v25.0/${phoneId}?fields=display_phone_number,verified_name`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5000) },
    );
    if (r.ok) {
      const j = (await r.json()) as { display_phone_number?: string; verified_name?: string };
      return { vivo: true, numero: j.display_phone_number ?? null, perfil: j.verified_name ?? null };
    }
    const j = (await r.json().catch(() => ({}))) as { error?: { code?: number; type?: string } };
    const code = j?.error?.code;
    // 190 token invalido/expirado, 102 sessao, 10/200/104 permissao, 100 objeto invalido.
    const morto = [190, 102, 10, 200, 104, 100].includes(Number(code)) || j?.error?.type === "OAuthException";
    return { vivo: !morto };
  } catch {
    return { vivo: true }; // rede/timeout: nao derruba, mantem o que o banco diz
  }
}

export async function carregarConexao(negocioId: string): Promise<ConexaoWhatsapp> {
  const n = await queryUm<{
    phone_id: string | null;
    token: string | null;
    numero: string | null;
    perfil: string | null;
    conectado_em: string | null;
    ia_ativa: boolean;
  }>(
    `select config->>'whatsapp_phone_id' as phone_id,
            config->>'whatsapp_token' as token,
            config->>'whatsapp_numero' as numero,
            config->>'whatsapp_perfil' as perfil,
            config->>'whatsapp_conectado_em' as conectado_em,
            coalesce((config->>'ia_ativa')::boolean, true) as ia_ativa
       from negocios where id = $1`,
    [negocioId],
  );

  // Sem phone_id E token, nao ha conexao funcional.
  let conectado = Boolean(n?.phone_id && n?.token);
  let numero = n?.numero ?? null;
  let perfil = n?.perfil ?? null;

  // Confere na Meta se esta vivo; mata a conexao fantasma e preenche o numero real.
  if (conectado && n?.phone_id && n?.token) {
    const chk = await verificarNumero(n.phone_id, n.token);
    if (!chk.vivo) {
      // Token morto (erro claro de auth): auto-limpa a conexao fantasma pra nao
      // reaparecer. So dispara em erro definitivo, nao em falha de rede.
      conectado = false;
      try {
        await desconectarWhatsapp(negocioId);
      } catch {
        /* nao bloqueia a leitura se a limpeza falhar */
      }
    } else {
      numero = numero ?? chk.numero ?? null;
      perfil = perfil ?? chk.perfil ?? null;
    }
  }

  let mensagensHoje = 0;
  if (conectado) {
    const c = await queryUm<{ c: number }>(
      `select count(*)::int as c from mensagens
        where negocio_id = $1 and papel = 'assistant' and criado_em >= current_date`,
      [negocioId],
    );
    mensagensHoje = c?.c ?? 0;
  }

  return {
    conectado,
    phoneId: n?.phone_id ?? null,
    numero,
    perfil,
    iaAtiva: n?.ia_ativa ?? true,
    conectadoEm: n?.conectado_em ?? null,
    mensagensHoje,
  };
}

// Credenciais do WhatsApp DESTE negocio (salvas pelo Embedded Signup no config).
// O webhook usa isso pra responder pelo numero conectado do cliente, nao pelo
// token global. Se o negocio ainda nao conectou, volta null e cai no env.
export type CredsWhatsapp = {
  phoneId: string | null;
  token: string | null;
  wabaId: string | null; // usado pra listar/enviar templates aprovados
  iaAtiva: boolean;
};
export async function carregarCredsWhatsapp(negocioId: string): Promise<CredsWhatsapp> {
  const n = await queryUm<{ phone_id: string | null; token: string | null; waba_id: string | null; ia_ativa: boolean }>(
    `select config->>'whatsapp_phone_id' as phone_id, config->>'whatsapp_token' as token,
            config->>'whatsapp_waba_id' as waba_id,
            coalesce((config->>'ia_ativa')::boolean, true) as ia_ativa
       from negocios where id = $1`,
    [negocioId],
  );
  return {
    phoneId: n?.phone_id ?? null,
    token: n?.token ?? null,
    wabaId: n?.waba_id ?? null,
    iaAtiva: n?.ia_ativa ?? true,
  };
}

// AVISO DO DIA — "cérebro temporário" que a dona escreve (ex: "sem pão após
// 18h"). Fica no config; a IA injeta SE for de hoje. Expira sozinho na virada.
export type AvisoDoDia = { texto: string | null; atualizadoEm: string | null };
export async function carregarAvisoDoDia(negocioId: string): Promise<AvisoDoDia> {
  const n = await queryUm<{ texto: string | null; atualizado_em: string | null }>(
    `select config->>'aviso_do_dia' as texto, config->>'aviso_atualizado_em' as atualizado_em
       from negocios where id = $1`,
    [negocioId],
  );
  return { texto: n?.texto ?? null, atualizadoEm: n?.atualizado_em ?? null };
}
export async function salvarAvisoDoDia(negocioId: string, texto: string): Promise<void> {
  await query(
    `update negocios set config = coalesce(config, '{}'::jsonb) || jsonb_build_object(
       'aviso_do_dia', $2::text, 'aviso_atualizado_em', $3::text
     ) where id = $1`,
    [negocioId, texto, new Date().toISOString()],
  );
}
export async function limparAvisoDoDia(negocioId: string): Promise<void> {
  await query(
    `update negocios set config = config - 'aviso_do_dia' - 'aviso_atualizado_em' where id = $1`,
    [negocioId],
  );
}

// Mensagem da cobrança automática (template editável pela dona). Placeholders:
// {nome}, {dia}, {valor}. Guardada no config; volta null se nunca personalizou.
export async function carregarMsgCobranca(negocioId: string): Promise<string | null> {
  const n = await queryUm<{ m: string | null }>(
    `select config->>'cobranca_msg' as m from negocios where id = $1`,
    [negocioId],
  );
  return n?.m ?? null;
}
export async function salvarMsgCobranca(negocioId: string, texto: string): Promise<void> {
  const t = (texto ?? "").trim();
  if (!t) {
    await query(`update negocios set config = config - 'cobranca_msg' where id = $1`, [negocioId]);
    return;
  }
  await query(
    `update negocios set config = coalesce(config, '{}'::jsonb) || jsonb_build_object('cobranca_msg', $2::text) where id = $1`,
    [negocioId, t],
  );
}

export type NegocioMarca = {
  nome: string;
  corPrimaria: string | null;
  corDestaque: string | null;
  tipo: string; // 'padaria' (padrão) | 'agencia' — decide as abas do painel
  logoUrl: string | null; // logo do tenant (data URL); null = usa o padrão
};

export async function carregarMarca(negocioId: string): Promise<NegocioMarca | null> {
  const n = await queryUm<{
    nome: string;
    cor_primaria: string | null;
    cor_destaque: string | null;
    tipo: string | null;
    logo_url: string | null;
  }>(
    "select nome, cor_primaria, cor_destaque, config->>'tipo' as tipo, config->>'logo_url' as logo_url from negocios where id = $1",
    [negocioId],
  );
  if (!n) return null;
  return {
    nome: n.nome,
    corPrimaria: n.cor_primaria,
    corDestaque: n.cor_destaque,
    tipo: n.tipo || "padaria",
    logoUrl: n.logo_url,
  };
}

// Leitura direta da marca (sem cache em memória). Um cache por instância trazia
// bug: o Vercel roda em várias instâncias e, ao trocar a logo/cor, o refresh
// podia cair numa instância com a marca ANTIGA em cache. Como é uma consulta por
// chave primária (rápida), lemos fresco toda vez e a mudança aparece na hora.
export async function carregarMarcaCache(negocioId: string): Promise<NegocioMarca | null> {
  return carregarMarca(negocioId);
}

// Salva (ou remove, com dataUrl null) a logo do tenant no config.logo_url.
export async function definirLogo(negocioId: string, dataUrl: string | null): Promise<void> {
  if (dataUrl) {
    await query(
      `update negocios set config = coalesce(config, '{}'::jsonb) || jsonb_build_object('logo_url', $2::text)
       where id = $1`,
      [negocioId, dataUrl],
    );
  } else {
    await query(`update negocios set config = config - 'logo_url' where id = $1`, [negocioId]);
  }
}
