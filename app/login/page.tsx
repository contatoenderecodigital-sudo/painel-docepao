"use client";

// Login premium do Endereço Digital: vitrine navy + dourado à esquerda (marca,
// título, benefícios, autoridade e mock de conversa), formulário limpo à direita.
// Identidade: Navy #0B1838 (base) + Dourado #C9A961 (destaque). Sóbrio e elegante.

import { useActionState, useState } from "react";
import { Mail, Lock, Eye, EyeOff, Loader2, MapPin, ShieldCheck } from "lucide-react";
import { entrar } from "./acao";

const NAVY = "#0B1838";
const OURO = "#C9A961";

const GRAO =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.6'/%3E%3C/svg%3E\")";

const BENEFICIOS = [
  "Responde na hora, dia e noite",
  "Monta orçamento e organiza os pedidos sozinho",
  "Nenhum cliente fica sem resposta",
];

export default function Login() {
  const [erro, acao, pendente] = useActionState(entrar, null);
  const [verSenha, setVerSenha] = useState(false);

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row" style={{ background: "#f6f4ee", color: "#16203a" }}>
      {/* ---------- VITRINE (esquerda / topo no mobile) ---------- */}
      <div
        className="relative overflow-hidden lg:w-[55%] flex flex-col justify-center px-8 py-12 lg:px-16 lg:py-16 text-white"
        style={{ background: `linear-gradient(160deg, ${NAVY} 0%, #12224a 100%)` }}
      >
        {/* brilho dourado sutil (aurora), pra o fundo não ser chapado */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(620px 440px at 15% 18%, rgba(201,169,97,0.20), transparent 60%), radial-gradient(560px 520px at 88% 88%, rgba(201,169,97,0.10), transparent 62%)",
          }}
        />
        <div className="absolute inset-0 pointer-events-none opacity-[0.04]" style={{ backgroundImage: GRAO }} />

        <div className="relative z-10 flex flex-col items-center text-center lg:items-start lg:text-left max-w-lg mx-auto lg:mx-0">
          {/* marca */}
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 lg:w-12 lg:h-12 rounded-[13px] grid place-items-center shrink-0"
              style={{ border: `1px solid ${OURO}`, background: "rgba(201,169,97,0.08)" }}
            >
              <MapPin className="w-6 h-6" strokeWidth={2.2} style={{ color: OURO }} />
            </div>
            <span className="font-title text-xl lg:text-2xl tracking-tight-apple text-white">Endereço Digital</span>
          </div>

          {/* título forte */}
          <h1 className="font-title text-3xl lg:text-[42px] leading-[1.1] mt-8 lg:mt-10 text-white text-balance">
            Atendimento no WhatsApp que trabalha sozinho pelo seu negócio.
          </h1>

          {/* micro-benefícios com traço dourado */}
          <ul className="mt-8 lg:mt-9 space-y-3.5 w-full max-w-md">
            {BENEFICIOS.map((b) => (
              <li key={b} className="flex items-center gap-3.5 text-left">
                <span className="h-px w-6 shrink-0" style={{ background: OURO }} />
                <span className="text-[15px] lg:text-base text-white/85">{b}</span>
              </li>
            ))}
          </ul>

          {/* autoridade */}
          <div className="flex items-center gap-2.5 mt-8">
            <ShieldCheck className="w-[18px] h-[18px]" strokeWidth={2} style={{ color: OURO }} />
            <span className="text-[13px] tracking-wide text-white/70">Parceiro Oficial do WhatsApp (Meta)</span>
          </div>

          {/* mock de conversa (só desktop) */}
          <div className="hidden lg:block w-full max-w-md mt-12">
            <div
              className="rounded-2xl p-4"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(201,169,97,0.22)" }}
            >
              <div className="flex mb-2">
                <div className="bg-white/95 text-[#12224a] text-[13px] rounded-xl rounded-tl-sm px-3 py-2">
                  Oi! Vocês atendem por aqui?
                </div>
              </div>
              <div className="flex justify-end">
                <div
                  className="text-[13px] rounded-xl rounded-br-sm px-3 py-2 max-w-[85%]"
                  style={{ background: OURO, color: NAVY, fontWeight: 500 }}
                >
                  Atendemos sim, todo dia. O que você precisa?
                </div>
              </div>
              <div className="text-[11px] text-white/45 text-center pt-2.5">Atendimento automático no WhatsApp</div>
            </div>
          </div>
        </div>

        <div className="hidden lg:block absolute bottom-6 left-16 z-10 text-[11px] text-white/35">Endereço Digital</div>
      </div>

      {/* ---------- FORMULÁRIO (direita / abaixo no mobile) ---------- */}
      <div className="lg:w-[45%] flex items-center justify-center px-6 py-14 lg:py-0">
        <form action={acao} className="w-full max-w-sm">
          <h2 className="font-title text-[28px] tracking-tight-apple" style={{ color: NAVY }}>
            Bem-vindo de volta
          </h2>
          <p className="mt-1.5 mb-8" style={{ color: "#5a6478" }}>
            Acesse o painel do seu negócio
          </p>

          {/* e-mail */}
          <label className="block">
            <span className="text-sm font-medium" style={{ color: "#5a6478" }}>
              E-mail
            </span>
            <div className="relative mt-1.5">
              <Mail size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "#9aa2b1" }} />
              <input
                name="email"
                type="email"
                required
                autoFocus
                autoComplete="email"
                placeholder="voce@negocio.com"
                className="w-full rounded-xl border border-[#dfe1e8] bg-white pl-10 pr-3 py-3 text-sm text-[#16203a] placeholder:text-[#b4bac6] outline-none transition focus:border-[#C9A961] focus:ring-2 focus:ring-[#C9A961]/25"
              />
            </div>
          </label>

          {/* senha */}
          <label className="block mt-4">
            <span className="text-sm font-medium" style={{ color: "#5a6478" }}>
              Senha
            </span>
            <div className="relative mt-1.5">
              <Lock size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "#9aa2b1" }} />
              <input
                name="senha"
                type={verSenha ? "text" : "password"}
                required
                autoComplete="current-password"
                placeholder="********"
                className="w-full rounded-xl border border-[#dfe1e8] bg-white pl-10 pr-10 py-3 text-sm text-[#16203a] placeholder:text-[#b4bac6] outline-none transition focus:border-[#C9A961] focus:ring-2 focus:ring-[#C9A961]/25"
              />
              <button
                type="button"
                onClick={() => setVerSenha((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                style={{ color: "#9aa2b1" }}
                aria-label={verSenha ? "Ocultar senha" : "Mostrar senha"}
                tabIndex={-1}
              >
                {verSenha ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </label>

          <div className="text-right mt-2">
            <button type="button" className="text-xs hover:underline" style={{ color: OURO }}>
              Esqueceu a senha?
            </button>
          </div>

          {erro ? <div className="text-sm text-red-600 mt-3">{erro}</div> : null}

          <button
            type="submit"
            disabled={pendente}
            className="press w-full mt-6 py-3 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition disabled:opacity-70 disabled:cursor-default"
            style={{ background: OURO, color: NAVY }}
          >
            {pendente ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Entrando...
              </>
            ) : (
              "Entrar"
            )}
          </button>

          <div className="text-center text-[11px] mt-10" style={{ color: "#9aa2b1" }}>
            Endereço Digital
          </div>
        </form>
      </div>
    </div>
  );
}
