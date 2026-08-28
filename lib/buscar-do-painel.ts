// ============================================================================
//  A BUSCA QUE AS TELAS DO PAINEL FAZEM, COM UMA REGRA SO PRA SESSAO EXPIRADA.
//
//  POR QUE ISTO EXISTE
//
//  Seis telas do painel ficam perguntando ao servidor de tempos em tempos: a
//  fila de aprovacao (5s), os pedidos do dia (7s), os atendimentos (6s), o sino
//  (contagem), o status da impressora (20s) e a tela de aguardando.
//
//  Todas faziam a mesma coisa com o erro:
//
//      const r = await fetch("/api/...");
//      if (!r.ok) return;          // e pronto
//
//  Se a sessao expira, a resposta vira 401, o `return` engole, e a tela CONGELA
//  mostrando os ultimos dados. Ela continua bonita, com o pedido da meia hora
//  passada na tela, e ninguem descobre que parou. Numa tela de fila de pedido
//  isso e pior que um erro na cara: a dona confia no que esta vendo.
//
//  E ISSO FICOU MAIS PROVAVEL POR CAUSA DE UM CONSERTO MEU
//
//  Ate 28/08/2026 as rotas do painel caiam no `NEGOCIO_PADRAO_ID` quando nao
//  havia sessao, entao elas NUNCA respondiam 401: respondiam com os dados da
//  padaria. Isso era o defeito das dezesseis rotas sem login, que eu consertei
//  no mesmo dia.
//
//  Consertando, o 401 passou a existir de verdade. A condicao pra este segundo
//  defeito aparecer nasceu do conserto do primeiro, e por isso ele vem junto.
// ============================================================================

/** O que aconteceu com a busca, pra tela decidir o que mostrar. */
export type Resultado<T> =
  | { estado: "ok"; dados: T }
  | { estado: "sessao_expirada" }
  | { estado: "falhou" };

/**
 * Busca uma rota do painel e separa os tres casos que a tela precisa distinguir.
 *
 * NAO REDIRECIONA SOZINHA. Quem decide e a tela: a fila mostra um aviso pra a
 * dona nao perder o que estava fazendo, e o sino do cabecalho pode so parar de
 * piscar. Redirecionar de dentro de um `setInterval` tiraria a pessoa da tela no
 * meio de um clique.
 */
export async function buscarDoPainel<T>(url: string, init?: RequestInit): Promise<Resultado<T>> {
  try {
    const r = await fetch(url, { cache: "no-store", ...init });
    if (r.status === 401 || r.status === 403) return { estado: "sessao_expirada" };
    if (!r.ok) return { estado: "falhou" };
    return { estado: "ok", dados: (await r.json()) as T };
  } catch {
    // Rede caiu, aba dormiu, servidor reiniciando: nao e sessao expirada, e a
    // tela nao deve mandar ninguem pro login por causa disso.
    return { estado: "falhou" };
  }
}

/** O texto que as telas mostram quando a sessao cai. Um so, em todas. */
export const AVISO_SESSAO_EXPIRADA =
  "Sua sessão expirou e a tela parou de atualizar. Recarregue a página (F5) e entre de novo.";
