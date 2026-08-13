// ============================================================================
//  ATENDIMENTOS — as conversas REAIS do WhatsApp (tabela mensagens), pro painel.
//  Agrupa por cliente, monta o formato Conversa que a tela usa. Por negocio_id.
// ============================================================================

import { query } from "./db";
import type { Conversa } from "../tipos";

type MsgBruta = { papel: string; conteudo: string; hora: string };
type LinhaConversa = {
  cliente_id: string;
  nome: string | null;
  telefone: string;
  msgs: MsgBruta[] | null;
};

export async function listarConversas(negocioId: string): Promise<Conversa[]> {
  const linhas = await query<LinhaConversa>(
    `select c.id as cliente_id, c.nome, c.telefone,
       coalesce(
         (select json_agg(json_build_object(
            'papel', m.papel, 'conteudo', m.conteudo,
            'hora', to_char(m.criado_em at time zone 'America/Sao_Paulo', 'HH24:MI'))
          order by m.criado_em)
          from mensagens m where m.cliente_id = c.id and m.negocio_id = $1),
         '[]'::json) as msgs
       from clientes c
      where c.negocio_id = $1
        and exists (select 1 from mensagens m where m.cliente_id = c.id and m.negocio_id = $1)
      order by (select max(m.criado_em) from mensagens m where m.cliente_id = c.id and m.negocio_id = $1) desc
      limit 30`,
    [negocioId],
  );

  return linhas.map((l): Conversa => {
    const msgs = l.msgs ?? [];
    const mensagens = msgs.map((m) => ({
      de: (m.papel === "assistant" ? "ia" : "cliente") as "cliente" | "ia" | "equipe",
      texto: m.conteudo,
      hora: m.hora,
    }));
    const ultima = msgs[msgs.length - 1];
    return {
      id: l.cliente_id,
      clienteNome: l.nome || "Cliente",
      clienteTelefone: l.telefone,
      ultimaHora: ultima?.hora ?? "",
      previa: ultima ? ultima.conteudo.slice(0, 60) : "",
      estado: "ia",
      naoLidas: 0,
      mensagens,
    };
  });
}
