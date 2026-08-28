"use client";

// Liga/desliga a resposta automática da IA (config.ia_ativa). O webhook respeita:
// desligada, a mensagem do cliente chega mas a IA não responde sozinha.

import { useState } from "react";
import { Loader2, Bot } from "lucide-react";
import { avisoDeSessao } from "@/lib/buscar-do-painel";

export default function ToggleIA({ ativa: inicial }: { ativa: boolean }) {
  const [ia, setIa] = useState(inicial);
  const [salvando, setSalvando] = useState(false);
  // VOLTAR A CHAVE SOZINHA NAO EXPLICA NADA.
  //
  // Conferir o `!r.ok` e desfazer ja impedia a mentira: a chave nunca mostra
  // desligado com a Dora atendendo. Mas a dona clica em desligar, ve a chave
  // voltar pra ligada sozinha, e nao sabe se errou o toque ou se falhou. Com a
  // sessao expirada ela tentaria pra sempre, e a Dora continuaria respondendo.
  const [erro, setErro] = useState<string | null>(null);

  async function toggle() {
    const nova = !ia;
    setIa(nova);
    setSalvando(true);
    setErro(null);
    try {
      const r = await fetch("/api/whatsapp/ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ativa: nova }),
      });
      // Resposta de erro nao lanca excecao: sem conferir, a chave mostrava
      // "IA desligada" com a IA respondendo cliente do outro lado.
      if (!r.ok) {
        setIa(!nova);
        // A frase diz o que FICOU VALENDO, e nao so que falhou: e a diferenca
        // entre saber que deu erro e saber se o cliente esta sendo atendido.
        setErro(
          avisoDeSessao(r.status) ??
            (nova
              ? "Não consegui ligar a Dora. Ela CONTINUA DESLIGADA: tente de novo."
              : "Não consegui desligar a Dora. Ela CONTINUA ATENDENDO: tente de novo."),
        );
      }
    } catch {
      setIa(!nova);
      setErro(
        nova
          ? "Sem conexão. A Dora CONTINUA DESLIGADA: tente de novo."
          : "Sem conexão. A Dora CONTINUA ATENDENDO: tente de novo.",
      );
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
        {erro && <div className="text-[12.5px] text-[#ff8a8a] mt-1">{erro}</div>}
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
