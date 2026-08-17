"use client";

// ============================================================================
//  AGUARDANDO CONFIRMAÇÃO — os pedidos que a IA montou mas não pôde fechar.
//
//  Quase sempre é o topo de bolo: a Dora não tem preço dele, avisa o cliente
//  que a equipe informa e deixa o pedido pendente. Antes esses pedidos ficavam
//  misturados na fila de aprovação, onde aprovar mandava o pedido SEM o item
//  mais caro — ou a dona recusava e perdia a venda.
//
//  O fluxo aqui: abre a conversa, descobre o valor, lança, e a DORA avisa o
//  cliente com o total novo. Quem fala continua sendo ela; o cliente negociou a
//  encomenda inteira com a Dora e uma voz nova só pra cobrar a mais soa a outra
//  empresa. Resolvido, o pedido cai na fila de aprovação normal.
// ============================================================================

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, MessageSquare, Check, Loader2, Image as ImgIcon, Clock } from "lucide-react";
import type { Pedido } from "@/lib/tipos";
import { brl, formatarTelefoneBR } from "@/lib/tipos";
import { resolverPendencia, liberarParaAprovacao } from "@/app/(painel)/acoes";

// Mesma leitura da fila de aprovação: "sex 28/08" diz mais que "2026-08-28"
// pra quem organiza a semana de produção.
function formataData(iso: string | null) {
  if (!iso) return null;
  const [ano, mes, dia] = iso.split("-");
  const dias = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
  const dt = new Date(Number(ano), Number(mes) - 1, Number(dia));
  return `${dias[dt.getDay()]} ${dia}/${mes}`;
}

function fmtQtd(qtd: number, unidade?: string | null) {
  const u = unidade === "kg" ? "kg" : "un";
  const n = u === "kg" ? String(qtd).replace(".", ",") : String(Math.round(qtd));
  return u === "kg" ? `${n} kg` : `${n}×`;
}

export default function AguardandoConfirmacao({ pedidos }: { pedidos: Pedido[] }) {
  const router = useRouter();

  if (pedidos.length === 0) {
    return (
      <div className="glass rounded-[20px] p-10 text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl grid place-items-center text-dourado mb-3" style={{ background: "rgba(212,175,55,0.12)" }}>
          <Check size={26} />
        </div>
        <div className="tracking-tight-apple text-xl font-bold text-cream">Nada pendente agora</div>
        <p className="text-sm text-cream/60 mt-1 max-w-md mx-auto">
          Quando a Dora montar um pedido que ela não pode fechar sozinha (valor de topo de bolo, item fora da
          tabela, encomenda pra hoje), ele aparece aqui em vez de ir direto pra aprovação.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {pedidos.map((p) => (
        <Cartao key={p.id} pedido={p} aoResolver={() => router.refresh()} />
      ))}
    </div>
  );
}

function Cartao({ pedido, aoResolver }: { pedido: Pedido; aoResolver: () => void }) {
  const [produto, setProduto] = useState("topo de bolo");
  const [qtd, setQtd] = useState("1");
  const [valor, setValor] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(comItem: boolean) {
    setErro(null);
    setSalvando(true);
    // Já esperando o cliente: liberar aqui significa "ele aceitou por fora",
    // não recomeçar o ciclo de aviso.
    if (pedido.aguardandoCliente) {
      const r0 = await liberarParaAprovacao(pedido.id);
      setSalvando(false);
      if (!r0.ok) { setErro(r0.erro ?? "Não consegui liberar."); return; }
      aoResolver();
      return;
    }
    const r = await resolverPendencia(
      pedido.id,
      comItem
        ? { produto: produto.trim(), qtd: Number(qtd.replace(",", ".")), valorUnitario: Number(valor.replace(",", ".")) }
        : null,
    );
    setSalvando(false);
    if (!r.ok) {
      setErro(r.erro ?? "Não consegui liberar o pedido.");
      return;
    }
    aoResolver();
  }

  const podeEnviar = produto.trim().length > 1 && Number(valor.replace(",", ".")) >= 0 && valor.trim() !== "";

  return (
    <div className="glass rounded-[20px] overflow-hidden flex flex-col">
      <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-cream font-bold text-[17px] truncate">{pedido.clienteNome}</div>
          <div className="text-[12px] text-cream/55">{formatarTelefoneBR(pedido.clienteTelefone)}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] uppercase tracking-[0.16em] text-cream/45">Retirada</div>
          <div className="text-[13px] text-cream font-semibold">
            {formataData(pedido.retiradaData) ?? "—"}
            {pedido.retiradaHora ? ` · ${pedido.retiradaHora}` : ""}
          </div>
        </div>
      </div>

      {/* o motivo na frente: é a razão de o pedido estar nesta tela */}
      <div className="mx-5 mb-3 rounded-[12px] px-3 py-2.5 flex items-start gap-2" style={{ background: "rgba(231,207,148,0.10)", border: "1px solid rgba(231,207,148,0.25)" }}>
        <AlertTriangle size={15} className="shrink-0 mt-0.5" style={{ color: "#e7cf94" }} />
        <div className="text-[13px] text-cream/90">
          {pedido.aguardandoCliente ? (
            <>
              <span style={{ color: "#e7cf94" }} className="font-semibold">Esperando o cliente: </span>
              a Dora já mandou o total atualizado. Quando ele responder que aceita, o pedido entra sozinho na
              fila de aprovação.
            </>
          ) : (
            <>
              <span style={{ color: "#e7cf94" }} className="font-semibold">Falta pra fechar: </span>
              {pedido.motivoHumano || "confirmar detalhe com o cliente"}
            </>
          )}
        </div>
      </div>

      <div className="px-5 space-y-1.5">
        {pedido.itens.map((it, i) => (
          <div key={i}>
            <div className="flex items-baseline justify-between gap-3 text-[13.5px]">
              <span className="text-cream/90">
                <span className="font-semibold text-cream">{fmtQtd(it.qtd, it.unidade)}</span> {it.produto}
              </span>
              <span className="text-cream/75 shrink-0">{brl(it.subtotalCentavos)}</span>
            </div>
            {it.obs && <div className="text-[12px] text-cream/55 pl-1 mt-0.5">{it.obs}</div>}
          </div>
        ))}
        {pedido.temFoto && (
          <div className="flex items-center gap-1.5 text-[12px] text-cream/60 pt-1">
            <ImgIcon size={13} /> tem foto de referência na conversa
          </div>
        )}
      </div>

      <div className="px-5 py-3 mt-2 flex items-baseline justify-between">
        <span className="text-[10px] uppercase tracking-[0.16em] text-cream/45">Total até agora</span>
        <span className="text-dourado font-bold text-[20px]">{brl(pedido.totalCentavos)}</span>
      </div>

      {/* ação: lançar o que faltava e deixar a Dora avisar */}
      <div className="mt-auto px-5 pb-5 pt-3 border-t border-white/10">
        {pedido.aguardandoCliente && (
          <div className="text-[12px] text-cream/65 mb-2">
            Se ele responder por telefone ou pessoalmente, use o botão abaixo pra liberar na mão.
          </div>
        )}
        <div className="text-[12px] text-cream/65 mb-2" hidden={pedido.aguardandoCliente}>
          Lance o valor que você acertou. A Dora avisa o cliente com o total novo e o pedido vai pra aprovação.
        </div>
        <div className="flex flex-wrap gap-2" hidden={pedido.aguardandoCliente}>
          <input
            value={produto}
            onChange={(e) => setProduto(e.target.value)}
            placeholder="O que é"
            className="flex-1 min-w-[150px] rounded-[9px] px-3 py-2 text-[14px] text-cream placeholder:text-cream/40 focus:outline-none"
            style={{ background: "rgba(255,255,255,0.10)" }}
          />
          <input
            value={qtd}
            onChange={(e) => setQtd(e.target.value)}
            inputMode="decimal"
            className="w-[64px] rounded-[9px] px-3 py-2 text-[14px] text-cream focus:outline-none"
            style={{ background: "rgba(255,255,255,0.10)" }}
            aria-label="Quantidade"
          />
          <input
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            inputMode="decimal"
            placeholder="R$ cada"
            className="w-[104px] rounded-[9px] px-3 py-2 text-[14px] text-cream placeholder:text-cream/40 focus:outline-none"
            style={{ background: "rgba(255,255,255,0.10)" }}
          />
        </div>

        {erro && <div className="text-[12.5px] mt-2" style={{ color: "#ff8a8a" }}>{erro}</div>}

        <div className="flex flex-wrap gap-2 mt-3">
          <Link
            href={`/atendimentos?cliente=${encodeURIComponent(pedido.clienteTelefone)}`}
            className="press toque inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold rounded-[10px] text-cream"
            style={{ background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.16)" }}
          >
            <MessageSquare size={15} /> Abrir conversa
          </Link>
          <button
            onClick={() => enviar(true)}
            hidden={pedido.aguardandoCliente}
            disabled={salvando || !podeEnviar}
            className="btn-verde press toque px-3.5 py-2 text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            {salvando ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Lançar e avisar cliente
          </button>
          <button
            onClick={() => enviar(false)}
            disabled={salvando}
            className="press toque px-3 py-2 text-sm text-cream/70 inline-flex items-center gap-1.5 disabled:opacity-50"
            title="Manda o pedido pra fila de aprovação sem cobrar nada a mais."
          >
            <Clock size={15} /> {pedido.aguardandoCliente ? "Liberar pra aprovação" : "Só liberar"}
          </button>
        </div>
      </div>
    </div>
  );
}
