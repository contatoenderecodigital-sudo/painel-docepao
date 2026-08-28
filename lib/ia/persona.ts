// ============================================================================
//  PERSONA — o "jeito de falar" da IA por negócio.
//  Isto é o system prompt: define a voz, as regras e o que a IA pode/não pode.
//  É configurável por negócio (multi-tenant) — cada padaria tem a sua.
//
//  ⚠️ Regra de ouro: a IA NUNCA calcula preço de cabeça. Ela chama a ferramenta
//  de orçamento (código puro). O prompt reforça isso.
//
//  ORGANIZAÇÃO (importa pro custo, não só pra leitura): o texto grande e fixo
//  vem primeiro e a data de hoje é colada no FIM, em cerebro.ts. É isso que
//  deixa o prefixo estável entre as chamadas e faz o cache de prompt da OpenAI
//  pegar — reordenar isso encarece cada mensagem.
//
//  ENXUGADO em 18/08/2026 porque 18.700 tokens de entrada por turno estouravam
//  o limite de 200k por minuto da conta e o cliente recebia "tive um
//  probleminha aqui agora". O corte foi de REDUNDÂNCIA e de anedota, nunca de
//  regra: instrução escrita duas ou três vezes com outras palavras virou uma
//  só, e o "já aconteceu de..." que explicava o porquê saiu (o porquê agora
//  mora neste comentário, que não custa token). O que a ferramenta já explica
//  no schema dela também saiu daqui, pra não pagar duas vezes pela mesma frase.
//  Se for mexer de novo: junte, não remova. Cada regra nasceu de um erro que
//  custou pedido ou dinheiro.
// ============================================================================

export type ConfigNegocio = {
  nome: string;
  cidade: string;
  horario: string; // texto livre, ex: "Seg a Sáb 6h30 às 20h, Dom 6h30 às 12h"
  endereco?: string;
  // rendimento e regras vêm do banco; aqui só o texto que a IA usa pra conversar
  prazoMinimoDias?: number;
  cobraSinal?: boolean;
};

// Config da Doce Pão (fallback do código; um tenant pode sobrescrever no banco).
// Horário e endereço confirmados pelo cardápio oficial. Prazo/sinal ainda a confirmar.
export const DOCE_PAO: ConfigNegocio = {
  nome: "Doce Pão",
  cidade: "Xanxerê, SC",
  // A rua PRIMEIRO, o bairro depois.
  //
  // Estava "Centro, Rua Independência 855, Xanxerê SC", e ela usava a linha
  // inteira dentro da frase, saindo "nosso endereço é na Centro, Rua
  // Independência 855, Xanxerê SC, no centro de Xanxerê". Bairro duas vezes e
  // a frase começando errada. Cliente idoso lendo isso estranha.
  endereco: "Rua Independência 855, Centro, Xanxerê SC",
  horario: "Segunda a sábado das 6h30 às 20h. Domingo e feriados das 6h30 às 12h e das 16h às 20h.",
  prazoMinimoDias: 2, // chute, confirmar com a dona
  cobraSinal: false, // chute, confirmar com a dona
};

// AQUI FICAVA `montarSystemPrompt`, 170 LINHAS SEM CHAMADOR NENHUM.
//
// Era o system prompt do cerebro antigo: a carta com persona, cardapio inteiro,
// quarenta regras e doze ferramentas, que ia em TODA mensagem. O cerebro foi
// apagado em 26/08/2026 e o prompt ficou, sem ninguem chamar. Ele levava junto o
// unico import deste arquivo (`catalogo-em-texto`), que tambem ficou orfao.
//
// Conferido antes de apagar: `montarSystemPrompt` nao aparecia em lugar nenhum
// do repositorio alem da propria declaracao -- nem em codigo, nem em teste, nem
// em documento.
//
// O que continua vivo aqui sao as duas coisas de cima: o tipo `ConfigNegocio` e
// a configuracao `DOCE_PAO`, que o `informacao.ts` usa pra responder horario e
// endereco e o `tenant.ts` pra montar a padaria do banco.
//
// POR QUE O DETECTOR DE CODIGO FANTASMA NAO PEGOU
//
// O `nada-de-codigo-fantasma` varria uma pasta escrita a mao (`lib/ia/fluxo`), e
// este arquivo mora um nivel acima. Mais uma lista minha, e desta vez dentro de
// um teste.
