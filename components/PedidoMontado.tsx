"use client";

// ============================================================================
//  PEDIDO MONTADO — o pedido tomando forma no meio da conversa.
//
//  A IA anota aqui o que o cliente vai decidindo, item por item. Serve pra duas
//  coisas ao mesmo tempo: é a memória dela (não precisa remontar o pedido a
//  cada mensagem) e é onde a equipe corrige na mão sem ter que pedir pro
//  cliente repetir. O que a dona arruma aqui a IA passa a usar na conversa.
//
//  Fica acima do campo de digitar porque é ali que a equipe olha antes de
//  responder alguma coisa. Recolhido mostra só o resumo; aberto dá pra editar.
// ============================================================================

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Plus, Minus, Trash2, Check, Square, CheckSquare } from "lucide-react";

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
const CATEGORIAS: { id: Categoria; rotulo: string; porQuilo?: boolean }[] = [
  { id: "bolo_festa", rotulo: "Bolo de festa", porQuilo: true },
  { id: "bolo_caseiro", rotulo: "Bolo caseiro" },
  { id: "docinho", rotulo: "Docinho" },
  { id: "salgado_frito", rotulo: "Salgado frito" },
  { id: "salgado_assado", rotulo: "Salgado assado" },
  { id: "pizza", rotulo: "Pizza" },
  { id: "cupcake", rotulo: "Cupcake" },
  { id: "papel_de_arroz", rotulo: "Papel de arroz" },
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

const campo =
  "min-w-0 bg-white/8 rounded-lg px-2.5 py-2 text-[13px] text-cream placeholder:text-cream/35 focus:outline-none focus:ring-2 focus:ring-cobre/25 border border-white/8";

type OpcaoCardapio = { nome: string; categoria: Categoria; unidade: Unidade; sabores: string[] };

export default function PedidoMontado({ clienteId, versao }: { clienteId: string; versao: number }) {
  const [aberto, setAberto] = useState(false);
  const [cardapio, setCardapio] = useState<OpcaoCardapio[]>([]);
  const [foto, setFoto] = useState<string | null>(null);
  const [itens, setItens] = useState<Item[]>([]);
  const [dados, setDados] = useState<Dados>({});
  const [sujo, setSujo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const r = await fetch(`/api/montagem?cliente=${encodeURIComponent(clienteId)}`, { cache: "no-store" });
      if (!r.ok) return;
      const j = await r.json();
      setItens(Array.isArray(j.itens) ? j.itens : []);
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
  useEffect(() => {
    setSujo(false);
    setSalvo(false);
    setItens([]);
    setDados({});
    carregar();
  }, [clienteId, carregar]);

  useEffect(() => {
    if (!sujo) carregar();
  }, [versao, sujo, carregar]);

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
    try {
      const limpos = itens
        .filter((x) => x.produto.trim() !== "" && x.qtd > 0)
        .map((x) => ({ ...x, produto: x.produto.trim(), obs: x.obs?.trim() || null }));
      const r = await fetch("/api/montagem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clienteId, itens: limpos, dados }),
      });
      if (!r.ok) throw new Error("falhou");
      setItens(limpos);
      setSujo(false);
      setSalvo(true);
      setTimeout(() => setSalvo(false), 2500);
    } catch {
      setSalvo(false);
    } finally {
      setSalvando(false);
    }
  }

  const preenchidos = CAMPOS.filter((c) => (dados[c.chave] ?? "").toString().trim() !== "").length;
  const vazio = itens.length === 0 && preenchidos === 0;

  const resumo = itens.length
    ? itens.map((x) => `${x.qtd}${x.unidade === "kg" ? "kg" : ""} ${x.produto}`).join(", ")
    : "só os dados por enquanto";

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

      {/* Fechado, mostra o resumo numa linha: dá pra bater o olho e seguir. */}
      {!aberto && (
        <p className="text-[12px] text-cream/60 mt-2 leading-snug">
          {vazio ? "Nada anotado ainda." : resumo}
        </p>
      )}

      {aberto && (
        <div className="mt-2.5">
          <datalist id="cardapio-produtos">
            {cardapio.map((c) => (
              <option key={c.categoria + c.nome} value={c.nome} />
            ))}
          </datalist>
          <div className="flex flex-col gap-2">
            {itens.map((it, i) => (
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
                    {CATEGORIAS.map((c) => (
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
                  const conhecido = daCategoria.some((c) => c.nome === it.produto);
                  return (
                    <select
                      value={conhecido ? it.produto : "__vazio"}
                      onChange={(e) => {
                        const nome = e.target.value;
                        if (nome === "__vazio") return;
                        const achado = daCategoria.find((c) => c.nome === nome);
                        mexerItem(i, { produto: nome, unidade: achado?.unidade ?? it.unidade });
                      }}
                      className={campo + " w-full mt-1.5"}
                      aria-label="Produto"
                    >
                      {!conhecido && (
                        <option value="__vazio" style={OPCAO}>
                          {it.produto || (daCategoria.length ? "escolha o produto" : "nada nesta categoria")}
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
                  {unidadesDe(it.categoria).length > 1 ? (
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
                {(it.categoria === "bolo_festa" || it.categoria === "bolo_caseiro") && (() => {
                  const obs = it.obs ?? "";
                  const temTopo = /topo/i.test(obs) && !/sem topo/i.test(obs);
                  const temPapel = /papel de arroz/i.test(obs) && !/sem papel/i.test(obs);
                  const precisaArte = temTopo || temPapel;

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
                  const ops = cardapio.find((c) => c.nome.toLowerCase() === it.produto.trim().toLowerCase())?.sabores ?? [];
                  if (!ops.length) return null;
                  const atual = (it.obs ?? "").toLowerCase();
                  return (
                    <div className="flex flex-wrap gap-1 mt-1.5">
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

            <div className="flex items-center gap-2 mt-1">
              <button
                onClick={salvar}
                disabled={!sujo || salvando}
                className="btn-cobre press flex-1 h-10 text-[13px] font-semibold flex items-center justify-center gap-1.5 disabled:opacity-45 disabled:cursor-default"
              >
                {salvo ? <><Check size={15} /> Salvo</> : salvando ? "Salvando..." : "Salvar correções"}
              </button>
            </div>
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
