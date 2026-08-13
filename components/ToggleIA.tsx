"use client";

// Liga/desliga a resposta automática da IA (config.ia_ativa). O webhook respeita:
// desligada, a mensagem do cliente chega mas a IA não responde sozinha.

import { useState } from "react";
import { Loader2, Bot } from "lucide-react";

export default function ToggleIA({ ativa: inicial }: { ativa: boolean }) {
  const [ia, setIa] = useState(inicial);
  const [salvando, setSalvando] = useState(false);

  async function toggle() {
    const nova = !ia;
    setIa(nova);
    setSalvando(true);
    try {
      await fetch("/api/whatsapp/ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ativa: nova }),
      });
    } catch {
      setIa(!nova);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="glass rounded-2xl p-5 flex items-center gap-4 max-w-2xl">
      <span className="grad-dourado w-10 h-10 rounded-xl grid place-items-center text-vinho-d shrink-0">
        <Bot size={19} />
      </span>
      <div className="flex-1">
        <div className="text-sm font-semibold text-cream">Resposta automática da IA</div>
        <div className="text-[12.5px] text-cream/60">
          {ia
            ? "A IA responde os clientes sozinha no WhatsApp."
            : "Desligada. As mensagens chegam, mas ninguém responde automático."}
        </div>
      </div>
      {salvando && <Loader2 size={16} className="animate-spin text-cream/50" />}
      <button
        type="button"
        role="switch"
        aria-checked={ia}
        onClick={toggle}
        className="relative h-6 w-11 rounded-full transition-colors shrink-0 press"
        style={{ background: ia ? "linear-gradient(135deg,#1fae54,#128c3e)" : "rgba(255,255,255,0.16)" }}
      >
        <span
          className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all"
          style={{ left: ia ? "22px" : "2px" }}
        />
      </button>
    </div>
  );
}
