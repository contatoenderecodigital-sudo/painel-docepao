// ============================================================================
//  O TEXTO REDUZIDO AO JEITO QUE O SISTEMA COMPARA.
//
//  Sem acento, minusculo, aparado. Uma linha de codigo, e mesmo assim ela
//  estava escrita DEZESSEIS vezes espalhadas pelo cerebro. Contadas em
//  28/08/2026:
//
//      lib/ia/fluxo/fluxo.ts        7
//      lib/ia/fluxo/leitura.ts      4
//      e mais dez arquivos          1 cada
//
//  Copia nao fica igual. Elas ja divergiam:
//
//      duas nao chamavam .trim()          -> nome com espaco atras nao casava
//      uma usava ?? "" e as outras || ""  -> zero e falso viravam coisas
//                                            diferentes
//      uma trocava a ordem do toLowerCase
//
//  E o mesmo defeito do `ESPERA_MS` do webhook, que tinha 12 segundos num lugar
//  e 10 no outro. Valor decidido em mais de um lugar so fica igual enquanto
//  ninguem mexe.
//
//  A FAIXA DE ACENTOS VAI EM ESCAPE, E NAO NOS CARACTERES LITERAIS.
//
//  Os quinze lugares antigos escreviam os combinantes U+0300 a U+036F com os
//  proprios caracteres dentro da expressao. Funciona, e foi conferido nos
//  bytes. Mas sao caracteres invisiveis num editor, e qualquer ferramenta que
//  reescreva o arquivo noutra codificacao apaga a defesa sem deixar rastro.
// ============================================================================

/** Sem acento, minusculo e aparado. */
export const semAcento = (t: string) =>
  String(t || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
