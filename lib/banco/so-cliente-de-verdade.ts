// ============================================================================
//  QUEM É CLIENTE DE VERDADE, E QUEM É INSTRUMENTO DE TESTE.
//
//  ESTE ARQUIVO EXISTE PORQUE A PERGUNTA ESTAVA RESPONDIDA NUM LUGAR SÓ, E OS
//  NÚMEROS DA DONA ESTAVAM NO OUTRO.
//
//  O `clientes.ts` escondia cliente de teste do CRM com três condições escritas
//  na própria query. O `resultados.ts` -- faturamento, pedidos, atendimentos,
//  respostas, o que a dona abre pra saber como foi o mês -- não tinha filtro
//  nenhum. Toda conversa de teste que este projeto rodou contra a produção
//  entrou nesses números como se fosse venda e atendimento de gente.
//
//  E o recorte que existia estava incompleto: ele conhecia o telefone da tela
//  "Testar IA" (55000000...) e não conhecia a faixa que as medições de linha de
//  comando usam (55119777700...), que é a declarada no `medidor.cjs`, no
//  `guardar-conversas.cjs` e no `uma-conversa-contra-o-banco.cjs`.
//
//  A FAIXA NÃO É INVENÇÃO MINHA: ela já estava escrita nos testes, com o motivo
//  ("é instrumento, e instrumento não é cliente"). O que faltava era o painel
//  saber disso.
//
//  Escrito na leitura da camada de banco, 28/08/2026.
// ============================================================================

// Faixas de telefone que o projeto usa como instrumento. Quem mexer aqui mexe
// nos NÚMEROS DA DONA: acrescentar uma faixa esconde vendas, e tirar uma faz
// teste virar faturamento.
export const FAIXAS_DE_TESTE = [
  "55000000%", // a tela "Testar IA" do painel (5500000000000)
  "55119777700%", // as medições por linha de comando (medidor, mede-uma-conversa)
];

// Nomes que a própria bateria escreve. Ficam porque cliente de verdade não se
// chama assim, e porque uma conversa de teste antiga pode ter ficado com um
// telefone fora das faixas.
const NOMES_DE_TESTE = ["cliente de teste%", "qa %"];

/**
 * Condição SQL de "este cliente é instrumento", pro alias de `clientes` que a
 * query estiver usando.
 *
 * Devolve texto pra ir dentro do SQL, e por isso NÃO aceita nada de fora: as
 * faixas e os nomes são constantes deste arquivo.
 */
export function ehClienteDeTeste(alias: string): string {
  const fone = FAIXAS_DE_TESTE.map((f) => `${alias}.telefone like '${f}'`);
  const nome = NOMES_DE_TESTE.map((n) => `coalesce(${alias}.nome, '') ilike '${n}'`);
  return "(" + [...fone, ...nome].join(" or ") + ")";
}

/** O contrário, pra usar direto no `where` de quem lista cliente. */
export function ehClienteDeVerdade(alias: string): string {
  return "not " + ehClienteDeTeste(alias);
}

/**
 * "Este PEDIDO é de um cliente de teste?" — pra query que só tem `pedidos` na
 * mão e não quer um join a mais.
 */
export function pedidoDeClienteDeTeste(aliasPedido: string): string {
  return `exists (select 1 from clientes ct where ct.id = ${aliasPedido}.cliente_id and ${ehClienteDeTeste("ct")})`;
}

/** O mesmo pra uma linha de `mensagens`. */
export function mensagemDeClienteDeTeste(aliasMensagem: string): string {
  return `exists (select 1 from clientes ct where ct.id = ${aliasMensagem}.cliente_id and ${ehClienteDeTeste("ct")})`;
}
