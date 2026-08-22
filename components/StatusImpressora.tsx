"use client";

// ============================================================================
//  A IMPRESSORA APARECE NO PAINEL.
//
//  A ponte roda na maquina da padaria e pode morrer sem avisar: o icone
//  continua na barra de tarefas com o processo morto por tras. Ja aconteceu, e
//  o pedido aprovado nao saiu na cozinha com todo mundo achando que saiu.
//
//  Aqui a dona ve o estado antes de aprovar. Quando esta tudo certo, a linha e
//  discreta; quando cai, ela fica na cara, porque aprovar sem impressao e
//  pedido perdido.
// ============================================================================

import { useEffect, useState } from "react";
import { Printer, PrinterCheck } from "lucide-react";

type Estado = { online: boolean; segundosDesde: number | null };

function faz(segundos: number | null): string {
  if (segundos === null) return "nunca conectou";
  if (segundos < 90) return "há segundos";
  const min = Math.round(segundos / 60);
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `há ${h}h` : `há ${Math.round(h / 24)} dias`;
}

export default function StatusImpressora() {
  const [estado, setEstado] = useState<Estado | null>(null);

  useEffect(() => {
    let vivo = true;
    const checar = async () => {
      try {
        const r = await fetch("/api/impressora", { cache: "no-store" });
        if (!r.ok || !vivo) return;
        setEstado((await r.json()) as Estado);
      } catch {
        /* rede caiu: tenta no proximo ciclo */
      }
    };
    void checar();
    const t = setInterval(checar, 20000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, []);

  if (!estado) return null;

  if (estado.online) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] text-cream/50">
        <PrinterCheck size={14} className="text-verde" style={{ color: "#7fd4a2" }} />
        Impressora conectada
      </span>
    );
  }

  return (
    <div
      className="rounded-xl px-4 py-3 text-sm flex items-start gap-2.5"
      style={{
        background: "rgba(200,60,60,0.16)",
        border: "1px solid rgba(240,140,140,0.35)",
        color: "#f3bcbc",
      }}
    >
      <Printer size={16} className="shrink-0 mt-0.5" />
      <span>
        <b>Impressora da cozinha sem sinal ({faz(estado.segundosDesde)}).</b> Se você aprovar agora, o
        pedido entra no sistema mas o papel não sai. Abra o programa da impressora no computador da
        padaria e confira se ele está rodando.
      </span>
    </div>
  );
}
