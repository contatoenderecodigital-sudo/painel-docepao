"use client";

// Lançar um item que faltava, antes de aprovar.
//
// Nasceu de um beco sem saída real: a IA avisa o cliente que "a equipe vai
// informar o valor do topo de bolo", o card pede "confirme antes de aprovar",
// e a fila só tinha aprovar e recusar. Não havia onde lançar esse valor —
// aprovar mandava o pedido sem o item mais caro, recusar perdia a venda.
//
// Serve pra qualquer coisa que a IA não tinha como precificar: topo de bolo,
// taxa de entrega, um item combinado por fora da tabela.

import { useState } from "react";
import { Plus, Check, X, Loader2 } from "lucide-react";
import { adicionarItemPedido } from "@/app/(painel)/acoes";

export default function AjustarPedido({ pedidoId, aoSalvar }: { pedidoId: string; aoSalvar?: () => void }) {
  const [aberto, setAberto] = useState(false);
  const [produto, setProduto] = useState("");
  const [qtd, setQtd] = useState("1");
  const [valor, setValor] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setErro(null);
    setSalvando(true);
    const r = await adicionarItemPedido(pedidoId, {
      produto,
      qtd: Number(qtd.replace(",", ".")),
      valorUnitario: Number(valor.replace(",", ".")),
    });
    setSalvando(false);
    if (!r.ok) {
      setErro(r.erro ?? "Não consegui salvar.");
      return;
    }
    setProduto(""); setQtd("1"); setValor(""); setAberto(false);
    aoSalvar?.();
  }

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        className="press toque inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold rounded-[10px] text-cream"
        style={{ background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.16)" }}
        title="Lançar um item que faltava (topo de bolo, entrega, item por fora)"
      >
        <Plus size={15} /> Lançar item
      </button>
    );
  }

  return (
    <div
      className="w-full rounded-[12px] p-3 mt-1"
      style={{ background: "rgba(0,0,0,0.22)", border: "1px solid rgba(255,255,255,0.14)" }}
    >
      <div className="text-[12px] text-cream/70 mb-2">
        O total é recalculado pela soma dos itens, e o cliente é avisado quando você aprovar.
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          value={produto}
          onChange={(e) => setProduto(e.target.value)}
          placeholder="O que é (ex.: topo de bolo)"
          className="flex-1 min-w-[160px] rounded-[9px] px-3 py-2 text-[14px] text-cream placeholder:text-cream/40 focus:outline-none"
          style={{ background: "rgba(255,255,255,0.10)" }}
        />
        <input
          value={qtd}
          onChange={(e) => setQtd(e.target.value)}
          inputMode="decimal"
          placeholder="Qtd"
          className="w-[70px] rounded-[9px] px-3 py-2 text-[14px] text-cream placeholder:text-cream/40 focus:outline-none"
          style={{ background: "rgba(255,255,255,0.10)" }}
        />
        <input
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          inputMode="decimal"
          placeholder="R$ cada"
          className="w-[100px] rounded-[9px] px-3 py-2 text-[14px] text-cream placeholder:text-cream/40 focus:outline-none"
          style={{ background: "rgba(255,255,255,0.10)" }}
        />
        <button onClick={salvar} disabled={salvando} className="btn-verde press px-3.5 py-2 text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-60">
          {salvando ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Salvar
        </button>
        <button onClick={() => { setAberto(false); setErro(null); }} className="press px-3 py-2 text-sm text-cream/70 inline-flex items-center gap-1.5">
          <X size={15} /> Cancelar
        </button>
      </div>
      {erro && <div className="text-[12.5px] mt-2" style={{ color: "#ff8a8a" }}>{erro}</div>}
    </div>
  );
}
