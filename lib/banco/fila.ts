// ============================================================================
//  FILA DE IMPRESSÃO (lado servidor) — o que a ponte na padaria consome.
//  A ponte NÃO fala com o Postgres direto (não expor o banco). Ela chama a
//  API /api/fila, que usa estas funções. Isolamento por negocio_id.
// ============================================================================

import { query, queryUm } from "./db";
import { unidadeDoPedido as unidadeDoProduto } from "@/lib/ia/dados/produtos";
import { montarCupons } from "@/lib/cupom-escpos";

export type JobImpressao = {
  filaId: string;
  // O cupom JA MONTADO, pronto pra mandar pra impressora.
  //
  // Antes quem montava era a ponte, o programa que fica aberto na maquina da
  // padaria. Toda mudanca de layout exigia editar o arquivo LA e reiniciar o
  // programa, e isso falhou do jeito previsivel: o arquivo foi corrigido as
  // 02:17 e o processo rodava desde as 14:26 do dia anterior, entao continuou
  // imprimindo o layout velho da memoria.
  //
  // Vindo pronto daqui, mudanca de layout sobe com o painel e chega na proxima
  // impressao, sem ninguem tocar naquela maquina.
  cupons: string[];
  pedido: {
    id: string;
    clienteNome: string;
    clienteTelefone: string;
    retiradaData: string | null;
    retiradaHora: string | null;
    pessoas: number | null;
    totalCentavos: number;
    // Quem fecha o caixa na retirada le isto no papel: sem a forma combinada,
    // pergunta de novo pro cliente e da pra cobrar errado.
    formaPagamento: string | null;
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
    forma_pagamento: string | null;
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
            p.retirada_data, p.retirada_hora, p.pessoas, p.total_centavos, p.observacoes, p.forma_pagamento,
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

  return linhas.map((l) => {
    const pedido = {
      id: l.pedido_id,
      clienteNome: l.cliente_nome || "-",
      clienteTelefone: l.cliente_telefone || "",
      retiradaData: l.retirada_data,
      retiradaHora: l.retirada_hora ? l.retirada_hora.slice(0, 5) : null,
      pessoas: l.pessoas,
      totalCentavos: l.total_centavos,
      formaPagamento: l.forma_pagamento ?? null,
      observacoes: l.observacoes,
      itens: (l.itens ?? []).map((i) => ({
        produto: i.produto,
        categoria: i.categoria || "",
        qtd: i.qtd,
        obs: i.obs,
        // Unidade vazia vira peca na impressao: 3 kg de bolo viram tres bolos.
        // O cardapio decide, igual ao preco.
        //
        // `||` e nao `??`: o `??` so pega null e undefined, e o caso que o
        // comentario acima nomeia e a string VAZIA, que a tela da dona pode
        // gravar. Hoje nao da prejuizo porque `unidadeDoItem`, no cupom, tem a
        // propria cadeia de fallback e acerta pela categoria. Mas a defesa que
        // esta escrita aqui tem que ser a defesa que roda aqui.
        unidade: i.unidade || unidadeDoProduto(String(i.produto ?? ""), String(i.categoria ?? "")),
        unitCentavos: i.unit_centavos,
        subtotalCentavos: i.subtotal_centavos,
      })),
    };
    // O cupom sai pronto daqui, com as comandas do jeito que a dona ditou:
    // uma por segmento, cada uma avisando o que mais o cliente pediu. Se
    // montar falhar por causa de um pedido estranho, a ponte ainda recebe o
    // pedido inteiro e se vira: melhor papel no formato antigo do que nenhum.
    let cupons: string[] = [];
    try {
      cupons = montarCupons(pedido);
    } catch (e) {
      console.error("[fila] falha ao montar o cupom do pedido " + pedido.id + ":", e);
    }
    return { filaId: l.fila_id, pedido, cupons };
  });
}

// REIMPRESSÃO MANUAL — recoloca um pedido JÁ APROVADO na fila de impressão.
// Replica exatamente o que o trigger `on_pedido_aprovado` faz ao aprovar: insere
// uma linha 'pendente' referenciando o pedido (a fila só guarda pedido_id, e o
// cupom é montado aqui no servidor por jobsPendentes()).
//
// O comentário dizia que "a ponte remonta o cupom", que era verdade até o
// layout mudar de casa. O cabeçalho deste arquivo explica a mudança e este
// pedaço tinha ficado descrevendo o mundo antigo.
// Guarda de tenant + estado: só reimprime pedido do próprio negócio que já
// passou pela aprovação (status 'aprovado' ou 'impresso'). Retorna false se o
// pedido não existe/não é do negócio/ainda não foi aprovado.
export async function reenfileirarImpressao(
  negocioId: string,
  pedidoId: string,
): Promise<boolean> {
  const linhas = await query<{ id: string }>(
    `insert into fila_impressao (pedido_id, negocio_id, status)
     select p.id, p.negocio_id, 'pendente'::impressao_status
       from pedidos p
      where p.id = $1 and p.negocio_id = $2
        and p.status in ('aprovado', 'impresso')
     returning id`,
    [pedidoId, negocioId],
  );
  return linhas.length > 0;
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
  // A impressora nao esta PRONTA (bobina acabada, tampa aberta). Isso nao e
  // falha: o trabalho volta pra fila sem gastar tentativa e imprime sozinho
  // quando o papel voltar.
  aguardando?: boolean,
): Promise<void> {
  // Tira os bytes de controle do ESC/POS (o 0x00 derruba a gravacao inteira).
  // Guarda o texto legivel, que e pro que ele serve: conferir o que saiu.
  const cupomLimpo =
    typeof cupomTexto === "string"
      ? [...cupomTexto]
          .filter((ch) => {
            const c = ch.charCodeAt(0);
            return c === 10 || c > 31; // guarda a quebra de linha, corta o resto
          })
          .join("")
          .slice(0, 20000)
      : null;
  if (ok) {
    await query(
      `update fila_impressao set status = 'impresso', impresso_em = now(), cupom_texto = $3
         where id = $1 and negocio_id = $2 and status = 'imprimindo'`,
      [filaId, negocioId, cupomLimpo],
    );
    await query(
      `update pedidos set status = 'impresso', impresso_em = now()
         where id = (select pedido_id from fila_impressao where id = $1 and negocio_id = $2)
           and negocio_id = $2`,
      [filaId, negocioId],
    );
  } else if (aguardando) {
    // Impressora não está pronta: devolve pra fila COM o recado, sem contar
    // tentativa. Fica assim o tempo que precisar até alguém pôr papel.
    await query(
      `update fila_impressao set status = 'pendente'::impressao_status, erro_msg = $3
         where id = $1 and negocio_id = $2 and status = 'imprimindo'`,
      [filaId, negocioId, (erro ?? "").slice(0, 300)],
    );
  } else {
    // Falha de verdade (impressora recusou os bytes, cabo solto): reenfileira
    // pra tentar de novo, e só marca 'erro' de vez depois de MAX_TENTATIVAS.
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

// SINAL DE VIDA DA PONTE.
//
// A ponte roda na maquina da padaria e morre sem avisar: o icone continua na
// barra de tarefas com o processo morto por tras, e o pedido aprovado nao sai na
// cozinha com todo mundo achando que saiu. A propria consulta da fila e o sinal:
// se a ponte esta viva, ela pergunta por trabalho a cada poucos segundos.
export async function marcarPonteViva(negocioId: string): Promise<void> {
  if (!negocioId) return;
  await query(
    `insert into ponte_status (negocio_id, visto_em) values ($1, now())
       on conflict (negocio_id) do update set visto_em = now()`,
    [negocioId],
  );
}

export async function statusDaPonte(
  negocioId: string,
): Promise<{ online: boolean; segundosDesde: number | null }> {
  const l = await queryUm<{ seg: string | null }>(
    `select extract(epoch from (now() - visto_em)) as seg from ponte_status where negocio_id = $1`,
    [negocioId],
  );
  if (!l || l.seg === null) return { online: false, segundosDesde: null };
  const seg = Math.round(Number(l.seg) || 0);
  // A ponte pergunta a cada 4s; 60s de silencio ja e problema, nao demora.
  return { online: seg <= 60, segundosDesde: seg };
}
