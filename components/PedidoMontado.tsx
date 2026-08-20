"use client";

// ============================================================================
//  PEDIDO MONTADO: o pedido tomando forma no meio da conversa.
//
//  A IA anota aqui o que o cliente vai decidindo, item por item. Serve pra duas
//  coisas ao mesmo tempo: é a memória dela (não precisa remontar o pedido a
//  cada mensagem) e é onde a equipe corrige na mão sem ter que pedir pro
//  cliente repetir. O que a dona arruma aqui a IA passa a usar na conversa.
//
//  Fica acima do campo de digitar porque é ali que a equipe olha antes de
//  responder alguma coisa. Recolhido mostra só o resumo; aberto dá pra editar.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Plus, Minus, Trash2, Check, Square, CheckSquare, Pencil, TriangleAlert } from "lucide-react";
import { brl } from "@/lib/tipos";

// Quantidade do jeito que a padaria escreve: 1,5 kg, nunca 1.5kg. A fila de
// aprovacao ja mostrava com virgula e aqui saia com ponto, entao o mesmo pedido
// parecia dois na hora de conferir.
const qtdBR = (n: number) => String(Number(n) || 0).replace(".", ",");

// O resumo recolhido mora numa coluna estreita, e pedido de festa tem oito
// linhas. Corta no fim, na ultima palavra que coube, e marca com reticencias que
// ainda tem item. O corte e sempre no FIM: a unidade vem logo depois da
// quantidade, no comeco de cada item, entao ela nunca e o que sobra de fora.
// O PAPEL DE ARROZ DO BOLO NAO E UM ITEM SOLTO: E O BOTAO DO BOLO LIGADO.
//
// A linha existe no pedido porque o papel de arroz PRECISA ser cobrado (sao
// R$ 12 que, sem linha, viram prejuizo na producao). So que quem manda nela e a
// caixa de marcar do bolo, e ter as duas coisas editaveis na tela criava um
// pedido que se contradiz.
//
// So esconde quando existe um BOLO pedindo papel de arroz. Papel de arroz
// vendido sozinho, sem bolo nenhum, continua sendo item normal.
function ehPapelDerivado(x: { produto: string }, todos: { produto: string; obs?: string | null }[]): boolean {
  const nome = String(x.produto || "").trim().toLowerCase();
  if (!/^papel de arroz$/.test(nome)) return false;
  return todos.some(
    (o) =>
      /^bolo/i.test(String(o.produto || "").trim()) &&
      /papel de arroz/i.test(String(o.obs || "")) &&
      !/sem papel/i.test(String(o.obs || "")),
  );
}

function cortarResumo(t: string, max: number) {
  if (t.length <= max) return t;
  const corte = t.slice(0, max);
  const espaco = corte.lastIndexOf(" ");
  return (espaco > max * 0.6 ? corte.slice(0, espaco) : corte).replace(/[\s,]+$/, "") + "...";
}

// O pedido ja fechado deste cliente, esperando a aprovacao.
type Registrado = {
  id: string;
  status: string;
  clienteNome: string | null;
  formaPagamento: string | null;
  observacoes: string | null;
  totalCentavos: number;
  retiradaData: string | null;
  retiradaHora: string | null;
  itens: { produto: string; categoria: string; qtd: number; unidade: string; obs: string | null }[];
};

type Categoria =
  | "bolo_festa" | "bolo_caseiro" | "docinho" | "salgado_frito" | "salgado_assado"
  | "pizza" | "por_quilo" | "por_unidade" | "cupcake" | "papel_de_arroz" | "outro";

type Unidade = "un" | "kg";
type Item = { produto: string; categoria: Categoria; qtd: number; unidade: Unidade; obs?: string | null };

// Como a padaria fala de cada unidade, e quais valem em cada familia. Bolo de
// festa e por quilo, docinho e salgado por unidade; so o que e vendido dos dois
// jeitos mostra escolha.
const ROTULO_UNIDADE: Record<Unidade, string> = { un: "unidades", kg: "quilos" };
const UNIDADES_POR_CATEGORIA: Record<Categoria, Unidade[]> = {
  bolo_festa: ["kg"],
  bolo_caseiro: ["un"],
  docinho: ["un"],
  salgado_frito: ["un"],
  salgado_assado: ["un"],
  pizza: ["un", "kg"],
  por_quilo: ["kg"],
  por_unidade: ["un"],
  cupcake: ["un"],
  papel_de_arroz: ["un"],
  outro: ["un", "kg"],
};
const unidadesDe = (c: Categoria): Unidade[] => UNIDADES_POR_CATEGORIA[c] ?? ["un", "kg"];
type Dados = {
  cliente_nome?: string | null;
  retirada_data?: string | null;
  retirada_hora?: string | null;
  forma_pagamento?: string | null;
  observacoes?: string | null;
};

// Nome de produto se repete entre categorias (brigadeiro é docinho e é sabor de
// bolo), então a categoria aparece na tela junto do item, não escondida.
// escolhivel: false sai do seletor mas continua valendo como rotulo do que ja
// esta gravado. Papel de arroz e topo NAO se escolhe aqui: eles vem da caixa de
// marcar do bolo, que e a unica fonte da verdade. Deixar na lista era convidar a
// equipe a criar um papel de arroz solto, que a cozinha nao sabe de qual bolo e.
const CATEGORIAS: { id: Categoria; rotulo: string; porQuilo?: boolean; escolhivel?: boolean }[] = [
  { id: "bolo_festa", rotulo: "Bolo de festa", porQuilo: true },
  { id: "bolo_caseiro", rotulo: "Bolo caseiro" },
  { id: "docinho", rotulo: "Docinho" },
  { id: "salgado_frito", rotulo: "Salgado frito" },
  { id: "salgado_assado", rotulo: "Salgado assado" },
  { id: "pizza", rotulo: "Pizza" },
  { id: "cupcake", rotulo: "Cupcake" },
  { id: "papel_de_arroz", rotulo: "Papel de arroz", escolhivel: false },
  { id: "por_quilo", rotulo: "Por quilo", porQuilo: true },
  { id: "por_unidade", rotulo: "Por unidade" },
  { id: "outro", rotulo: "Outro" },
];

const rotuloCat = (c: Categoria) => CATEGORIAS.find((x) => x.id === c)?.rotulo ?? "Outro";

const CAMPOS: { chave: keyof Dados; rotulo: string; dica: string }[] = [
  { chave: "cliente_nome", rotulo: "Nome de quem retira", dica: "ex: Vinicius" },
  { chave: "retirada_data", rotulo: "Data da retirada", dica: "ex: 20/08" },
  { chave: "retirada_hora", rotulo: "Hora", dica: "ex: 14h" },
  { chave: "forma_pagamento", rotulo: "Pagamento", dica: "ex: pix" },
  { chave: "observacoes", rotulo: "Observação geral", dica: "ex: entregar na portaria" },
];

// Sem largura no base: quem usa define. Com `w-full` aqui, o campo de
// quantidade esticava por cima da linha inteira e o produto saía da tela.
// A lista aberta do select e desenhada pelo sistema, nao pela pagina: sem cor
// explicita ela sai branca no branco e a dona nao consegue ler a opcao.
const OPCAO = { background: "#3d1219", color: "#fff7eb" } as const;

// As cores de forminha do cardapio, pra dona clicar em vez de digitar. Cor
// escrita errada nao casa com o que a cozinha usa.
const CORES_FORMINHA = [
  "amarelo", "amarelo neon", "azul", "azul bebê", "azul royal", "branca", "dourada",
  "laranja", "laranja neon", "lilás", "marrom", "pink", "prata", "preta", "rosa",
  "rosa claro", "roxo", "roxo neon", "verde bandeira", "verde tiffany", "vermelha",
];

const campo =
  "min-w-0 bg-white/8 rounded-lg px-2.5 py-2 text-[13px] text-cream placeholder:text-cream/35 focus:outline-none focus:ring-2 focus:ring-cobre/25 border border-white/8";

type OpcaoCardapio = { nome: string; categoria: Categoria; unidade: Unidade; sabores: string[] };

// Do nome do produto pra categoria da tela. O cardapio manda; a tabela abaixo
// e so pro que a equipe lancou na mao e nao existe no cardapio.
const semAcento = (t: string) =>
  String(t || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// O nome gravado no item quase nunca bate letra a letra com o do cardapio: a IA
// grava "risolis" sem acento, e "cuca recheada de banana" com o sabor colado no
// nome. Casando so pelo texto exato, esses itens ficavam sem os chips de sabor
// e a equipe voltava a digitar o recheio na mao.
// A ordem e sempre esta, e o sentido nunca inverte:
// 1. nome igual (sem acento) ganha de tudo. "empadao" e "empadao", ponto.
// 2. sem igual, vale o nome do CARDAPIO que cabe dentro do gravado, porque o
//    gravado e que vem mais comprido: "cuca recheada de banana" e "cuca
//    recheada". Entre varios, ganha o mais longo, senao essa mesma cuca cairia
//    em "cuca", que nao tem sabor nenhum.
// 3. NUNCA o contrario. Se um nome de cardapio mais comprido que o gravado
//    pudesse ganhar, "empadao" cairia na ficha de "empadao com palmito", que e
//    outro produto (R$ 39,90 o quilo contra R$ 34,90), e o painel ofereceria
//    palmito num empadao de frango. Por isso o teste e sempre gravado
//    startsWith cardapio, e nunca ao contrario.
function doCardapio(cardapio: OpcaoCardapio[], produto: string): OpcaoCardapio | undefined {
  const n = semAcento(produto);
  if (!n) return undefined;
  const exato = cardapio.find((c) => semAcento(c.nome) === n);
  if (exato) return exato;
  let melhor: OpcaoCardapio | undefined;
  let melhorTam = 0;
  for (const c of cardapio) {
    const alvo = semAcento(c.nome);
    // O nome do cardapio tem que terminar palavra dentro do gravado, senao
    // "pao de x" casaria com "pao de xis".
    if (!alvo || !n.startsWith(alvo) || /[a-z0-9]/.test(n.charAt(alvo.length))) continue;
    if (alvo.length > melhorTam) {
      melhor = c;
      melhorTam = alvo.length;
    }
  }
  return melhor;
}
// SABOR EM FALTA: UM PEDIDO REAL FOI PRA COZINHA CEGO.
// Hoje fechou um pedido com "cuca recheada: 3 un" e nenhum sabor escolhido, e
// o ticket saiu assim. Ninguem assa uma cuca sem saber o recheio, e a cliente
// so ia descobrir na hora da retirada. Quem sabe se o item precisa de sabor e o
// proprio cardapio: se o produto tem lista de sabores e nenhum deles aparece na
// observacao, o item esta sem recheio definido.
function saboresDe(cardapio: OpcaoCardapio[], produto: string): string[] {
  return doCardapio(cardapio, produto)?.sabores ?? [];
}

function semSaborEscolhido(cardapio: OpcaoCardapio[], it: Item): boolean {
  const ops = saboresDe(cardapio, it.produto);
  if (!ops.length) return false;
  const obs = (it.obs ?? "").toLowerCase();
  return !ops.some((sab) => obs.includes(sab.toLowerCase()));
}

const DO_MOTOR: Record<string, Categoria> = {
  doce: "docinho",
  salgado: "salgado_frito",
  bolo_recheado: "bolo_festa",
  bolo_caseiro: "bolo_caseiro",
  adicional_bolo: "papel_de_arroz",
  pizza: "pizza",
};
// A categoria usa exatamente o mesmo casamento do sabor. Aqui a busca aceitava
// tambem o nome do cardapio que CONTINHA o gravado, que e a direcao proibida:
// "empadao" achava "empadao com palmito" e o item ia parar na ficha do produto
// mais caro. Quando nao da pra ter certeza, a familia que o motor gravou no
// pedido vale mais do que um palpite pelo nome.
function categoriaDaTela(produto: string, doMotor: string, cardapio: OpcaoCardapio[]): Categoria {
  const achado = doCardapio(cardapio, produto);
  if (achado) return achado.categoria;
  if (CATEGORIAS.some((c) => c.id === doMotor)) return doMotor as Categoria;
  return DO_MOTOR[doMotor] ?? "outro";
}

// Como vem gravado o item, antes de virar linha da tela. A categoria aqui e a
// familia que o motor escreveu no pedido ("padaria", "calzone"), que nao e a
// mesma lista de rotulos que a equipe ve.
type ItemGravado = {
  produto: string;
  categoria: string;
  qtd: number | string;
  unidade?: string | null;
  obs?: string | null;
};

// A CATEGORIA E A UNIDADE TEM QUE SAIR DA MESMA FONTE.
// A cuca recheada do pedido da Cristina estava gravada como categoria "padaria"
// com unidade "un". A tela pegava a categoria pelo cardapio (onde a cuca virou
// POR QUILO em 16/08/2026) e a unidade pelo banco: o seletor dizia "Por quilo" e
// a linha de baixo, do mesmo item, dizia "unidades". Mesmo desencontro no
// cachorro-quente e no calzone, os dois por quilo no cardapio. Aqui o cardapio
// manda nas duas coisas, entao rotulo e unidade nunca mais se contradizem; so o
// que nao existe no cardapio (lancado na mao) mantem a unidade gravada, e mesmo
// assim so se a familia aceitar ela.
function itemDaTela(x: ItemGravado, cardapio: OpcaoCardapio[]): Item {
  const achado = doCardapio(cardapio, x.produto);
  const categoria = categoriaDaTela(x.produto, x.categoria, cardapio);
  const gravada: Unidade = x.unidade === "kg" ? "kg" : "un";
  const permitidas = unidadesDe(categoria);
  const unidade = achado ? achado.unidade : permitidas.includes(gravada) ? gravada : permitidas[0];
  return {
    produto: x.produto,
    categoria,
    qtd: Number(x.qtd) || 0,
    unidade,
    obs: x.obs ?? null,
  };
}

export default function PedidoMontado({ clienteId, versao }: { clienteId: string; versao: number }) {
  const [aberto, setAberto] = useState(false);
  const [cardapio, setCardapio] = useState<OpcaoCardapio[]>([]);
  const [foto, setFoto] = useState<string | null>(null);
  const [itens, setItens] = useState<Item[]>([]);
  const [brutos, setBrutos] = useState<ItemGravado[]>([]);
  const [dados, setDados] = useState<Dados>({});
  const [registrado, setRegistrado] = useState<Registrado | null>(null);
  const [sujo, setSujo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  // Depois de corrigir, a equipe precisa saber que assumiu a conversa: sem
  // isso ela salva, sai da tela e acha que a Dora continua fechando sozinha.
  const [assumiuConversa, setAssumiuConversa] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const r = await fetch(`/api/montagem?cliente=${encodeURIComponent(clienteId)}`, { cache: "no-store" });
      if (!r.ok) return;
      const j = await r.json();
      const reg: Registrado | null = j.registrado ?? null;
      const daMontagem: ItemGravado[] = Array.isArray(j.itens) ? j.itens : [];
      setRegistrado(reg);
      // Guarda como veio: quem traduz pra linha da tela e o efeito abaixo, que
      // depende do cardapio. O cardapio chega por outra requisicao, e a montagem
      // costuma chegar primeiro; normalizando aqui, a cuca ficava com a unidade
      // do banco pra sempre porque nada reprocessava quando o cardapio chegasse.
      setBrutos(daMontagem);
      setDados(j.dados ?? {});
      // A foto de referencia do tema, pra dona conferir o bolo olhando pra ela.
      fetch(`/api/montagem/foto?cliente=${encodeURIComponent(clienteId)}`)
        .then((x) => x.json())
        .then((y) => setFoto(y.foto ?? null))
        .catch(() => {});
    } catch {
      /* silencioso: o painel é auxiliar, não pode quebrar o chat */
    }
  }, [clienteId]);

  // O cardápio inteiro, uma vez só: é ele que oferece o produto e os sabores
  // prontos, pra equipe não digitar nome que não casa com a tabela de preço.
  useEffect(() => {
    fetch("/api/cardapio/opcoes")
      .then((r) => r.json())
      .then((j) => setCardapio(Array.isArray(j.produtos) ? j.produtos : []))
      .catch(() => {});
  }, []);

  // Troca de conversa zera tudo. E enquanto a equipe está editando, a
  // atualização automática não entra por cima do que ela está digitando.
  //
  // Um efeito só de propósito: eram dois, e na abertura os dois disparavam
  // juntos, batendo duas vezes em /api/montagem por conversa aberta.
  const clienteAnterior = useRef<string>("");
  const versaoCarregada = useRef<string>("");
  useEffect(() => {
    if (clienteAnterior.current !== clienteId) {
      clienteAnterior.current = clienteId;
      setSujo(false);
      setSalvo(false);
      setItens([]);
      setBrutos([]);
      setDados({});
      setRegistrado(null);
    }
    // Editando na mão: a carga automática esperaria, senão apagaria o que a
    // equipe está digitando no meio da correção.
    if (sujo) return;
    const chave = clienteId + ":" + versao;
    if (versaoCarregada.current === chave) return;
    versaoCarregada.current = chave;
    carregar();
  }, [clienteId, versao, sujo, carregar]);

  // A montagem gravada vira linha de tela aqui, e nao na hora de buscar, porque
  // depende do cardapio: e ele que diz a categoria e a unidade de cada produto.
  // Enquanto a equipe esta editando, nada entra por cima do que ela digitou.
  useEffect(() => {
    if (sujo) return;
    setItens(brutos.map((x) => itemDaTela(x, cardapio)));
  }, [brutos, cardapio, sujo]);

  // O pedido ja fechado preenche o mesmo editor. Depende do cardapio porque e
  // ele que diz a categoria de cada produto, e ele chega por outra requisicao.
  useEffect(() => {
    if (!registrado || sujo) return;
    // O que ja foi combinado no pedido preenche os campos: quem retira, quando
    // e como paga estao no pedido, nao na montagem (que foi limpa no fechamento).
    setDados((d) => ({
      cliente_nome: d.cliente_nome || registrado.clienteNome || null,
      retirada_data: d.retirada_data || registrado.retiradaData || null,
      retirada_hora: d.retirada_hora || registrado.retiradaHora || null,
      forma_pagamento: d.forma_pagamento || registrado.formaPagamento || null,
      observacoes: d.observacoes || registrado.observacoes || null,
    }));
    setItens(registrado.itens.map((x) => itemDaTela(x, cardapio)));
  }, [registrado, cardapio, sujo]);

  function mexerItem(i: number, patch: Partial<Item>) {
    setItens((p) => p.map((x, k) => (k === i ? { ...x, ...patch } : x)));
    setSujo(true);
    setSalvo(false);
  }

  function mexerDados(chave: keyof Dados, valor: string) {
    setDados((p) => ({ ...p, [chave]: valor }));
    setSujo(true);
    setSalvo(false);
  }

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      const limpos = itens
        .filter((x) => x.produto.trim() !== "" && x.qtd > 0)
        // O PAPEL DE ARROZ E CONSEQUENCIA DO BOTAO DO BOLO, NAO UM ITEM SOLTO.
        //
        // Ele aparecia duas vezes na tela: marcado no bolo e como linha propria
        // embaixo. Pior que confundir quem aprova, isso cobrava errado: o motor
        // so CRIA a linha do papel de arroz, nunca tira. Desmarcar o botao no
        // bolo tirava a palavra da observacao, mas a linha ia junto no salvamento
        // e os R$ 12 continuavam no total, pra sempre.
        //
        // Agora a linha nao e enviada. O servidor recria ela a partir da
        // observacao do bolo: marcado, cobra; desmarcado, some. Uma fonte da
        // verdade so, que e o botao que a pessoa clica.
        .filter((x) => !ehPapelDerivado(x, itens))
        .map((x) => ({ ...x, produto: x.produto.trim(), obs: x.obs?.trim() || null }));
      const r = await fetch("/api/montagem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clienteId, pedidoId: registrado?.id, itens: limpos, dados }),
      });
      if (!r.ok) {
        const e = (await r.json().catch(() => ({}))) as { erro?: string; produtos?: string[] };
        if (e.erro === "sem_preco") {
          setErro(
            "Sem preço no cardápio: " + (e.produtos ?? []).join(", ") +
              ". Escolha o produto pela lista pra ele entrar no total.",
          );
        } else if (e.erro === "ja_aprovado") {
          setErro(
            "Este pedido já foi aprovado e a comanda saiu na cozinha, então não dá mais pra corrigir por aqui. " +
              "Fale com quem está na produção antes que ele seja montado.",
          );
        } else {
          setErro("Não deu pra salvar agora. Tente de novo.");
        }
        throw new Error("falhou");
      }
      // O total muda quando a equipe mexe: a tela mostra o novo, nao o antigo.
      const j = await r.json().catch(() => ({}) as { totalCentavos?: number; assumiu?: boolean });
      if ((j as { assumiu?: boolean }).assumiu) setAssumiuConversa(true);
      if (registrado && typeof j.totalCentavos === "number") {
        setRegistrado({ ...registrado, totalCentavos: j.totalCentavos });
      }
      // O gravado passa a ser o que acabou de sair daqui. Sem isso, largar o
      // "não salvo" fazia o efeito acima remontar a lista a partir do que o
      // servidor tinha ANTES da correcao, e a tela piscava o pedido velho ate a
      // releitura chegar.
      setItens(limpos);
      setBrutos(limpos);
      setSujo(false);
      setSalvo(true);
      // A gravacao pode mudar a lista (papel de arroz da observacao entra como
      // item): a tela le de volta o que ficou gravado, nao o que ela mandou.
      versaoCarregada.current = "";
      carregar();
      setTimeout(() => setSalvo(false), 2500);
    } catch {
      setSalvo(false);
    } finally {
      setSalvando(false);
    }
  }

  // Aprovado quer dizer impresso: a cozinha ja recebeu o papel e o pedido nao
  // muda mais por aqui.
  const travado = !!registrado && registrado.status !== "confirmado";
  const preenchidos = CAMPOS.filter((c) => (dados[c.chave] ?? "").toString().trim() !== "").length;
  const vazio = itens.length === 0 && preenchidos === 0;

  // Quem desce ate o fim do painel nao ve mais o item la de cima. O contador
  // fica no topo do bloco pra equipe saber que existe buraco antes de salvar,
  // como no dia da cuca sem recheio.
  const itensSemSabor = itens.filter(
    (x) => x.produto.trim() !== "" && semSaborEscolhido(cardapio, x),
  ).length;

  // RESUMO RECOLHIDO: e o que a Cristina le sem abrir o painel.
  // Saia "100 coxinha, 100 esfirra" e "3 cuca recheada". A unidade so aparecia
  // no item por quilo ("1,5 kg cachorro-quente"), entao ela nao sabia se eram 3
  // unidades ou 3 quilos de cuca, e o sabor nao aparecia nunca: a cuca de
  // chocolate ficava igualzinha a de abacaxi ali na linha. Agora todo item leva
  // unidade e sabor.
  const linhaResumo = (x: Item) => {
    const obs = semAcento(x.obs ?? "");
    const nome = semAcento(x.produto);
    // Sabor que ja esta no nome ("cuca recheada de banana") nao repete, senao a
    // linha saia "cuca recheada de banana de banana".
    const sabores = saboresDe(cardapio, x.produto).filter(
      (s) => obs.includes(semAcento(s)) && !nome.includes(semAcento(s)),
    );
    return `${qtdBR(x.qtd)} ${x.unidade} ${x.produto}${sabores.length ? " de " + sabores.join(" e ") : ""}`;
  };
  const resumo = itens.length
    ? cortarResumo(itens.map(linhaResumo).join(", "), 96)
    : "só os dados por enquanto";

  // Quando retira e quanto deu: é o que a equipe procura de relance, e antes só
  // aparecia depois de abrir o painel. Recolhido mostrava só os itens, então
  // pra saber a hora da retirada tinha que expandir conversa por conversa.
  const quandoETotal = registrado
    ? [
        [registrado.retiradaData, registrado.retiradaHora ? `às ${registrado.retiradaHora}` : ""]
          .filter(Boolean)
          .join(" "),
        `total ${brl(registrado.totalCentavos)}`,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  return (
    <div>
      <button
        onClick={() => setAberto((v) => !v)}
        className="w-full flex items-center gap-2 text-left"
        aria-expanded={aberto}
      >
        <span className="t-label text-cream/45 flex-1 min-w-0">Pedido montado</span>
        {sujo && (
          <span className="text-[11px] shrink-0" style={{ color: "#e7cf94" }}>
            não salvo
          </span>
        )}
        <ChevronDown
          size={16}
          className="text-cream/45 shrink-0 transition-transform"
          style={{ transform: aberto ? "rotate(180deg)" : undefined }}
        />
      </button>

      {/* Recolhido, o que a equipe precisa bater o olho e seguir: quando retira,
          quanto deu e o que vai sair. */}
      {!aberto && (
        <div className="mt-2 leading-snug">
          {registrado && (
            <p className="text-[12px] font-medium" style={{ color: "#e7cf94" }}>
              Fechado{quandoETotal ? " " + quandoETotal : ""}
            </p>
          )}
          <p className="text-[12px] text-cream/60">
            {registrado ? resumo : vazio ? "Nada anotado ainda." : resumo}
          </p>
          {registrado && !travado && (
            <p className="text-[11px] text-cream/45 mt-0.5">Dá pra corrigir até imprimir.</p>
          )}
        </div>
      )}

      {/* Fechado e ainda em curso: a cozinha so fica sabendo quando o ticket
          imprime, entao ate la a equipe arruma o pedido aqui mesmo. */}
      {aberto && registrado && (
        <div className="mt-2.5 rounded-lg border border-cream/12 px-2.5 py-2">
          <p className="t-label text-cream/45">
            {travado ? "Pedido na cozinha" : "Pedido fechado"}{registrado.retiradaData ? ` pra ${registrado.retiradaData}` : ""}
            {registrado.retiradaHora ? ` às ${registrado.retiradaHora}` : ""}
          </p>
          <p className="text-[12px] mt-1 font-medium" style={{ color: "#e7cf94" }}>
            Total {brl(registrado.totalCentavos)}
          </p>
          {/* "Fechado" faz a equipe achar que nao pode mais mexer e ela sai
              ligando pra cozinha pra corrigir. Nada aqui fica desabilitado, so
              que isso precisa estar escrito na tela pra ela ter coragem de
              editar. */}
          {!travado && (
            <span
              className="inline-flex items-center gap-1.5 mt-1.5 px-2 h-6 rounded-full text-[11px] font-medium"
              style={{ background: "rgba(231,207,148,0.16)", color: "#e7cf94", border: "1px solid rgba(231,207,148,0.35)" }}
            >
              <Pencil size={11} /> Dá pra corrigir até imprimir
            </span>
          )}
          <p className="text-[11px] text-cream/45 mt-1 leading-snug">
            {travado
              ? "Já foi aprovado e impresso pra cozinha. Aqui fica só pra consulta, com tudo que foi combinado."
              : "O que você mudar aqui vale no pedido. Ele sai da tela quando a aprovação imprimir o ticket."}
          </p>
        </div>
      )}

      {aberto && travado && (
        <ul className="mt-2 flex flex-col gap-1">
          {/* O papel de arroz derivado do bolo nao vira linha editavel: quem
              manda nele e a caixa de marcar do bolo. O indice original e
              preservado porque mexerItem(i) aponta pra lista de verdade. */}
          {itens
            .map((x, i) => ({ x, i }))
            .filter(({ x }) => !ehPapelDerivado(x, itens))
            .map(({ x, i }) => (
            <li key={i} className="text-[12px] text-cream/75 leading-snug">
              {qtdBR(x.qtd)} {x.unidade === "kg" ? "kg" : "un"} de {x.produto}
              {x.obs ? <span className="text-cream/45"> ({x.obs})</span> : null}
            </li>
          ))}
        </ul>
      )}

      {aberto && !travado && (
        <div className="mt-2.5">
          <datalist id="cardapio-produtos">
            {cardapio.map((c) => (
              <option key={c.categoria + c.nome} value={c.nome} />
            ))}
          </datalist>
          {/* Antes de tudo: quantos itens ainda estao sem sabor. O pedido da cuca
              recheada fechou sem recheio nenhum e ninguem percebeu porque nada
              na tela chamava atencao. */}
          {itensSemSabor > 0 && (
            <p
              className="text-[11px] leading-snug flex items-start gap-1.5 mb-2 rounded-[10px] px-2 py-1.5"
              style={{
                color: "#e7cf94",
                background: "rgba(231,207,148,0.10)",
                border: "1px solid rgba(231,207,148,0.35)",
              }}
            >
              <TriangleAlert size={12} className="shrink-0 mt-0.5" />
              <span>
                {itensSemSabor === 1 ? "1 item sem sabor" : `${itensSemSabor} itens sem sabor`}. Escolha o sabor pra
                cozinha saber o que fazer.
              </span>
            </p>
          )}
          <div className="flex flex-col gap-2">
            {/* O papel de arroz derivado do bolo nao aparece como linha
                editavel: quem manda nele e a caixa de marcar do bolo. O indice
                original e preservado porque mexerItem(i) aponta pra lista de
                verdade. Da primeira vez eu filtrei a lista errada (a de leitura,
                quando o pedido esta travado) e o dono continuou vendo a linha. */}
            {itens
              .map((it, i) => ({ it, i }))
              .filter(({ it }) => !ehPapelDerivado(it, itens))
              .map(({ it, i }) => (
              <div key={i} className="rounded-[12px] p-2.5 border border-white/8" style={{ background: "rgba(0,0,0,0.18)" }}>
                {/* ESCOLHA EM DOIS PASSOS: primeiro a categoria, depois o
                    produto DELA. O cardápio inteiro num select só ficava com
                    quarenta linhas numa coluna estreita, e ninguém acha nada
                    assim. A categoria também define a unidade, e é ela que faz
                    o preço sair certo. */}
                <div className="flex items-center gap-1.5">
                  <select
                    value={it.categoria}
                    onChange={(e) => {
                      const cat = e.target.value as Categoria;
                      const uns = unidadesDe(cat);
                      // Trocou de família: o produto de antes não vale mais.
                      mexerItem(i, { categoria: cat, produto: "", unidade: uns[0] });
                    }}
                    className={campo + " flex-1"}
                    aria-label="Categoria"
                  >
                    {/* O que ja esta gravado continua aparecendo, senao a
                        linha ficaria sem rotulo. O que nao e escolhivel some da
                        lista pra ninguem criar na mao. */}
                    {CATEGORIAS.filter((c) => c.escolhivel !== false || c.id === it.categoria).map((c) => (
                      <option key={c.id} value={c.id} style={OPCAO}>
                        {c.rotulo}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => {
                      setItens((p) => p.filter((_, k) => k !== i));
                      setSujo(true);
                    }}
                    className="w-8 h-8 shrink-0 grid place-items-center rounded-lg text-cream/45 hover:text-cream hover:bg-white/10 transition-colors"
                    aria-label="Tirar item"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                {(() => {
                  const daCategoria = cardapio.filter((c) => c.categoria === it.categoria);
                  // SO O BOLO DE FESTA TEM "X COM Y".
                  // No bolo, o Y e a mistura e tem campo proprio embaixo, entao o
                  // seletor mostra so o sabor base. Fora do bolo, o " com " faz
                  // parte do NOME do produto: "empadao com palmito" e outro item
                  // do cardapio, R$ 39,90 o quilo contra R$ 34,90 do empadao
                  // comum. Cortando pra todo mundo, a tela mostrava "empadao" no
                  // seletor enquanto o item gravado era o de palmito, e os chips
                  // de sabor traziam palmito num item que a equipe lia como
                  // empadao de frango. Conferiam um produto, a cozinha recebia
                  // outro, e o preco cobrado era o do mais caro.
                  const misturavel = it.categoria === "bolo_festa";
                  const partes = misturavel ? it.produto.split(/ com /i) : [it.produto];
                  const baseNome = partes[0] ?? "";
                  const mistura = partes[1] ?? "";
                  const conhecido = daCategoria.some((c) => c.nome === baseNome);
                  return (
                    <select
                      value={conhecido ? baseNome : "__vazio"}
                      onChange={(e) => {
                        const nome = e.target.value;
                        if (nome === "__vazio") return;
                        const achado = daCategoria.find((c) => c.nome === nome);
                        // Trocar o sabor base nao joga fora a mistura escolhida.
                        const completo = mistura ? nome + " com " + mistura : nome;
                        mexerItem(i, { produto: completo, unidade: achado?.unidade ?? it.unidade });
                      }}
                      className={campo + " w-full mt-1.5"}
                      aria-label="Produto"
                    >
                      {!conhecido && (
                        <option value="__vazio" style={OPCAO}>
                          {baseNome || (daCategoria.length ? "escolha o produto" : "nada nesta categoria")}
                        </option>
                      )}
                      {daCategoria.map((c) => (
                        <option key={c.nome} value={c.nome} style={OPCAO}>
                          {c.nome}
                        </option>
                      ))}
                    </select>
                  );
                })()}

                <div className="flex items-center gap-1.5 mt-1.5">
                  <button
                    onClick={() => mexerItem(i, { qtd: Math.max(0, it.qtd - (it.unidade === "kg" ? 0.5 : 1)) })}
                    className="w-8 h-8 shrink-0 grid place-items-center rounded-lg text-cream/70 hover:text-cream hover:bg-white/10 border border-white/8"
                    aria-label="Menos"
                  >
                    <Minus size={14} />
                  </button>
                  <input
                    type="number"
                    min={0}
                    step={it.unidade === "kg" ? 0.5 : 1}
                    value={it.qtd}
                    onChange={(e) => mexerItem(i, { qtd: Number(e.target.value) })}
                    className={campo + " w-[62px] shrink-0 text-center"}
                    aria-label="Quantidade"
                  />
                  <button
                    onClick={() => mexerItem(i, { qtd: it.qtd + (it.unidade === "kg" ? 0.5 : 1) })}
                    className="w-8 h-8 shrink-0 grid place-items-center rounded-lg text-cream/70 hover:text-cream hover:bg-white/10 border border-white/8"
                    aria-label="Mais"
                  >
                    <Plus size={14} />
                  </button>
                  {/* A unidade só aparece quando existe escolha: bolo é sempre
                      por quilo e docinho é sempre por unidade, e um seletor de
                      uma opção só é decoração que atrapalha. */}
                  {(() => {
                    // A unidade do produto vem do cardapio; so quem nao esta la
                    // (item lancado na mao) ainda pode escolher. Cortar no
                    // " com " achava "torta fria" no lugar de "torta fria com
                    // palmito"; o casamento tolerante ja resolve os dois.
                    const achado = doCardapio(cardapio, it.produto);
                    return unidadesDe(it.categoria).length > 1 && !achado;
                  })() ? (
                    <select
                      value={it.unidade}
                      onChange={(e) => mexerItem(i, { unidade: e.target.value as Unidade })}
                      className={campo + " flex-1 pr-1"}
                      aria-label="Unidade"
                    >
                      {unidadesDe(it.categoria).map((u) => (
                        <option key={u} value={u} style={OPCAO}>
                          {ROTULO_UNIDADE[u]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="flex-1 text-[12.5px] text-cream/55 pl-1">{ROTULO_UNIDADE[it.unidade]}</span>
                  )}
                </div>

                <input
                  value={it.obs ?? ""}
                  onChange={(e) => mexerItem(i, { obs: e.target.value })}
                  placeholder="recheio, sabor, tema..."
                  className={campo + " w-full mt-1.5"}
                  aria-label="Observação do item"
                />
                {/* BOLO DE FESTA: A CHECAGEM QUE FECHA AS LACUNAS.
                    Topo e papel de arroz viram caixa de marcar, e marcar
                    qualquer um dos dois abre tema, nome e idade, que é o que a
                    peça precisa pra ser fabricada. Tudo isso vive na observação
                    do item, que é o que a IA lê e o que vai pra cozinha. */}
                {/* So o bolo de festa leva topo, papel de arroz e os dados da peca.
                    Bolo caseiro sai da vitrine inteiro: nao tem tema nem
                    aniversariante, e mostrar esses campos so atrapalha a equipe. */}
                {it.categoria === "bolo_festa" && (() => {
                  const obs = it.obs ?? "";
                  const temTopo = /topo/i.test(obs) && !/sem topo/i.test(obs);
                  const temPapel = /papel de arroz/i.test(obs) && !/sem papel/i.test(obs);
                  // Bolo de festa SEMPRE mostra tema, nome e idade: sao os dados que
                  // a producao precisa, e escondidos atras de uma caixa de marcar eles
                  // sumiam da tela justamente quando ninguem tinha marcado nada.
                  const precisaArte = true;
                  void temTopo; void temPapel;

                  const trocarTermo = (texto: string, termo: string, ligar: boolean) => {
                    const semEle = texto
                      .replace(new RegExp("\\s*,?\\s*sem " + termo, "ig"), "")
                      .replace(new RegExp("\\s*,?\\s*" + termo, "ig"), "")
                      .replace(/^,\s*/, "")
                      .trim();
                    if (!ligar) return semEle;
                    return semEle ? semEle + ", " + termo : termo;
                  };

                  // "tema X", "nome Y" e "8 anos" saem e entram na observação
                  // sem bagunçar o resto do texto que a IA escreveu.
                  const pegar = (re: RegExp) => (obs.match(re)?.[1] ?? "").trim();
                  const tema = pegar(/tema\s+([^,;]+)/i);
                  const nomeAniv = pegar(/nome\s+([^,;]+)/i);
                  const idade = pegar(/(\d{1,2})\s*anos?/i);

                  const trocarCampo = (texto: string, re: RegExp, novo: string, molde: (v: string) => string) => {
                    const limpo = texto.replace(re, "").replace(/\s*,\s*,/g, ",").replace(/^,\s*/, "").replace(/,\s*$/, "").trim();
                    if (!novo.trim()) return limpo;
                    return limpo ? limpo + ", " + molde(novo.trim()) : molde(novo.trim());
                  };

                  const Caixa = ({ ligado, rotulo, aoTrocar }: { ligado: boolean; rotulo: string; aoTrocar: (v: boolean) => void }) => (
                    <button
                      onClick={() => aoTrocar(!ligado)}
                      className="flex items-center gap-1.5 px-2 h-7 rounded-lg text-[12px] transition-colors"
                      style={
                        ligado
                          ? { background: "rgba(231,207,148,0.20)", color: "#e7cf94", border: "1px solid rgba(231,207,148,0.45)" }
                          : { background: "rgba(255,255,255,0.05)", color: "rgba(255,247,235,0.55)", border: "1px solid rgba(255,255,255,0.10)" }
                      }
                    >
                      {ligado ? <CheckSquare size={13} /> : <Square size={13} />} {rotulo}
                    </button>
                  );

                  return (
                    <div className="mt-2 pt-2 border-t border-white/8">
                      {/* MISTURAR DOIS SABORES.
                          O preco do bolo misto e o do sabor mais caro, e quem
                          decide isso e o NOME do item. Por isso o segundo
                          sabor entra no nome, e nao na observacao. */}
                      {it.categoria === "bolo_festa" && (() => {
                        const sabores = cardapio
                          .filter((c) => c.categoria === "bolo_festa")
                          .map((c) => c.nome.replace(/^bolo /i, ""));
                        const partes = it.produto.replace(/^bolo /i, "").split(/\s+com\s+/i);
                        const base = partes[0] ?? "";
                        const segundo = partes[1] ?? "";
                        return (
                          <label className="block mb-2">
                            <span className="block text-[11px] text-cream/45 mb-1">Misturar com outro sabor</span>
                            <select
                              value={segundo}
                              onChange={(e) => {
                                const s2 = e.target.value;
                                mexerItem(i, { produto: s2 ? `bolo ${base} com ${s2}` : `bolo ${base}` });
                              }}
                              className={campo + " w-full"}
                            >
                              <option value="" style={OPCAO}>
                                sem mistura
                              </option>
                              {sabores
                                .filter((s) => s.toLowerCase() !== base.toLowerCase())
                                .map((s) => (
                                  <option key={s} value={s} style={OPCAO}>
                                    {s}
                                  </option>
                                ))}
                            </select>
                            {segundo && (
                              <span className="block text-[11px] text-cream/40 mt-1">
                                Bolo misto: vale o preço do sabor mais caro dos dois.
                              </span>
                            )}
                          </label>
                        );
                      })()}
                      <div className="flex flex-wrap gap-1.5">
                        <Caixa
                          ligado={temTopo}
                          rotulo="topo de bolo"
                          aoTrocar={(v) => mexerItem(i, { obs: trocarTermo(obs, "topo de bolo", v) })}
                        />
                        <Caixa
                          ligado={temPapel}
                          rotulo="papel de arroz"
                          aoTrocar={(v) => mexerItem(i, { obs: trocarTermo(obs, "papel de arroz", v) })}
                        />
                      </div>
                      {/* Como o bolo vai embalado: a cozinha precisa saber, e
                          isso vinha se perdendo porque nao tinha campo. */}
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        <Caixa
                          ligado={/prato aberto/i.test(obs)}
                          rotulo="prato aberto"
                          aoTrocar={(v) => mexerItem(i, { obs: trocarTermo(trocarTermo(obs, "caixa com tampa", false), "prato aberto", v) })}
                        />
                        <Caixa
                          ligado={/caixa com tampa/i.test(obs)}
                          rotulo="caixa com tampa"
                          aoTrocar={(v) => mexerItem(i, { obs: trocarTermo(trocarTermo(obs, "prato aberto", false), "caixa com tampa", v) })}
                        />
                      </div>

                      {precisaArte && (
                        <div className="mt-2 flex flex-col gap-2">
                          <label className="min-w-0">
                            <span className="block text-[11px] text-cream/45 mb-1">Tema do bolo</span>
                            <input
                              value={tema}
                              onChange={(e) =>
                                mexerItem(i, { obs: trocarCampo(obs, /tema\s+[^,;]+/i, e.target.value, (v) => "tema " + v) })
                              }
                              placeholder="ex: homem aranha"
                              className={campo + " w-full"}
                            />
                          </label>
                          <div className="flex gap-2">
                            <label className="flex-1 min-w-0">
                              <span className="block text-[11px] text-cream/45 mb-1">Nome do aniversariante</span>
                              <input
                                value={nomeAniv}
                                onChange={(e) =>
                                  mexerItem(i, { obs: trocarCampo(obs, /nome\s+[^,;]+/i, e.target.value, (v) => "nome " + v) })
                                }
                                placeholder="ex: Theo"
                                className={campo + " w-full"}
                              />
                            </label>
                            <label className="w-[92px] shrink-0">
                              <span className="block text-[11px] text-cream/45 mb-1">Idade</span>
                              <input
                                type="number"
                                min={0}
                                value={idade}
                                onChange={(e) =>
                                  mexerItem(i, { obs: trocarCampo(obs, /\d{1,2}\s*anos?/i, e.target.value, (v) => v + " anos") })
                                }
                                placeholder="8"
                                className={campo + " w-full text-center"}
                              />
                            </label>
                          </div>

                          <div>
                            <span className="block text-[11px] text-cream/45 mb-1">Foto de referência do tema</span>
                            {foto ? (
                              <a href={foto} target="_blank" rel="noopener noreferrer">
                                <img
                                  src={foto}
                                  alt="Foto de referência enviada pelo cliente"
                                  className="w-full max-h-40 object-cover rounded-[10px] border border-white/10"
                                />
                              </a>
                            ) : (
                              <p className="text-[12px] text-cream/45 rounded-[10px] border border-dashed border-white/12 px-2.5 py-3 text-center">
                                O cliente ainda não mandou foto.
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
                {/* Os sabores DESTE produto, prontos pra clicar. Digitar na mão
                    esquece o sabor e erra o nome, e sabor faltando é a cozinha
                    fazendo o padrão e o cliente descobrindo na festa. */}
                {(() => {
                  const ops = saboresDe(cardapio, it.produto);
                  if (!ops.length) return null;
                  const atual = (it.obs ?? "").toLowerCase();
                  // Enquanto nenhum chip estiver aceso o bloco fica realcado. O
                  // aviso e so visual: a equipe salva no meio do caminho o tempo
                  // todo e travar o botao ia fazer ela perder correcao pronta.
                  const faltaSabor = !ops.some((sab) => atual.includes(sab.toLowerCase()));
                  return (
                    <div
                      className="mt-2 rounded-[10px]"
                      style={
                        faltaSabor
                          ? {
                              background: "rgba(231,207,148,0.07)",
                              border: "1px solid rgba(231,207,148,0.45)",
                              padding: "8px",
                            }
                          : undefined
                      }
                    >
                      <span className="block text-[11px] text-cream/45 mb-1">
                        Sabor{" "}
                        <span style={{ color: "#e7cf94" }} aria-label="obrigatório">
                          *
                        </span>
                      </span>
                      <div className="flex flex-wrap gap-1">
                      {ops.map((sab) => {
                        const marcado = atual.includes(sab.toLowerCase());
                        return (
                          <button
                            key={sab}
                            onClick={() => {
                              const obs = (it.obs ?? "").trim();
                              const novo = marcado
                                ? obs.replace(new RegExp("\\s*,?\\s*" + sab, "i"), "").replace(/^,\s*/, "").trim()
                                : obs
                                  ? obs + ", " + sab
                                  : sab;
                              mexerItem(i, { obs: novo });
                            }}
                            className="px-2 h-6 rounded-full text-[11px] transition-colors"
                            style={
                              marcado
                                ? { background: "rgba(231,207,148,0.22)", color: "#e7cf94", border: "1px solid rgba(231,207,148,0.45)" }
                                : { background: "rgba(255,255,255,0.06)", color: "rgba(255,247,235,0.6)", border: "1px solid rgba(255,255,255,0.10)" }
                            }
                          >
                            {sab}
                          </button>
                        );
                      })}
                    </div>
                    {faltaSabor && (
                      <p
                        className="text-[11px] leading-snug mt-1.5 flex items-start gap-1.5"
                        style={{ color: "#e7cf94" }}
                      >
                        <TriangleAlert size={11} className="shrink-0 mt-0.5" />
                        <span>Sem o sabor a cozinha não sabe o que fazer.</span>
                      </p>
                    )}
                    </div>
                  );
                })()}
                {/* A COR DA FORMINHA, PRONTA PRA CLICAR.
                    Cor faltando trava o pedido e cor digitada errada nao casa
                    com o que a cozinha usa. Clicar numa cor aqui vale pra este
                    docinho; a IA aplica a mesma pros outros que estao sem. */}
                {it.categoria === "docinho" && (() => {
                  const atual = (it.obs ?? "").toLowerCase();
                  return (
                    <div className="mt-2">
                      <span className="block text-[11px] text-cream/45 mb-1">Forminha</span>
                      <div className="flex flex-wrap gap-1">
                      {CORES_FORMINHA.map((cor) => {
                        // "azul royal" acendia tambem o "azul": marca so a mais
                        // especifica que aparece na observacao.
                        const escolhida = [...CORES_FORMINHA]
                          .sort((a, b) => b.length - a.length)
                          .find((c) => atual.includes(c.toLowerCase()));
                        const marcado = escolhida === cor;
                        return (
                          <button
                            key={cor}
                            onClick={() => {
                              const obs = (it.obs ?? "").trim();
                              // As barras invertidas tinham sumido daqui ("\s"
                              // dentro de aspas vira a letra s), entao desmarcar
                              // a cor tirava so o nome dela e deixava um
                              // ", forminha" solto na observacao do docinho.
                              const semCor = obs
                                .replace(new RegExp("\\s*,?\\s*(forminha\\s+)?" + cor, "ig"), "")
                                .replace(/^\s*,\s*/, "")
                                .replace(/\s*,\s*$/, "")
                                .trim();
                              mexerItem(i, { obs: marcado ? semCor : semCor ? semCor + ", forminha " + cor : "forminha " + cor });
                            }}
                            className="px-2 h-6 rounded-full text-[11px] transition-colors"
                            style={
                              marcado
                                ? { background: "rgba(231,207,148,0.22)", color: "#e7cf94", border: "1px solid rgba(231,207,148,0.45)" }
                                : { background: "rgba(255,255,255,0.06)", color: "rgba(255,247,235,0.6)", border: "1px solid rgba(255,255,255,0.10)" }
                            }
                          >
                            {cor}
                          </button>
                        );
                      })}
                    </div>
                    </div>
                  );
                })()}
              </div>
            ))}

            <button
              onClick={() => {
                setItens((p) => [...p, { produto: "", categoria: "salgado_frito", qtd: 1, unidade: "un", obs: null }]);
                setSujo(true);
                setSalvo(false);
              }}
              className="press w-full h-9 rounded-lg text-[12.5px] font-medium text-cream/70 hover:text-cream border border-dashed border-white/15 hover:bg-white/5 flex items-center justify-center gap-1.5 transition-colors"
            >
              <Plus size={14} /> Acrescentar item
            </button>

            <div className="grid grid-cols-1 gap-2 mt-1">
              {CAMPOS.map((c) => (
                <label key={c.chave} className="min-w-0">
                  <span className="block text-[11px] text-cream/45 mb-1">{c.rotulo}</span>
                  <input
                    value={(dados[c.chave] ?? "") as string}
                    onChange={(e) => mexerDados(c.chave, e.target.value)}
                    placeholder={c.dica}
                    className={campo + " w-full"}
                  />
                </label>
              ))}
            </div>

            {/* O painel é comprido: quem desce até o botão já perdeu de vista o
                aviso lá de cima e fica na dúvida se corrigir pedido fechado
                adianta alguma coisa. */}
            {registrado && !travado && (
              <p className="text-[11px] leading-snug flex items-start gap-1.5" style={{ color: "#e7cf94" }}>
                <Pencil size={11} className="shrink-0 mt-0.5" />
                <span>Pedido fechado, mas ainda editável: a correção vale até a aprovação imprimir o ticket.</span>
              </p>
            )}
            <div className="flex items-center gap-2 mt-1">
              <button
                onClick={salvar}
                disabled={!sujo || salvando}
                className="btn-cobre press flex-1 h-10 text-[13px] font-semibold flex items-center justify-center gap-1.5 disabled:opacity-45 disabled:cursor-default"
              >
                {salvo ? <><Check size={15} /> Salvo</> : salvando ? "Salvando..." : "Salvar correções"}
              </button>
            </div>
            {assumiuConversa && (
              <div className="mt-2 text-[11.5px] leading-snug rounded-[10px] px-3 py-2.5" style={{ background: "rgba(231,207,148,0.12)", border: "1px solid rgba(231,207,148,0.30)", color: "#e7cf94" }}>
                <span className="font-semibold">Pronto, agora é com o cliente.</span>{" "}
                Ele já recebeu no WhatsApp o pedido como ficou, com o total novo, e a pergunta se
                está certo assim. Se ele disser que sim, o pedido entra na fila de aprovação
                sozinho. Se ele não aceitar, volta pra cá com o motivo. A Dora não vai reorçar nem
                mexer em nada: ela só trata a resposta dele. Qualquer outra mudança, faça neste
                painel do lado e salve de novo.
              </div>
            )}
            {erro && (
              <p className="text-[11px] leading-snug" style={{ color: "#f0a5a5" }}>
                {erro}
              </p>
            )}
            <p className="text-[11px] text-cream/40 leading-snug">
              O que você corrigir aqui a IA passa a usar na conversa. Categoria importa: brigadeiro docinho e bolo de
              brigadeiro são coisas diferentes na hora de cobrar.
            </p>
            {itens.some((x) => x.categoria === "outro" && x.produto.trim() !== "") && (
              <p className="text-[11px] leading-snug" style={{ color: "#e7cf94" }}>
                Tem item sem categoria certa ({itens.filter((x) => x.categoria === "outro" && x.produto.trim() !== "").map((x) => x.produto).join(", ")}). Escolha a categoria pra sair no preço certo.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export { rotuloCat };
