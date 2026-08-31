// ============================================================================
//  ATENDIMENTOS — as conversas REAIS do WhatsApp (tabela mensagens), pro painel.
//  Agrupa por cliente, monta o formato Conversa que a tela (WhatsApp Web) usa.
//  Isolamento multi-tenant: TODA query filtra por negocio_id.
//
//  A mídia (imagem/audio/documento) NÃO trafega aqui em base64 (seria pesado na
//  lista): mandamos só o id da mensagem + metadados, e a tela busca o binário
//  por /api/midia/[id] quando precisa mostrar.
// ============================================================================

import { query, queryUm } from "./db";
import type { Conversa, TipoMidia } from "../tipos";
import { TZ_PADARIA } from "../fuso-padaria";

type MsgBruta = {
  id: string;
  autor: "cliente" | "ia" | "equipe" | "cobranca";
  conteudo: string;
  hora: string;
  data: string;
  tipo: TipoMidia;
  mime: string | null;
  nome: string | null;
  tem_midia: boolean;
  url: string | null;
  entregue: boolean | null;
  lida_wpp: boolean | null;
  falha: string | null;
};
type LinhaConversa = {
  cliente_id: string;
  nome: string | null;
  telefone: string;
  handoff: boolean;
  handoff_motivo?: string | null;
  ia_pausada: boolean;
  nao_lidas: number;
  janela_expira_ms: number | null;
  custo_cent: number;
  // Selecionado na query (linha do `c.origem_anuncio`). Faltava aqui, e por
  // isso o mapeamento la embaixo fazia `as unknown as {...}` pra ler o campo.
  // Um cast desses ESCONDE renomeacao: no dia em que a coluna mudasse de nome,
  // o compilador ficaria calado e a tela pararia de mostrar de onde o cliente
  // veio, sem ninguem saber. Declarado, o compilador volta a trabalhar.
  origem_anuncio: { titulo?: string | null; url?: string | null; anuncio_id?: string | null } | null;
  msgs: MsgBruta[] | null;
};

export async function listarConversas(negocioId: string): Promise<Conversa[]> {
  const linhas = await query<LinhaConversa>(
    `select c.id as cliente_id, c.nome, c.telefone,
       coalesce(c.handoff, false) as handoff,
       c.handoff_motivo,
       coalesce(c.ia_pausada, false) as ia_pausada,
       coalesce((
         select count(*) from mensagens m
          where m.cliente_id = c.id and m.negocio_id = $1
            and coalesce(m.autor, case when m.papel = 'user' then 'cliente' else 'ia' end) = 'cliente'
            and m.lida = false
       ), 0)::int as nao_lidas,
       (
         select extract(epoch from (max(m.criado_em) + interval '24 hours')) * 1000
           from mensagens m
          where m.cliente_id = c.id and m.negocio_id = $1
            and coalesce(m.autor, case when m.papel = 'user' then 'cliente' else 'ia' end) = 'cliente'
       )::float8 as janela_expira_ms,
       -- Custo de IA ACUMULADO desta conversa (soma do consumo do cérebro).
       -- A uso_ia mora no schema public (search_path do painel e docepao), por
       -- isso referenciamos public.uso_ia EXPLICITAMENTE. cliente_id amarra o
       -- consumo a ESTE cliente; NULL (teste/demo) nao entra na conta dele.
       coalesce((
         select sum(u.custo_cent) from public.uso_ia u
          where u.negocio_id = $1 and u.cliente_id = c.id
       ), 0)::int as custo_cent,
       coalesce(
         (select json_agg(json_build_object(
            'id', m.id,
            'autor', coalesce(m.autor, case when m.papel = 'user' then 'cliente' else 'ia' end),
            'conteudo', m.conteudo,
            'hora', to_char(m.criado_em at time zone '${TZ_PADARIA}', 'HH24:MI'),
            'data', to_char(m.criado_em at time zone '${TZ_PADARIA}', 'YYYY-MM-DD'),
            'tipo', coalesce(m.tipo, 'texto'),
            'mime', m.midia_mime,
            'nome', m.midia_nome,
            'tem_midia', (m.midia_dados is not null),
            'url', m.midia_url,
            'entregue', (m.entregue_em is not null),
            'lida_wpp', (m.lida_em is not null),
            'falha', m.falha)
          order by m.criado_em)
          from mensagens m where m.cliente_id = c.id and m.negocio_id = $1),
         '[]'::json) as msgs
       , c.origem_anuncio
       from clientes c
      where c.negocio_id = $1
        and exists (select 1 from mensagens m where m.cliente_id = c.id and m.negocio_id = $1)
      order by (select max(m.criado_em) from mensagens m where m.cliente_id = c.id and m.negocio_id = $1) desc
      limit 60`,
    [negocioId],
  );

  return linhas.map((l): Conversa => {
    const msgs = l.msgs ?? [];
    const mensagens = msgs.map((m) => ({
      de: m.autor,
      texto: m.conteudo,
      hora: m.hora,
      data: m.data,
      tipo: m.tipo,
      midiaId: m.tem_midia ? m.id : undefined,
      midiaUrl: m.url ?? undefined,
      midiaMime: m.mime ?? undefined,
      midiaNome: m.nome ?? undefined,
      entregue: m.entregue ?? undefined,
      lidaWpp: m.lida_wpp ?? undefined,
      falhaEnvio: m.falha ?? undefined,
      id: m.id,
    }));
    // O anuncio de origem, quando existir.
    const anuncio = l.origem_anuncio ?? null;
    const ultima = msgs[msgs.length - 1];
    return {
      id: l.cliente_id,
      clienteNome: l.nome || "Cliente",
      clienteTelefone: l.telefone,
      ultimaHora: ultima?.hora ?? "",
      previa: ultima ? previaDe(ultima) : "",
      // quem assumiu manda: a pausa da equipe vence o pedido de socorro da IA.
      estado: l.ia_pausada ? "humano" : l.handoff ? "precisa_humano" : "ia",
      naoLidas: Number(l.nao_lidas) || 0,
      janelaExpiraMs: l.janela_expira_ms != null ? Number(l.janela_expira_ms) : null,
      custoCentavos: Number(l.custo_cent) || 0,
      mensagens,
      origemAnuncio: anuncio,
      // POR QUE A IA CHAMOU. O campo existia no tipo desde sempre e nunca era
      // preenchido, entao a tela so sabia dizer QUE alguem precisava olhar.
      motivoHumano: l.handoff ? (l.handoff_motivo ?? null) : null,
    };
  });
}

// Prévia da última mensagem na lista: mídia vira rótulo curto, texto trunca.
function previaDe(m: MsgBruta): string {
  if (m.tipo === "imagem") return "Foto";
  if (m.tipo === "audio") return "Áudio";
  if (m.tipo === "documento") return m.nome ? m.nome : "Documento";
  return (m.conteudo || "").slice(0, 60);
}

// Marca como lidas todas as mensagens do cliente numa conversa (ao abrir/ler).
export async function marcarConversaLida(negocioId: string, clienteId: string): Promise<void> {
  await query(
    `update mensagens set lida = true
       where negocio_id = $1 and cliente_id = $2 and lida = false
         and coalesce(autor, case when papel = 'user' then 'cliente' else 'ia' end) = 'cliente'`,
    [negocioId, clienteId],
  );
}

// Liga/desliga a pausa da IA (a equipe assumiu a conversa).
//
// Assumir também limpa o handoff: se a IA tinha pedido socorro, o socorro
// chegou — deixar os dois ligados faria a conversa gritar por ajuda sendo que
// alguém já está nela.
export async function definirPausaIA(negocioId: string, clienteId: string, valor: boolean): Promise<void> {
  await query(
    `update clientes
        set ia_pausada = $3,
            ia_pausada_em = case when $3 then now() else null end,
            handoff = case when $3 then false else handoff end
      where negocio_id = $1 and id = $2`,
    [negocioId, clienteId, valor],
  );
}

// A IA está pausada nesta conversa? (o webhook pergunta antes de responder)
export async function iaPausada(negocioId: string, clienteId: string): Promise<boolean> {
  const l = await queryUm<{ p: boolean }>(
    "select coalesce(ia_pausada, false) as p from clientes where negocio_id = $1 and id = $2",
    [negocioId, clienteId],
  );
  return !!l?.p;
}

// Liga/desliga o handoff ("precisa de você") de um cliente.
export async function definirHandoff(
  negocioId: string,
  clienteId: string,
  valor: boolean,
  motivo?: string | null,
): Promise<void> {
  // O MOTIVO SO ENTRA QUANDO ELA ESTA CHAMANDO, e nunca apaga um motivo antigo
  // por vir vazio: desligar o handoff limpa, ligar sem motivo mantem o que
  // estava. Quem abre a conversa precisa saber DO QUE se trata, e nao so que
  // alguem precisa olhar.
  await query(
    `update clientes
        set handoff = $3,
            handoff_motivo = case
              when $3 = false then null
              when $4::text is not null then $4::text
              else handoff_motivo
            end
      where negocio_id = $1 and id = $2`,
    [negocioId, clienteId, valor, motivo ?? null],
  );
}

// Última mensagem do CLIENTE (epoch ms) — pra checar a janela de 24h no servidor
// antes de deixar mandar texto livre. null = cliente nunca escreveu.
export async function ultimaMsgClienteMs(negocioId: string, clienteId: string): Promise<number | null> {
  const l = await queryUm<{ ms: number | null }>(
    `select extract(epoch from max(criado_em)) * 1000 as ms
       from mensagens
      where negocio_id = $1 and cliente_id = $2
        and coalesce(autor, case when papel = 'user' then 'cliente' else 'ia' end) = 'cliente'`,
    [negocioId, clienteId],
  );
  return l?.ms != null ? Number(l.ms) : null;
}

// Serve a mídia de UMA mensagem (rota /api/midia/[id]), escopada por negócio.
export async function buscarMidiaMensagem(
  negocioId: string,
  mensagemId: string,
): Promise<{ dados: string; mime: string; nome: string | null } | null> {
  return queryUm<{ dados: string; mime: string; nome: string | null }>(
    `select midia_dados as dados, coalesce(midia_mime, 'application/octet-stream') as mime, midia_nome as nome
       from mensagens
      where negocio_id = $1 and id = $2 and midia_dados is not null`,
    [negocioId, mensagemId],
  );
}

// Telefone do cliente (pra enviar), escopado por negócio.
export async function telefoneDoCliente(negocioId: string, clienteId: string): Promise<string | null> {
  const l = await queryUm<{ telefone: string }>(
    "select telefone from clientes where negocio_id = $1 and id = $2",
    [negocioId, clienteId],
  );
  return l?.telefone ?? null;
}
