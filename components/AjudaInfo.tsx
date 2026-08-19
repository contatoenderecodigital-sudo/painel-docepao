"use client";

// Botão "?" de ajuda: explica pra que serve a página. Clica e abre um balão
// curto. Usado no cabeçalho de cada tela pra o dono entender cada função.

import { useState } from "react";
import { HelpCircle, X } from "lucide-react";

export default function AjudaInfo({ titulo, texto }: { titulo: string; texto: string }) {
  const [aberto, setAberto] = useState(false);
  return (
    <span className="relative inline-flex align-middle">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-label="O que é esta tela"
        /* 28px e alvo de mouse. No dedo vira 44, que e o minimo pra acertar. */
        className="press w-11 h-11 sm:w-7 sm:h-7 rounded-full grid place-items-center text-cream/50 hover:text-dourado hover:bg-white/[0.06] transition-colors"
      >
        <HelpCircle size={18} />
      </button>
      {aberto && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAberto(false)} />
          <div
            /* No celular ele é preso à TELA, não ao botão: com margem dos dois
               lados não existe posição de botão que o faça vazar. Ancorar no
               botão sempre quebra em alguma tela, porque em alguma tela ele
               cai perto da borda. No monitor, onde sobra espaço, volta a sair
               do botão como sempre foi. */
            className="fixed left-4 right-4 top-1/2 -translate-y-1/2 sm:absolute sm:left-0 sm:right-auto sm:top-9 sm:translate-y-0 sm:w-72 z-50 rounded-2xl p-4 text-left"
            style={{
              background: "rgba(58,16,28,0.98)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.12)",
              boxShadow: "0 16px 44px rgba(0,0,0,0.5)",
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="text-sm font-semibold text-cream">{titulo}</div>
              <button onClick={() => setAberto(false)} aria-label="Fechar" className="w-9 h-9 -mt-2 -mr-2 shrink-0 grid place-items-center rounded-full text-cream/50 hover:text-cream hover:bg-white/10">
                <X size={15} />
              </button>
            </div>
            <p className="text-[13px] text-cream/70 leading-snug mt-1.5">{texto}</p>
          </div>
        </>
      )}
    </span>
  );
}
