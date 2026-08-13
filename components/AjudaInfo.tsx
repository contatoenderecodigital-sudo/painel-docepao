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
        className="press w-7 h-7 rounded-full grid place-items-center text-cream/50 hover:text-dourado hover:bg-white/[0.06] transition-colors"
      >
        <HelpCircle size={18} />
      </button>
      {aberto && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAberto(false)} />
          <div
            className="absolute left-0 top-9 z-50 w-72 rounded-2xl p-4 text-left"
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
              <button onClick={() => setAberto(false)} className="text-cream/50 hover:text-cream -mt-0.5">
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
