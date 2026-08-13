// ============================================================================
//  FILA DE IMPRESSÃO (lado servidor) — o que a ponte na padaria consome.
//  A ponte NÃO fala com o Postgres direto (não expor o banco). Ela chama a
//  API /api/fila, que usa estas funções. Isolamento por negocio_id.
// ============================================================================

import { query } from "./db";

export type JobImpressao = {
  filaId: string;
  pedido: {
    id: string;
    clienteNome: string;
    clienteTelefone: string;
    retiradaData: string | null;
    retiradaHora: string | null;
    pessoas: number | null;
    totalCentavos: number;
    observacoes: string | null;
    itens: {
      produto: string;
      categoria: string;
      qtd: number;
      obs?: string | null;
      unidade?: string | null;
      unitCentavos?: number;
      subtotalCentavos?: number;
    }[];
  };
};

// Jobs pendentes de um negócio, já com o pedido montado pro cupom.
export async function jobsPendentes(negocioId: string): Promise<JobImpressao[]> {
  const linhas = await query<{
    fila_id: string;
    pedido_id: string;
    cliente_nome: string | null;
    cliente_telefone: string | null;
    retirada_data: string | null;
    retirada_hora: string | null;
    pessoas: number | null;
    total_centavos: number;
    observacoes: string | null;
    itens:
      | {
          produto: string;
          categoria: string | null;
          qtd: number;
          obs: string | null;
          unidade: string | null;
          unit_centavos: number;
          subtotal_centavos: number;
        }[]
      | null;
  }>(
    // RESERVA atômica: marca 'pendente' -> 'imprimindo' e já devolve o job. O
    // `for update skip locked` faz cada linha ir pra UMA ponte só (duas instâncias
    // não pegam o mesmo job) e, uma vez 'imprimindo', a rodada seguinte não repega
    // (evita reimpressão se a confirmação falhar depois de imprimir).
    `with reservados as (
       update fila_impressao set status = 'imprimindo'
        where id in (
          select id from fila_impressao
           where negocio_id = $1 and status = 'pendente'
           order by criado_em asc
           limit 20
           for update skip locked
        )
       returning id, pedido_id, criado_em
     )
     select r.id as fila_id, p.id as pedido_id,
            c.nome as cliente_nome, c.telefone as cliente_telefone,
            p.retirada_data, p.retirada_hora, p.pessoas, p.total_centavos, p.observacoes,
            coalesce(
              (select json_agg(json_build_object('produto', i.produto, 'categoria', i.categoria, 'qtd', i.qtd, 'obs', i.obs, 'unidade', i.unidade, 'unit_centavos', i.unit_centavos, 'subtotal_centavos', i.subtotal_centavos))
               from pedido_itens i where i.pedido_id = p.id),
              '[]'::json) as itens
       from reservados r
       join pedidos p on p.id = r.pedido_id and p.negocio_id = $1
       left join clientes c on c.id = p.cliente_id
      order by r.criado_em asc`,
    [negocioId],
  );

  return linhas.map((l) => ({
    filaId: l.fila_id,
    pedido: {
      id: l.pedido_id,
      clienteNome: l.cliente_nome || "-",
      clienteTelefone: l.cliente_telefone || "",
      retiradaData: l.retirada_data,
      retiradaHora: l.retirada_hora ? l.retirada_hora.slice(0, 5) : null,
      pessoas: l.pessoas,
      totalCentavos: l.total_centavos,
      observacoes: l.observacoes,
      itens: (l.itens ?? []).map((i) => ({
        produto: i.produto,
        categoria: i.categoria || "",
        qtd: i.qtd,
        obs: i.obs,
        unidade: i.unidade,
        unitCentavos: i.unit_centavos,
        subtotalCentavos: i.subtotal_centavos,
      })),
    },
  }));
}

// Quantas vezes tentar imprimir um job antes de desistir e marcar 'erro'.
const MAX_TENTATIVAS = 5;

// A ponte confirma que imprimiu (ok=true) ou que a IMPRESSÃO falhou (ok=false).
// A guarda `status = 'imprimindo'` garante idempotência: uma confirmação
// repetida/atrasada não re-transiciona um job que já foi resolvido.
export async function marcarImpresso(
  negocioId: string,
  filaId: string,
  ok: boolean,
  cupomTexto?: string,
  erro?: string,
): Promise<void> {
  if (ok) {
    await query(
      `update fila_impressao set status = 'impresso', impresso_em = now(), cupom_texto = $3
         where id = $1 and negocio_id = $2 and status = 'imprimindo'`,
      [filaId, negocioId, cupomTexto ?? null],
    );
    await query(
      `update pedidos set status = 'impresso', impresso_em = now()
         where id = (select pedido_id from fila_impressao where id = $1 and negocio_id = $2)
           and negocio_id = $2`,
      [filaId, negocioId],
    );
  } else {
    // Falha de impressão (papel acabou, impressora offline...): reenfileira pra
    // tentar de novo, e só marca 'erro' de vez depois de MAX_TENTATIVAS.
    await query(
      `update fila_impressao
          set tentativas = tentativas + 1,
              status = case when tentativas + 1 >= $4 then 'erro'::impressao_status
                            else 'pendente'::impressao_status end,
              erro_msg = $3
        where id = $1 and negocio_id = $2 and status = 'imprimindo'`,
      [filaId, negocioId, (erro ?? "").slice(0, 300), MAX_TENTATIVAS],
    );
  }
}
