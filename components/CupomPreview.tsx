"use client";

// Preview dos cupons da cozinha: 1 ticket por estacao + o master do caixa.
// Modal premium (glass escuro) com tickets em papel serrilhado. A IMPRESSAO
// de verdade (window.print) sai preto e branco, mono, bobina estreita, sem
// nenhum efeito visual (ver @media print no globals.css).

import type { Pedido } from "@/lib/tipos";
import { brl, formatarTelefoneBR } from "@/lib/tipos";
import { deptoDe, qtdDoTicket, DEPARTAMENTOS, type DeptoId } from "@/lib/departamentos";
import { DeptIcone } from "@/components/DeptIcone";
import { X, Printer } from "lucide-react";

function fmtData(iso: string | null) {
  if (!iso) return "dia a confirmar";
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

// DIA E HORA EM TODOS OS TICKETS, SEMPRE.
//
// A hora so aparecia quando existia, entao um pedido sem hora imprimia
// "RETIRADA: 27/09/2026" e ninguem na bancada sabia se faltava a hora ou se
// ninguem tinha perguntado. A linha agora carrega os dois campos, e o que
// falta aparece escrito que falta.
function linhaRetirada(pedido: Pedido) {
  const hora = String(pedido.retiradaHora ?? "").trim();
  return `${fmtData(pedido.retiradaData)} - ${hora || "hora a confirmar"}`;
}

// "200 un" pros itens contados, "1,5 kg" pros pesados. Quem decide e o
// lib/departamentos, o mesmo que separa as estacoes, pra tela e papel nunca
// discordarem.
function qtdLabel(it: Pedido["itens"][number]) {
  return qtdDoTicket(it);
}

// O TICKET DO CAIXA NAO PODE COBRAR QUEM JA PAGOU.
//
// O rodape dizia "Pagamento na RETIRADA" em todo pedido, inclusive nos que o
// cliente fechou no pix e que estao no banco com forma_pagamento = 'pago'.
// Quem entrega le o papel, nao o painel. Agora a linha e a do banco.
const PAGAMENTO: Record<string, string> = {
  pix: "Pagamento: PIX",
  dinheiro: "Pagamento: dinheiro",
  cartao: "Pagamento: cartão",
  pago: "JÁ PAGO",
};
function linhaPagamento(pedido: Pedido) {
  const f = pedido.formaPagamento ? PAGAMENTO[pedido.formaPagamento] : null;
  return f ?? "Pagamento na RETIRADA";
}

type Badge = { nome: string; cor: string; id: DeptoId | "caixa" };

// ===== IMPRESSAO =====================================================
// Gera o cupom como HTML limpo (mono, P&B, bobina estreita) e imprime num
// iframe isolado. Nao depende do CSS do app (glass/serrilha) nem de esconder
// a tela, entao sai certo e sempre preto e branco.
function esc(s: string) {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] as string);
}
// AQUI HAVIA UM `semAcento` QUE NAO TIRAVA ACENTO.
//
// O comentario dizia "remove acento e c-cedilha" e o corpo era `return s`. A
// decisao de manter o acento e certa e esta explicada abaixo, mas o nome
// prometia o contrario, e ja existem DUAS funcoes com esse nome no
// repositorio: a de `lib/ia/texto.ts` (que baixa a caixa e apara, pra
// COMPARAR) e o apelido do `cupom-escpos.ts` (que tira acento de verdade, pro
// papel). Uma terceira, que nao faz nada, e a armadilha completa.
//
// POR QUE A TELA MANTEM O ACENTO E O PAPEL NAO:
//
// Sao duas impressoras. Esta preview sai pelo NAVEGADOR (A4 ou bobina, o
// navegador rasteriza a fonte e o acento sai certo). O cupom de verdade sai
// pela PONTE, em ESC/POS, onde acento depende de codepage e vira ruido no meio
// da palavra: la o `cupom-escpos.ts` tira, de proposito, e diz por que
// ("melhor PAES E CUCAS legivel do que PAES virando ruido").
//
// Entao a diferenca e real e escolhida: a tela mostra "Prestigio" com acento e
// o papel termico imprime sem. O conteudo e o mesmo.
//
// Achado na leitura do `components/`, 28/08/2026.
const pr = (s: string) => esc(s);

function htmlDoTicket(
  t: { badge: Badge; itens: Pedido["itens"]; master?: boolean },
  pedido: Pedido,
  nomeNegocio: string,
) {
  const itens = t.itens
    .map(
      (it) =>
        `<div class="row"><span class="nm"><b>${qtdLabel(it)}</b> <span class="prod">${pr(it.produto)}</span></span>${t.master ? `<span class="pc">${brl(it.subtotalCentavos)}</span>` : ""}</div>${it.obs ? `<div class="obs">${pr(it.obs)}</div>` : ""}`,
    )
    .join("");
  const rodape = t.master
    ? `<div><b>TOTAL: ${brl(pedido.totalCentavos)}</b></div><div>${pr(linhaPagamento(pedido))}</div>`
    : `<div class="center">Producao ${pr(t.badge.nome)}</div>`;
  const obs = pedido.observacoes ? `<div class="ln"></div><div><b>OBS:</b> ${pr(pedido.observacoes)}</div>` : "";
  return `<div class="tk">
    <div class="center"><span class="badge">${pr(t.badge.nome)}</span></div>
    <div class="center b">${pr(nomeNegocio || "Padaria")}</div>
    <div class="ln"></div>
    <div><b>CLIENTE:</b> ${pr(pedido.clienteNome)}</div>
    <div>Fone: ${formatarTelefoneBR(pedido.clienteTelefone)}</div>
    <div><b>RETIRADA:</b> ${pr(linhaRetirada(pedido))}</div>
    ${pedido.pessoas ? `<div>Festa: ${pedido.pessoas} pessoas</div>` : ""}
    <div>Pedido #${pr(pedido.id.slice(0, 8))}</div>
    <div class="ln"></div>
    ${itens}
    <div class="ln"></div>
    ${rodape}
    ${obs}
  </div>`;
}

const PRINT_CSS = `
  * { box-sizing: border-box; }
  body { margin: 0; color: #000; background: #fff; font-family: "Courier New", monospace; }
  /* Os cupons descem um embaixo do outro e so quebram a folha quando nao cabem.
     Antes cada cupom forcava folha nova: um pedido de festa saia em 7 paginas de
     A4. Em bobina termica o resultado e o mesmo (o papel corre continuo), e no
     A4 a dona corta na linha tracejada. */
  .tk { width: 72mm; padding: 5mm 4mm; font-size: 12px; line-height: 1.4; break-inside: avoid; page-break-inside: avoid; }
  .tk + .tk { border-top: 2px dashed #000; margin-top: 4mm; padding-top: 5mm; }
  @media print { @page { margin: 8mm; } }
  .b { font-weight: bold; }
  .prod { font-weight: bold; text-transform: uppercase; font-size: 13px; }
  .center { text-align: center; }
  .badge { display: inline-block; border: 1px solid #000; padding: 1px 8px; margin-bottom: 3px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; font-size: 11px; }
  .ln { border-top: 1px dashed #000; margin: 5px 0; }
  .row { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
  .row .nm { min-width: 0; }
  .row .pc { white-space: nowrap; text-align: right; }
  .obs { padding-left: 12px; font-size: 11px; }
`;

function imprimirHTML(inner: string) {
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (!doc) return;
  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><style>${PRINT_CSS}</style></head><body>${inner}</body></html>`);
  doc.close();
  const win = iframe.contentWindow;
  setTimeout(() => {
    win?.focus();
    win?.print();
    setTimeout(() => iframe.remove(), 800);
  }, 250);
}

function Ticket({
  badge,
  itens,
  pedido,
  nomeNegocio,
  master,
  onImprimir,
}: {
  badge: Badge;
  itens: Pedido["itens"];
  pedido: Pedido;
  nomeNegocio: string;
  master?: boolean;
  onImprimir: () => void;
}) {
  return (
    <div
      className="cupom-ticket relative w-[248px] rounded-t-[10px] px-4 pt-4 pb-5 font-mono text-[12px] leading-tight text-black"
      style={{ background: "#fdfbf7", boxShadow: "0 12px 34px rgba(0,0,0,0.4)" }}
    >
      <button
        onClick={onImprimir}
        /* 15px era o menor alvo do painel inteiro. A area de toque cresce; o
           icone continua discreto porque o ticket e estreito de proposito. */
        className="no-print absolute top-0 right-0 w-11 h-11 sm:w-7 sm:h-7 grid place-items-center text-black/35 hover:text-black transition-colors"
        aria-label="Imprimir este ticket"
      >
        <Printer size={15} strokeWidth={1.8} />
      </button>
      <div className="flex justify-center mb-2">
        <span
          className="cupom-badge inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] px-2.5 py-1 rounded-md"
          style={{ background: "#f0ece4", color: "#3a2a22" }}
        >
          <DeptIcone id={badge.id} size={12} strokeWidth={1.5} /> {badge.nome}
        </span>
      </div>
        <div className="text-center font-bold text-[13px]">{nomeNegocio || "Padaria"}</div>
        <div className="border-t border-dashed border-black/30 my-1.5" />
        <div className="font-bold">CLIENTE: {pedido.clienteNome}</div>
        <div>Fone: {formatarTelefoneBR(pedido.clienteTelefone)}</div>
        <div className="font-bold text-[12.5px]">RETIRADA: {linhaRetirada(pedido)}</div>
        {pedido.pessoas ? <div>Festa: {pedido.pessoas} pessoas</div> : null}
        <div>Pedido #{pedido.id.slice(0, 8)}</div>
        <div className="border-t border-dashed border-black/30 my-1.5" />
        {itens.map((it, i) => (
          <div key={i}>
            <div className="flex items-start justify-between gap-2">
              <span className="min-w-0">
                <b>{qtdLabel(it)}</b> <b className="uppercase">{it.produto}</b>
              </span>
              {master ? <span className="shrink-0 whitespace-nowrap text-right">{brl(it.subtotalCentavos)}</span> : null}
            </div>
            {it.obs ? <div className="pl-3 text-[11px] opacity-80">{it.obs}</div> : null}
          </div>
        ))}
        <div className="border-t border-dashed border-black/30 my-1.5" />
        {master ? (
          <>
            <div className="font-bold text-[13.5px]">TOTAL: {brl(pedido.totalCentavos)}</div>
            <div>{linhaPagamento(pedido)}</div>
          </>
        ) : (
          <div className="text-center">Produção {badge.nome}</div>
        )}
        {pedido.observacoes ? (
          <>
            <div className="border-t border-dashed border-black/30 my-1.5" />
            <div>
              <b>OBS:</b> {pedido.observacoes}
            </div>
          </>
        ) : null}
    </div>
  );
}

export default function CupomPreview({
  pedido,
  nomeNegocio = "",
  onClose,
}: {
  pedido: Pedido;
  nomeNegocio?: string;
  onClose: () => void;
}) {
  // agrupa itens por estacao
  const porDepto = {} as Record<DeptoId, Pedido["itens"]>;
  for (const it of pedido.itens) {
    const d = deptoDe(it);
    (porDepto[d] ||= []).push(it);
  }

  // A ordem dos tickets segue a das estacoes, nao a ordem em que o cliente
  // falou os itens: quem separa o papel na cozinha pega sempre na mesma
  // sequencia, e o do CAIXA e o ultimo porque e o que fica no balcao.
  type TicketData = { key: string; badge: Badge; itens: Pedido["itens"]; master?: boolean };
  const tickets: TicketData[] = DEPARTAMENTOS.filter((d) => porDepto[d.id]?.length).map((d) => ({
    key: d.id,
    badge: { nome: d.nome, cor: d.cor, id: d.id },
    itens: porDepto[d.id],
  }));
  tickets.push({
    key: "caixa",
    badge: { nome: "Caixa", cor: "#6e1f30", id: "caixa" },
    itens: pedido.itens,
    master: true,
  });

  function imprimir(id?: string) {
    const lista = id ? tickets.filter((t) => t.key === id) : tickets;
    const html = lista.map((t) => htmlDoTicket({ badge: t.badge, itens: t.itens, master: t.master }, pedido, nomeNegocio)).join("");
    imprimirHTML(html);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <div
        className="rounded-[20px] max-w-full max-h-full overflow-hidden flex flex-col"
        style={{
          background: "rgba(73,16,32,0.97)",
          backdropFilter: "blur(24px) saturate(140%)",
          WebkitBackdropFilter: "blur(24px) saturate(140%)",
          border: "1px solid rgba(255,255,255,0.14)",
          boxShadow: "0 30px 80px rgba(0,0,0,0.5)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* cabecalho */}
        <div className="no-print flex items-start justify-between gap-6 px-6 pt-5 pb-4 border-b border-white/10">
          <div>
            <div className="t-label text-dourado">Cupom da cozinha</div>
            <h3 className="t-h2 text-cream mt-1">Um ticket por estação, mais o do caixa</h3>
          </div>
          <button
            onClick={onClose}
            className="w-11 h-11 sm:w-9 sm:h-9 grid place-items-center rounded-full text-cream/60 hover:text-cream hover:bg-white/10 transition-colors shrink-0"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {/* tickets */}
        <div className="overflow-auto px-6 py-6">
          <div className="cupons-print flex gap-6 items-stretch">
            {tickets.map((t) => (
              <Ticket
                key={t.key}
                badge={t.badge}
                itens={t.itens}
                pedido={pedido}
                nomeNegocio={nomeNegocio}
                master={t.master}
                onImprimir={() => imprimir(t.key)}
              />
            ))}
          </div>
        </div>

        {/* acoes */}
        <div className="no-print flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10">
          <button onClick={onClose} className="px-4 h-11 sm:h-auto sm:py-2 rounded-[10px] text-sm text-cream/70 border border-white/15 hover:bg-white/10 transition-colors">
            Fechar
          </button>
          <button onClick={() => imprimir()} className="btn-cobre press inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold">
            <Printer size={15} /> Imprimir todos
          </button>
        </div>
      </div>
    </div>
  );
}
