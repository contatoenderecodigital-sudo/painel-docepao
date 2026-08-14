"use client";

// Login premium glassmorphism: fundo dark + vidro fosco + destaque na cor da
// marca do cliente (var --brand-dourado). Base pra todos os painéis de cliente.

import { useActionState, useState } from "react";
import { Mail, Lock, Eye, EyeOff, Loader2, ArrowRight } from "lucide-react";
import { entrar } from "./acao";

export default function Login() {
  const [erro, acao, pendente] = useActionState(entrar, null);
  const [verSenha, setVerSenha] = useState(false);

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-5"
      style={{
        background:
          "radial-gradient(900px 600px at 18% 12%, rgba(187,146,31,0.16), transparent 60%)," +
          "radial-gradient(760px 620px at 88% 92%, rgba(110,31,48,0.28), transparent 62%)," +
          "linear-gradient(160deg, #0d0b0a 0%, #16100c 55%, #0b0a0a 100%)",
        color: "#f4efe6",
      }}
    >
      {/* grão sutil */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-[0.05] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      {/* CARD DE VIDRO */}
      <div
        className="relative w-full max-w-md rounded-[28px] px-8 py-10 sm:px-10"
        style={{
          background: "rgba(255,255,255,0.055)",
          backdropFilter: "blur(26px) saturate(150%)",
          WebkitBackdropFilter: "blur(26px) saturate(150%)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderTop: "1px solid rgba(255,255,255,0.22)",
          boxShadow: "0 30px 80px rgba(0,0,0,0.55)",
        }}
      >
        {/* marca */}
        <div className="flex justify-center mb-6">
          <div
            className="h-14 w-14 rounded-2xl grid place-items-center text-xl font-extrabold"
            style={{
              background: "linear-gradient(140deg, var(--brand-dourado,#bb921f), var(--brand-dourado-l,#e7cf94))",
              color: "#1a140a",
              boxShadow: "0 10px 26px rgba(187,146,31,0.35)",
            }}
          >
            ED
          </div>
        </div>

        <h1 className="text-center text-3xl font-extrabold tracking-tight">
          Bem-vindo{" "}
          <span style={{ color: "var(--brand-dourado,#bb921f)" }}>de volta</span>
        </h1>
        <p className="text-center text-sm mt-2" style={{ color: "rgba(244,239,230,0.6)" }}>
          Acesse o painel do seu negócio
        </p>

        <form action={acao} className="mt-8 flex flex-col gap-4">
          {/* email */}
          <label className="block">
            <span className="text-xs font-semibold" style={{ color: "rgba(244,239,230,0.7)" }}>E-mail</span>
            <div
              className="mt-1.5 flex items-center gap-3 rounded-2xl px-4 py-3"
              style={{ background: "rgba(0,0,0,0.28)", border: "1px solid rgba(255,255,255,0.12)" }}
            >
              <Mail size={17} style={{ color: "rgba(244,239,230,0.5)" }} />
              <input
                name="email"
                type="email"
                required
                placeholder="voce@negocio.com"
                autoComplete="email"
                className="w-full bg-transparent outline-none text-[15px]"
                style={{ color: "#f4efe6" }}
              />
            </div>
          </label>

          {/* senha */}
          <label className="block">
            <span className="text-xs font-semibold" style={{ color: "rgba(244,239,230,0.7)" }}>Senha</span>
            <div
              className="mt-1.5 flex items-center gap-3 rounded-2xl px-4 py-3"
              style={{ background: "rgba(0,0,0,0.28)", border: "1px solid rgba(255,255,255,0.12)" }}
            >
              <Lock size={17} style={{ color: "rgba(244,239,230,0.5)" }} />
              <input
                name="senha"
                type={verSenha ? "text" : "password"}
                required
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full bg-transparent outline-none text-[15px]"
                style={{ color: "#f4efe6" }}
              />
              <button type="button" onClick={() => setVerSenha((v) => !v)} aria-label="Mostrar senha" style={{ color: "rgba(244,239,230,0.5)" }}>
                {verSenha ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </label>

          <div className="flex justify-end -mt-1">
            <button type="button" className="text-xs hover:underline" style={{ color: "var(--brand-dourado,#bb921f)" }}>
              Esqueceu a senha?
            </button>
          </div>

          {erro && (
            <div
              className="rounded-xl px-4 py-2.5 text-sm"
              style={{ background: "rgba(255,59,48,0.12)", border: "1px solid rgba(255,59,48,0.3)", color: "#ffb4ae" }}
            >
              {erro}
            </div>
          )}

          <button
            type="submit"
            disabled={pendente}
            className="mt-1 flex items-center justify-center gap-2 rounded-2xl py-3.5 text-[15px] font-bold transition disabled:opacity-70"
            style={{
              background: "linear-gradient(135deg, var(--brand-dourado,#bb921f), var(--brand-dourado-l,#e7cf94))",
              color: "#1a140a",
              boxShadow: "0 12px 28px rgba(187,146,31,0.3)",
            }}
          >
            {pendente ? <Loader2 size={18} className="animate-spin" /> : <>Entrar <ArrowRight size={18} /></>}
          </button>
        </form>

        <p className="text-center text-xs mt-7" style={{ color: "rgba(244,239,230,0.4)" }}>
          Endereço Digital · acesso seguro
        </p>
      </div>
    </div>
  );
}
