"use client";

// Botao "Conectar WhatsApp" (Embedded Signup). Usa o hook useEmbeddedSignup e,
// ao conectar, recarrega a rota pro painel virar o estado "conectado".

import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { useEmbeddedSignup } from "./useEmbeddedSignup";

function WhatsAppIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.04 2c-5.46 0-9.9 4.44-9.9 9.9 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22c5.46 0 9.9-4.44 9.9-9.9S17.5 2 12.04 2Zm5.8 14.16c-.24.68-1.4 1.3-1.94 1.34-.5.05-.98.23-3.3-.68-2.79-1.1-4.56-3.96-4.7-4.15-.14-.19-1.12-1.49-1.12-2.84 0-1.35.7-2.01.96-2.29.24-.26.53-.32.7-.32.18 0 .35 0 .5.01.16.01.38-.06.6.46.23.53.77 1.86.84 2 .07.14.11.3.02.48-.09.19-.14.3-.28.47-.14.16-.29.36-.42.48-.14.14-.28.28-.12.55.16.28.72 1.18 1.54 1.91 1.06.94 1.95 1.24 2.23 1.38.28.14.44.12.6-.07.16-.19.69-.8.87-1.08.18-.28.36-.23.6-.14.24.09 1.55.73 1.82.86.28.14.46.21.53.32.07.12.07.68-.17 1.36Z" />
    </svg>
  );
}

export default function ConectarWhatsApp() {
  const router = useRouter();
  const { pronto, estado, msg, conectar } = useEmbeddedSignup();

  return (
    <div className="w-full max-w-md mx-auto">
      <button
        onClick={() => conectar((ok) => ok && setTimeout(() => router.refresh(), 900))}
        disabled={!pronto || estado === "conectando"}
        className="press w-full py-4 rounded-xl text-white text-[16px] font-semibold flex items-center justify-center gap-2.5 transition disabled:opacity-60 disabled:cursor-default"
        style={{ background: "linear-gradient(135deg,#25d366,#128c3e)", boxShadow: "0 10px 28px rgba(18,140,62,0.4)" }}
      >
        {estado === "conectando" ? <Loader2 size={19} className="animate-spin" /> : <WhatsAppIcon size={20} />}
        {estado === "conectando" ? "Conectando..." : "Conectar WhatsApp"}
      </button>

      {estado === "ok" && (
        <div className="mt-4 flex items-start gap-2 rounded-xl px-4 py-3 text-sm" style={{ background: "rgba(53,196,111,0.14)", color: "#5fd08a" }}>
          <CheckCircle2 size={18} className="shrink-0 mt-0.5" /> {msg}
        </div>
      )}
      {estado === "erro" && (
        <div className="mt-4 flex items-start gap-2 rounded-xl px-4 py-3 text-sm" style={{ background: "rgba(224,30,30,0.12)", color: "#ff8a8a" }}>
          <AlertTriangle size={18} className="shrink-0 mt-0.5" /> {msg}
        </div>
      )}
      {!pronto && <div className="mt-3 text-xs text-cream/50 text-center">Carregando o conector do WhatsApp...</div>}
    </div>
  );
}
