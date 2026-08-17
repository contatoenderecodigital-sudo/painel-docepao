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
import { ChevronDown, Plus, Trash2, ClipboardList, Check } from "lucide-react";

type Categoria =
  | "bolo_festa" | "bolo_caseiro" | "docinho" | "salgado_frito" | "salgado_assado"
  | "pizza" | "por_quilo" | "por_unidade" | "cupcake" | "papel_de_arroz" | "outro";

type Item = { produto: string; categoria: Categoria; qtd: number; unidade: "un" | "kg"; obs?: string | null };
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
const campo =
  "min-w-0 bg-white/8 rounded-lg px-2.5 py-2 text-[13px] text-cream placeholder:text-cream/35 focus:outline-none focus:ring-2 focus:ring-cobre/25 border border-white/8";

export default function PedidoMontado({ clienteId, versao }: { clienteId: string; versao: number }) {
  const [aberto, setAberto] = useState(false);
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
    } catch {
      /* silencioso: o painel é auxiliar, não pode quebrar o chat */
    }
  }, [clienteId]);

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

  // Nada anotado e ninguém abriu: não ocupa espaço do chat à toa.
  if (vazio && !aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        className="w-full px-3 py-1.5 border-t border-white/10 flex items-center gap-2 text-[12px] text-cream/40 hover:text-cream/70 transition-colors shrink-0"
        style={{ background: "rgba(0,0,0,0.10)" }}
      >
        <ClipboardList size={13} className="shrink-0" />
        <span className="truncate">Nada anotado no pedido ainda. Toque pra montar na mão.</span>
      </button>
    );
  }

  const resumo = itens.length
    ? itens.map((x) => `${x.qtd}${x.unidade === "kg" ? "kg" : ""} ${x.produto}`).join(", ")
    : "só os dados por enquanto";

  return (
    <div className="border-t border-white/10 shrink-0" style={{ background: "rgba(231,207,148,0.07)" }}>
      <button
        onClick={() => setAberto((v) => !v)}
        className="w-full px-3 py-2 flex items-center gap-2 text-left"
        aria-expanded={aberto}
      >
        <ClipboardList size={14} className="shrink-0" style={{ color: "#e7cf94" }} />
        <span className="text-[12px] font-semibold shrink-0" style={{ color: "#e7cf94" }}>
          Pedido montado
        </span>
        <span className="text-[12px] text-cream/55 truncate flex-1 min-w-0">{resumo}</span>
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

      {aberto && (
        <div className="px-3 pb-3 max-h-[46vh] overflow-y-auto">
          <div className="flex flex-col gap-2">
            {itens.map((it, i) => (
              <div key={i} className="rounded-[12px] p-2.5 border border-white/8" style={{ background: "rgba(0,0,0,0.18)" }}>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    step={it.unidade === "kg" ? 0.5 : 1}
                    value={it.qtd}
                    onChange={(e) => mexerItem(i, { qtd: Number(e.target.value) })}
                    className={campo + " w-[64px] shrink-0 text-center"}
                    aria-label="Quantidade"
                  />
                  <select
                    value={it.unidade}
                    onChange={(e) => mexerItem(i, { unidade: e.target.value as "un" | "kg" })}
                    className={campo + " w-[58px] shrink-0"}
                    aria-label="Unidade"
                  >
                    <option value="un">un</option>
                    <option value="kg">kg</option>
                  </select>
                  <input
                    value={it.produto}
                    onChange={(e) => mexerItem(i, { produto: e.target.value })}
                    placeholder="produto"
                    className={campo + " flex-1"}
                    aria-label="Produto"
                  />
                  <button
                    onClick={() => {
                      setItens((p) => p.filter((_, k) => k !== i));
                      setSujo(true);
                    }}
                    className="w-9 h-9 shrink-0 grid place-items-center rounded-lg text-cream/45 hover:text-cream hover:bg-white/10 transition-colors"
                    aria-label="Tirar item"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <select
                    value={it.categoria}
                    onChange={(e) => {
                      const cat = e.target.value as Categoria;
                      const porQuilo = CATEGORIAS.find((c) => c.id === cat)?.porQuilo;
                      mexerItem(i, { categoria: cat, unidade: porQuilo ? "kg" : it.unidade });
                    }}
                    className={campo + " w-[124px] shrink-0"}
                    aria-label="Categoria"
                  >
                    {CATEGORIAS.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.rotulo}
                      </option>
                    ))}
                  </select>
                  <input
                    value={it.obs ?? ""}
                    onChange={(e) => mexerItem(i, { obs: e.target.value })}
                    placeholder="recheio, sabor, tema..."
                    className={campo + " flex-1"}
                    aria-label="Observação do item"
                  />
                </div>
              </div>
            ))}

            <button
              onClick={() => {
                setItens((p) => [...p, { produto: "", categoria: "outro", qtd: 1, unidade: "un", obs: null }]);
                setSujo(true);
                setSalvo(false);
              }}
              className="press w-full h-9 rounded-lg text-[12.5px] font-medium text-cream/70 hover:text-cream border border-dashed border-white/15 hover:bg-white/5 flex items-center justify-center gap-1.5 transition-colors"
            >
              <Plus size={14} /> Acrescentar item
            </button>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
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
