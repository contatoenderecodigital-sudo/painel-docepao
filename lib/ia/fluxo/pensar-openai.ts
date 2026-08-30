// ============================================================================
//  A CHAMADA DA IA, DENTRO DA ETAPA
//
//  Esta e a unica parte do fluxo novo que gasta dinheiro, e e a menor de todas.
//
//  O QUE MUDA EM RELACAO A VERSAO ANTIGA
//
//  La ia a carta inteira em toda mensagem: persona, cardapio completo, regras,
//  historico, doze ferramentas. O modelo tinha que decidir o rumo da conversa,
//  escolher ferramenta, montar preco e escrever a resposta, e ainda respeitar
//  quarenta guardas que corrigiam depois.
//
//  Aqui ele recebe uma pergunta so: "estando NESTA etapa, o que esta frase
//  muda no pedido?". Nao ha ferramenta, nao ha laco, e a resposta e um JSON
//  pequeno.
//
//  A instrucao vai de 791 a 1874 caracteres, medidos em 28/08/2026 nas onze
//  etapas. Este comentario dizia "374 a 704", numero de uma versao que nao
//  existe mais, e ninguem tinha medido de novo desde entao. Quem cobra o
//  tamanho e o teste `o-docinho-so-e-docinho-na-etapa-dele`, que separa a REGRA
//  (minha, teto de 1400) do CARDAPIO (da dona, sem teto): o cardapio crescer
//  quando ela cadastra produto novo nao e defeito.
//
//  RESPOSTA EM FORMATO FIXO
//
//  response_format json_object: o modelo nao tem como devolver conversa no
//  lugar do dado. Se vier algo fora do esperado, a leitura sai vazia e o fluxo
//  segue perguntando — nunca inventa item.
// ============================================================================

import OpenAI from "openai";
import { SOBRE_O_QUE, SITUACOES, type Leitura } from "./leitura";
import { ETAPAS_DA_FESTA } from "./etapas";
import type { Pensar } from "./fluxo";

const MODELO = process.env.OPENAI_MODEL_FLUXO || "gpt-4.1-mini";

/**
 * O formato que o modelo tem que devolver. Nada alem disto e lido.
 *
 * E NADA QUE O CODIGO LE PODE FALTAR AQUI. Faltavam dois, achados lendo o
 * arquivo em 28/08/2026:
 *
 *   ehFesta        o limpador le na linha 132, e a instrucao da abertura manda
 *                  devolver. Mas este texto diz "responda NESTE formato" e
 *                  mostra um objeto completo sem o campo. Modelo que segue o
 *                  formato a risca nunca devolve, e sem `ehFesta` a conversa
 *                  pula a proposta da festa inteira.
 *   papelDeArroz   idem, linha 154. E papel de arroz e item cobrado.
 *
 * E o mesmo defeito que o comentario do `ehFesta` la embaixo descreve, so que
 * pelo outro lado: la a resposta certa morria na ENTRADA, aqui ela nunca era
 * pedida na SAIDA.
 */
const FORMATO = `Responda SÓ com um JSON, sem texto em volta, neste formato:

{
  "itens": [{ "produto": "nome do cardápio", "qtd": 0, "sabor": "só o recheio, uma palavra ou duas", "obs": "recado pra cozinha: o que NÃO é sabor" }],
  "pessoas": 0,
  "ehFesta": true,
  "aceitouBase": false,
  "delegaEscolha": false,
  "naoQuer": ["salgado"],
  "confirmou": true,
  "pecas": { "topo": true, "papelDeArroz": true },
  "aniversariante": { "nome": "Arthur", "idade": "5 anos" },
  "tema": "Minnie",
  "escrito": "Arthur, 5 anos",
  "perguntou": { "sobre": "preco", "familia": "salgado" },
  "situacao": "reclamacao",
  "forminha": "rosa",
  "prato": "aberto",
  "dados": { "nome": "", "data": "DD/MM/AAAA", "hora": "HH:MM", "pagamento": "pix" },
  "falouDeOutraEtapa": "bolo",
  "recomecar": false
}

Mande SÓ os campos que a mensagem mudou. Campo que não mudou, não mande.
Se a mensagem não mudou nada no pedido, mande {}.
Pedido novo vai em itens, nunca em confirmou. confirmou só aprova o resumo que o cliente já viu.
Delegou os tipos ou o sabor à casa? delegaEscolha true, sem itens.`;

/**
 * Monta a funcao que o fluxo chama pra pensar.
 *
 * `registrar` recebe o custo de cada chamada, pra medir sem depender de tabela
 * de preco: quem manda no numero e o uso que o proprio provedor devolve.
 */
export function pensarComOpenAI(
  cliente: OpenAI,
  registrar?: (uso: { tokensIn: number; tokensOut: number; cacheRead: number }) => void,
): Pensar {
  return async ({ instrucao, mensagem }) => {
    const r = await cliente.chat.completions.create({
      model: MODELO,
      // Temperatura baixa: aqui nao se quer criatividade, se quer leitura.
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: instrucao + "\n\n" + FORMATO },
        { role: "user", content: mensagem },
      ],
    }, {
      // O TURNO INTEIRO TEM 60 SEGUNDOS, E ESTA CHAMADA ESPERAVA DEZ MINUTOS.
      //
      // O SDK da OpenAI vem com 10 min de timeout e 2 tentativas. Nada aqui
      // dizia o contrario, entao uma chamada travada consumia o turno todo: o
      // Vercel mata a funcao, A IA JA FOI COBRADA e o cliente nao recebe nada.
      //
      // E o mesmo perigo que as duas esperas do webhook criavam antes de virarem
      // uma, e o arquivo 1 fez a conta: 22 parado + 30 de IA + 4 de "digitando"
      // dava 56 de 60.
      //
      // Com 15s e uma repeticao, o pior caso desta chamada e 30s. Sobram 20 pro
      // resto do turno, que e o que o resto do turno usa.
      timeout: 15000,
      maxRetries: 1,
    });

    const u = r.usage;
    registrar?.({
      tokensIn: u?.prompt_tokens ?? 0,
      tokensOut: u?.completion_tokens ?? 0,
      cacheRead: u?.prompt_tokens_details?.cached_tokens ?? 0,
    });

    const bruto = r.choices?.[0]?.message?.content ?? "{}";
    try {
      const lido = JSON.parse(bruto) as Leitura;
      // Campo vazio que o modelo mandou por educacao nao vira mudanca: "dados"
      // com tudo null apagaria o que ja estava anotado.
      const limpo: Leitura = {};
      if (Array.isArray(lido.itens) && lido.itens.length) {
        // QUANTIDADE ZERO E RESPOSTA, NAO LIXO.
        //
        // Na festa o cliente escolhe o SABOR e o numero ja foi combinado na
        // proposta: "quero coxinha, risoles e esfirra" nao tem quantidade
        // nenhuma, e antes esses tres itens eram jogados fora aqui. Quem
        // reparte o total da proposta entre eles e o fluxo, depois.
        //
        // Numero negativo continua fora: isso nao e resposta de ninguem.
        // ITEM SEM QUANTIDADE NAO E LIXO, E ITEM SEM QUANTIDADE.
        //
        // A conferida era `Number(i.qtd) >= 0`, e `Number(undefined)` e NaN, que
        // nao e maior nem igual a nada. Item que o modelo devolvesse sem o campo
        // `qtd` era JOGADO FORA em silencio:
        //
        //   {"produto":"coxinha"}   ->  sumia
        //
        // Duas linhas abaixo, `Number(i.qtd) || 0` ja sabia tratar isso e virava
        // zero. E zero e resposta legitima: na festa o total ja foi combinado na
        // proposta e o cliente so escolhe o sabor, que e o que o comentario
        // aqui em cima explica.
        //
        // Negativo continua fora. Isso nao e resposta de ninguem.
        limpo.itens = lido.itens
          .filter((i) => i && String(i.produto ?? "").trim() && !(Number(i.qtd) < 0))
          .map((i) => ({
            produto: String(i.produto).trim(),
            qtd: Number(i.qtd) || 0,
            // O SABOR VEM SEPARADO DO RECADO, e os dois seguem inteiros.
            //
            // Ate 27/08/2026 tudo vinha misturado num campo so ("sabor, cor,
            // tema"), e por isso o codigo nao tinha como conferir o sabor
            // contra o cardapio sem arriscar comer recado de verdade:
            //
            //   "coxinha de camarao"              a casa nao faz camarao
            //   "coxinha sem cebola"              a cozinha PRECISA ler isto
            //
            // Separar nao e regra nova nem lista de palavras: e dar um lugar
            // pra IA dizer o que ela ja entendeu. Medido contra ela, ela separa
            // sozinha. O codigo confere SO o sabor, contra o catalogo, e o
            // recado passa intocado.
            sabor: i.sabor ? String(i.sabor).trim() : null,
            // O mesmo tratamento do sabor. Sem `String()`, um objeto que o
            // modelo devolvesse aqui chegava na comanda como "[object Object]".
            obs: i.obs ? String(i.obs).trim() || null : null,
          }));
        if (!limpo.itens.length) delete limpo.itens;
      }
      // "VOU FAZER UMA FESTA" MORRIA AQUI.
      //
      // Achado pelo teste o-cliente-sempre-tem-saida em 23/08/2026, e era dos
      // grandes: aplicar() le ehFesta, e este limpador nunca copiava. Quem
      // dissesse "festa de aniversario do meu filho" sem falar em quantas
      // pessoas nao virava festa nenhuma, e a conversa pulava a proposta e ia
      // direto perguntar dia e hora de retirada.
      //
      // Meia entrada de festa entrava pelo numero de pessoas, que sobrevivia. A
      // outra metade, pela palavra, se perdia inteira.
      if (lido.ehFesta === true) limpo.ehFesta = true;
      if (Number(lido.pessoas) > 0) limpo.pessoas = Number(lido.pessoas);
      if (lido.aceitouBase === true) limpo.aceitouBase = true;
      if (lido.delegaEscolha === true) limpo.delegaEscolha = true;
      if (lido.recomecar === true) limpo.recomecar = true;
      // SEM ESTA LINHA O "pode fechar" DELE MORRIA AQUI.
      //
      // Este limpador e uma lista fechada: campo que nao esta escrito aqui e
      // jogado fora, mesmo que o modelo tenha acertado. E o defeito que mais se
      // repetiu neste projeto, sempre no mesmo formato: uma camada minha
      // comendo a resposta certa da outra.
      if (lido.confirmou === true) limpo.confirmou = true;
      if (Array.isArray(lido.naoQuer) && lido.naoQuer.length) {
        limpo.naoQuer = lido.naoQuer.map(String).filter(Boolean);
      }
      // SO O QUE ELE FALOU ENTRA.
      //
      // Antes isto virava true ou false pros dois campos sempre, e um "quero o
      // topo" respondia por ele que nao queria papel de arroz. Campo ausente
      // agora fica ausente, e quem decide o que fazer com isso e o fluxo.
      if (lido.pecas && typeof lido.pecas === "object") {
        const pec: NonNullable<Leitura["pecas"]> = {};
        if (typeof lido.pecas.topo === "boolean") pec.topo = lido.pecas.topo;
        if (typeof lido.pecas.papelDeArroz === "boolean") pec.papelDeArroz = lido.pecas.papelDeArroz;
        if (Object.keys(pec).length) limpo.pecas = pec;
      }
      if ((SITUACOES as readonly string[]).includes(String(lido.situacao))) {
        limpo.situacao = lido.situacao;
      }
      // O QUE VEM DE FORA E CONFERIDO CONTRA A LISTA, E NAO SO TIPADO.
      //
      // `situacao` e `prato` logo aqui em volta ja eram conferidos valor por
      // valor. `perguntou.sobre` nao: qualquer texto virava um `SobreOQue`, e o
      // tipo passou a mentir a partir dali. Uniao de tipo o compilador apaga; o
      // que chega aqui e texto que o modelo escreveu.
      if (lido.perguntou?.sobre && (SOBRE_O_QUE as readonly string[]).includes(lido.perguntou.sobre)) {
        limpo.perguntou = {
          sobre: lido.perguntou.sobre,
          ...(lido.perguntou.familia ? { familia: String(lido.perguntou.familia) } : {}),
        };
      }
      if (String(lido.tema ?? "").trim()) limpo.tema = String(lido.tema).trim();
      if (String(lido.escrito ?? "").trim()) limpo.escrito = String(lido.escrito).trim();
      if (String(lido.forminha ?? "").trim()) limpo.forminha = String(lido.forminha).trim();
      if (lido.prato === "aberto" || lido.prato === "tampa") limpo.prato = lido.prato;
      if (lido.aniversariante && typeof lido.aniversariante === "object") {
        const a: NonNullable<Leitura["aniversariante"]> = {};
        const nome = String(lido.aniversariante.nome ?? "").trim();
        const idade = String(lido.aniversariante.idade ?? "").trim();
        if (nome) a.nome = nome;
        if (idade) a.idade = idade;
        if (Object.keys(a).length) limpo.aniversariante = a;
      }
      if (lido.dados && typeof lido.dados === "object") {
        const d: NonNullable<Leitura["dados"]> = {};
        for (const k of ["nome", "data", "hora", "pagamento"] as const) {
          const v = String(lido.dados[k] ?? "").trim();
          if (v) d[k] = v;
        }
        if (Object.keys(d).length) limpo.dados = d;
      }
      // A ETAPA CITADA TEM QUE EXISTIR.
      //
      // Isto aceitava qualquer texto como `EtapaId`. O fluxo entao gravava
      // `assunto` e `retomarEm` apontando pra uma etapa que nao existe. A
      // conversa se cura sozinha na mensagem seguinte (o fluxo nao acha a etapa
      // e limpa o assunto), mas gasta uma mensagem do cliente pra isso, e
      // `retomarEm` fica apontando pra um lugar de onde ninguem saiu.
      //
      // A lista sai de `etapas.ts`, que e onde etapa se cadastra.
      if (lido.falouDeOutraEtapa && ETAPAS_DA_FESTA.some((x) => x.id === lido.falouDeOutraEtapa)) {
        limpo.falouDeOutraEtapa = lido.falouDeOutraEtapa;
      }
      return limpo;
    } catch {
      // JSON quebrado nao trava a conversa: o fluxo segue perguntando o mesmo,
      // e isso e melhor que anotar lixo no pedido de alguem.
      console.warn("[fluxo] o modelo devolveu algo que nao e JSON; ignorei:", bruto.slice(0, 160));
      return {};
    }
  };
}
