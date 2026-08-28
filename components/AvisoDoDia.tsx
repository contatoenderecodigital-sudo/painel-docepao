"use client";

// Aviso do dia: a dona escreve novidades de hoje (ex: "sem pão após 18h") e a
// IA passa a considerar isso nas respostas do dia. Vira o dia, expira sozinho.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Megaphone, Trash2, Check } from "lucide-react";
import { horaBR, dataCurtaBR } from "@/lib/aviso";
import { avisoDeSessao } from "@/lib/buscar-do-painel";

export default function AvisoDoDia({
  texto: textoInicial,
  atualizadoEm: atualizadoInicial,
  ativoHoje: ativoInicial,
}: {
  texto: string | null;
  atualizadoEm: string | null;
  ativoHoje: boolean;
}) {
  const router = useRouter();
  const [texto, setTexto] = useState(textoInicial ?? "");
  const [atualizadoEm, setAtualizadoEm] = useState(atualizadoInicial);
  const [ativoHoje, setAtivoHoje] = useState(ativoInicial);
  const [salvando, setSalvando] = useState(false);
  const [limpando, setLimpando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  // FALHAR CALADO E QUASE TAO RUIM QUANTO MENTIR.
  //
  // As duas acoes daqui ja conferiam a resposta, entao a tela nunca dizia que
  // salvou sem salvar. Mas quando falhava ela nao dizia NADA: a dona escrevia
  // "hoje nao tem entrega", clicava, e nao aparecia nem o certinho nem o erro.
  // Sem saber que falhou, ela sai da tela achando que o aviso esta no ar.
  //
  // No `salvar` era pior: o `await r.json()` LANCA quando a resposta nao e
  // JSON, e o try so tinha `finally`. Um 401, que responde com a pagina de
  // login, virava excecao solta e a tela ficava exatamente igual.
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    if (!texto.trim()) return;
    setSalvando(true);
    setSalvo(false);
    setErro(null);
    try {
      const r = await fetch("/api/aviso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: texto.trim() }),
      });
      // O status vem antes do corpo: `r.json()` de uma resposta que nao e JSON
      // lanca, e ai o motivo da falha se perde.
      if (!r.ok) {
        setErro(
          avisoDeSessao(r.status) ??
            "Não consegui salvar o aviso. Ele NÃO está valendo: o que você escreveu continua aqui, tente de novo.",
        );
        return;
      }
      const d = (await r.json()) as { ok?: boolean; atualizadoEm?: string };
      if (!d.ok) {
        setErro("Não consegui salvar o aviso. Ele NÃO está valendo: tente de novo.");
        return;
      }
      setAtualizadoEm(d.atualizadoEm ?? new Date().toISOString());
      setAtivoHoje(true);
      setSalvo(true);
      router.refresh();
      setTimeout(() => setSalvo(false), 2500);
    } catch {
      setErro("Sem conexão. O aviso NÃO está valendo: o que você escreveu continua aqui.");
    } finally {
      setSalvando(false);
    }
  }

  async function limpar() {
    setLimpando(true);
    setErro(null);
    try {
      const r = await fetch("/api/aviso", { method: "DELETE" });
      // Sem conferir, a tela dizia que o aviso saiu e a IA continuava contando
      // pro cliente que hoje nao tem entrega.
      if (!r.ok) {
        setErro(
          avisoDeSessao(r.status) ??
            "Não consegui tirar o aviso. Ele CONTINUA VALENDO para os clientes: tente de novo.",
        );
        return;
      }
      setTexto("");
      setAtualizadoEm(null);
      setAtivoHoje(false);
      router.refresh();
    } catch {
      setErro("Sem conexão. O aviso CONTINUA VALENDO para os clientes: tente de novo.");
    } finally {
      setLimpando(false);
    }
  }

  return (
    <div className="glass rounded-2xl p-6 max-w-2xl">
      <div className="flex items-start gap-3">
        <span className="grad-dourado w-10 h-10 rounded-xl grid place-items-center text-vinho-d shrink-0">
          <Megaphone size={19} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-semibold text-cream">Aviso do dia</span>
            {atualizadoEm &&
              (ativoHoje ? (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1" style={{ background: "rgba(95,208,138,0.16)", color: "#5fd08a" }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#5fd08a]" /> ativo hoje
                </span>
              ) : (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(245,235,220,0.10)", color: "rgba(245,235,220,0.5)" }}>
                  expirado
                </span>
              ))}
          </div>
          <p className="text-[13px] text-cream/60 mt-0.5">
            Novidades de hoje que a IA deve avisar os clientes. Vira o dia, some sozinho.
          </p>
        </div>
      </div>

      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Ex: hoje sem pão após as 18h"
        rows={3}
        className="w-full mt-4 rounded-xl bg-white/[0.05] border border-white/12 px-4 py-3 text-sm text-cream placeholder:text-cream/40 outline-none focus:ring-1 focus:ring-dourado/40 resize-none"
      />

      <div className="flex items-center gap-2.5 mt-3">
        <button
          onClick={salvar}
          disabled={salvando || !texto.trim()}
          className="btn-cobre press px-4 py-2.5 rounded-lg text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-50"
        >
          {salvando ? <Loader2 size={15} className="animate-spin" /> : salvo ? <Check size={15} /> : null}
          {salvo ? "Salvo" : "Salvar"}
        </button>
        <button
          onClick={limpar}
          disabled={limpando || (!textoInicial && !texto)}
          className="press px-4 py-2.5 rounded-lg text-sm text-cream/70 border border-white/12 hover:bg-white/[0.06] inline-flex items-center gap-2 transition-colors disabled:opacity-50"
        >
          {limpando ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />} Limpar aviso
        </button>

        {atualizadoEm && (
          <span className="text-[12px] text-cream/45 ml-auto">
            atualizado {ativoHoje ? "hoje" : dataCurtaBR(atualizadoEm)} {horaBR(atualizadoEm)}
          </span>
        )}
      </div>

      {erro && <div className="text-[12.5px] text-[#ff8a8a] mt-3">{erro}</div>}
    </div>
  );
}
