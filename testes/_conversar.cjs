// ============================================================================
//  MANDAR UMA FALA E ESPERAR A PADARIA RESPONDER.
//
//  ESTE ARQUIVO EXISTE PORQUE NENHUM MEDIDOR DESTE PROJETO ESPERAVA RESPOSTA.
//
//  O `mede-uma-conversa.cjs` e o `medidor.cjs` faziam a mesma coisa:
//
//      for (const fala of FALAS) await ssh("/root/conversa.sh " + fone + " ...");
//
//  Dispara tudo em sequencia e le o banco no fim. A padaria responde de forma
//  assincrona, entao a ORDEM da conversa saia por sorte de latencia: as vezes a
//  resposta chegava entre duas falas, as vezes duas falas do cliente entravam
//  antes de qualquer resposta.
//
//  O DONO VIU ISSO NA TELA, em 30/08/2026, e a frase dele foi:
//
//      "nao ta legal esses teus testes nao cara (...) vc so ta disparando msg
//       aleatoria, nem espera a I.A responder, fica respondendo ela sem
//       contexto, com o disparo pronto q vc fez"
//
//  Ele estava certo, e o estrago e maior do que parece: TODA conclusao sobre a
//  qualidade da conversa passa por este instrumento. Medidor que nao conversa
//  mede outra coisa, e reprova ou aprova pelo motivo errado.
//
//  O QUE MUDA NA PRATICA
//
//  Com a espera, a conversa medida e a conversa que o cliente teria. E quando o
//  roteiro responde fora do assunto (o cliente diz a data quando perguntaram o
//  sabor, que acontece o tempo todo no WhatsApp de verdade), da pra VER que foi
//  isso, em vez de descobrir depois olhando o banco.
//
//  POR QUE NAO E TESTE, E POR ISSO COMECA COM `_`
//
//  O `todos.cjs` pula arquivo que comeca com `_`. Isto e ferramenta dos
//  medidores, e os medidores falam com o VPS: nao entram no portao.
// ============================================================================

/**
 * Monta o mandador pra uma conversa.
 *
 * `ssh` e `psql` vem de fora porque cada medidor ja tem os seus, apontando pro
 * mesmo servidor. Duplicar aqui seria um terceiro lugar decidindo qual banco e
 * o certo, e este projeto ja pagou caro por assunto decidido em dois lugares.
 */
function conversaCom({ ssh, psql, fone, aoResponder }) {
  const contar = () =>
    psql(
      "select count(*) from docepao.mensagens m join docepao.clientes c on c.id=m.cliente_id " +
        "where c.telefone='" + fone + "' and m.papel='assistant'",
    )
      .then((t) => Number(String(t).trim()) || 0)
      .catch(() => 0);

  // AS RESPOSTAS NOVAS, TODAS, E NAO SO A ULTIMA.
  //
  // A padaria manda DUAS mensagens quando a etapa tem cardapio: a pergunta e a
  // imagem. Lendo so a ultima, quem esta medindo ve "Cardapio de salgados" e
  // acha que ela mandou uma figura sem perguntar nada. Aconteceu comigo na
  // primeira conversa manual, em 30/08/2026, e eu quase abri defeito que nao
  // existia. Instrumento que mostra metade da resposta mente igual medidor que
  // nao espera.
  const novas = (quantas) =>
    psql(
      "select replace(coalesce(m.conteudo,''), chr(10), ' ') from (" +
        "select m.conteudo, m.criado_em from docepao.mensagens m " +
        "join docepao.clientes c on c.id=m.cliente_id " +
        "where c.telefone='" + fone + "' and m.papel='assistant' " +
        "order by m.criado_em desc limit " + Math.max(1, quantas) +
        ") m order by m.criado_em",
    )
      .then((t) => String(t).trim().split("\n").map((x) => x.trim()).filter(Boolean).join("\n            "))
      .catch(() => "");

  /**
   * Manda a fala e volta a resposta da padaria.
   *
   * ESPERA PELA CONTAGEM, e nao pelo texto: comparar com a resposta anterior
   * daria falso negativo quando a padaria repete a pergunta, que e justamente o
   * caso em que a conversa esta travada e a gente MAIS precisa enxergar.
   *
   * O teto e generoso porque a conversa de festa chama a IA duas vezes e passa
   * de vinte segundos. Estourar o teto NAO derruba a medicao: devolve o aviso e
   * segue, porque metade da conversa medida vale mais que nenhuma.
   */
  return async function mandar(texto, { tetoSegundos = 90 } = {}) {
    const antes = await contar();
    await ssh(
      "/root/conversa.sh " + fone + " '" + String(texto).replace(/'/g, "") + "' >/dev/null 2>&1",
    ).catch(() => null);

    const limite = Date.now() + tetoSegundos * 1000;
    while (Date.now() < limite) {
      await new Promise((r) => setTimeout(r, 2000));
      const agora = await contar();
      if (agora > antes) {
        // Espera mais um pouco: a pergunta e a imagem do cardapio sao duas
        // mensagens, e a segunda chega logo depois da primeira. Sem esta pausa
        // a leitura pega so a metade que chegou primeiro.
        await new Promise((r) => setTimeout(r, 2500));
        const resposta = await novas((await contar()) - antes);
        if (aoResponder) aoResponder(texto, resposta);
        return resposta;
      }
    }
    const aviso = "(a padaria nao respondeu em " + tetoSegundos + "s)";
    if (aoResponder) aoResponder(texto, aviso);
    return aviso;
  };
}

module.exports = { conversaCom };
