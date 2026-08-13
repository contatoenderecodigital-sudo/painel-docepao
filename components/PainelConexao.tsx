"use client";

// Painel da conexao do WhatsApp com DOIS estados:
//  1) NAO conectado: onboarding centrado (passos, botao verde, selo de seguranca,
//     beneficios da IA).
//  2) Conectado: status do numero, indicadores, toggle da IA e acoes
//     (reconectar / trocar numero / desconectar). Alerta vermelho se cair.

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConectarWhatsApp from "./ConectarWhatsApp";
import AjudaInfo from "./AjudaInfo";
import { useEmbeddedSignup } from "./useEmbeddedSignup";
import type { ConexaoWhatsapp } from "@/lib/banco/negocios";
import {
  Lock,
  Clock,
  MessageSquare,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Repeat,
  LogOut,
  MousePointerClick,
  Phone,
  ClipboardCheck,
  Bot,
} from "lucide-react";

function WhatsAppIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.04 2c-5.46 0-9.9 4.44-9.9 9.9 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22c5.46 0 9.9-4.44 9.9-9.9S17.5 2 12.04 2Zm5.8 14.16c-.24.68-1.4 1.3-1.94 1.34-.5.05-.98.23-3.3-.68-2.79-1.1-4.56-3.96-4.7-4.15-.14-.19-1.12-1.49-1.12-2.84 0-1.35.7-2.01.96-2.29.24-.26.53-.32.7-.32.18 0 .35 0 .5.01.16.01.38-.06.6.46.23.53.77 1.86.84 2 .07.14.11.3.02.48-.09.19-.14.3-.28.47-.14.16-.29.36-.42.48-.14.14-.28.28-.12.55.16.28.72 1.18 1.54 1.91 1.06.94 1.95 1.24 2.23 1.38.28.14.44.12.6-.07.16-.19.69-.8.87-1.08.18-.28.36-.23.6-.14.24.09 1.55.73 1.82.86.28.14.46.21.53.32.07.12.07.68-.17 1.36Z" />
    </svg>
  );
}

export default function PainelConexao({
  conexao,
  nome,
}: {
  conexao: ConexaoWhatsapp;
  nome: string;
}) {
  return (
    <div className="px-8 py-7">
      <div className="text-[11px] uppercase tracking-[0.2em] text-dourado font-semibold">Conectar</div>
      <div className="flex items-center gap-2 mt-1">
        <h1 className="font-title text-3xl font-bold text-cream">
          {conexao.conectado ? "WhatsApp do atendimento" : "Conectar o WhatsApp"}
        </h1>
        <AjudaInfo titulo="Conectar WhatsApp" texto="Onde você conecta o número de WhatsApp da padaria pra IA atender. Depois de conectado, aqui você liga, desliga, reconecta ou troca o número." />
      </div>
      <p className="text-sm text-cream/60 mt-1 mb-8 max-w-2xl">
        {conexao.conectado
          ? `O número de ${nome || "sua padaria"} está ligado ao atendimento com IA. Gerencie a conexão aqui.`
          : `Conecte o número de ${nome || "sua padaria"} e a IA começa a responder as mensagens na hora.`}
      </p>

      {conexao.conectado ? <Status conexao={conexao} /> : <Onboarding />}
    </div>
  );
}

// ═══════════════════ ESTADO 1 — ONBOARDING ═══════════════════
const PASSOS = [
  { Icon: MousePointerClick, titulo: "Clique em Conectar", texto: "O botão abre a janela oficial da Meta." },
  { Icon: Phone, titulo: "Escolha o número", texto: "Faça login na Meta e selecione o número da padaria." },
  { Icon: ClipboardCheck, titulo: "Autorize e pronto", texto: "A IA passa a atender neste número na hora." },
];
const BENEFICIOS = [
  "Responde os clientes 24 horas, todo dia",
  "Monta o orçamento e fecha o pedido sozinha",
  "Tira dúvida de cardápio, preço e horário",
  "Registra o pedido pra equipe só aprovar",
  "Cobra de volta quem pediu e sumiu",
];

function Onboarding() {
  return (
    <div className="max-w-3xl mx-auto flex flex-col items-center text-center">
      <div
        className="w-20 h-20 rounded-3xl grid place-items-center text-white mb-5"
        style={{ background: "linear-gradient(135deg,#25d366,#128c3e)", boxShadow: "0 14px 36px rgba(18,140,62,0.4)" }}
      >
        <WhatsAppIcon size={40} />
      </div>
      <h2 className="font-title text-2xl font-bold text-cream">Ligue o atendimento com IA</h2>
      <p className="text-sm text-cream/60 mt-1.5 max-w-md">
        Sem WhatsApp conectado o sistema não atende. São três passos rápidos, direto pela Meta.
      </p>

      {/* passos com conector */}
      <div className="grid md:grid-cols-3 gap-3 w-full mt-8">
        {PASSOS.map((p, i) => (
          <div key={i} className="relative glass rounded-2xl p-5 text-left">
            <div className="flex items-center gap-2.5 mb-2.5">
              <span className="grad-cobre w-8 h-8 rounded-lg grid place-items-center text-white shrink-0">
                <p.Icon size={17} />
              </span>
              <span className="grad-dourado w-6 h-6 rounded-full grid place-items-center text-vinho-d text-xs font-bold">
                {i + 1}
              </span>
            </div>
            <div className="text-sm font-semibold text-cream">{p.titulo}</div>
            <div className="text-[12.5px] text-cream/60 mt-0.5 leading-snug">{p.texto}</div>
            {i < PASSOS.length - 1 && (
              <div className="hidden md:block absolute right-[-10px] top-1/2 -translate-y-1/2 z-10 text-dourado/50">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* botao verde */}
      <div className="w-full mt-8">
        <ConectarWhatsApp />
      </div>

      {/* selo de seguranca */}
      <div className="flex items-center gap-2 text-[12.5px] text-cream/55 mt-4">
        <Lock size={15} className="text-[#5fd08a]" />
        Conexão oficial e segura via Meta. Não pedimos a sua senha.
      </div>

      {/* beneficios */}
      <div className="glass-soft rounded-2xl p-6 mt-8 w-full text-left">
        <div className="flex items-center gap-2 mb-3">
          <Bot size={17} className="text-dourado" />
          <span className="text-sm font-semibold text-cream">O que a IA vai fazer</span>
        </div>
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
          {BENEFICIOS.map((b) => (
            <div key={b} className="flex items-start gap-2 text-[13px] text-cream/75">
              <CheckCircle2 size={15} className="text-[#5fd08a] shrink-0 mt-0.5" />
              {b}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════ ESTADO 2 — CONECTADO ═══════════════════
function dataBr(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function inicial(nome: string | null) {
  return (nome?.trim()?.[0] ?? "").toUpperCase() || null;
}

function Status({ conexao }: { conexao: ConexaoWhatsapp }) {
  const router = useRouter();
  const { conectar, estado } = useEmbeddedSignup();
  const [ia, setIa] = useState(conexao.iaAtiva);
  const [salvandoIa, setSalvandoIa] = useState(false);
  const [desconectando, setDesconectando] = useState(false);
  const caiu = Boolean(conexao.problema);

  async function toggleIa() {
    const nova = !ia;
    setIa(nova);
    setSalvandoIa(true);
    try {
      await fetch("/api/whatsapp/ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ativa: nova }),
      });
    } catch {
      setIa(!nova); // reverte se falhar
    } finally {
      setSalvandoIa(false);
    }
  }

  async function desconectar() {
    if (!confirm("Desconectar o WhatsApp? A IA para de atender neste número até você reconectar.")) return;
    setDesconectando(true);
    try {
      await fetch("/api/whatsapp/desconectar", { method: "POST" });
      router.refresh();
    } finally {
      setDesconectando(false);
    }
  }

  function reconectar() {
    conectar((ok) => ok && setTimeout(() => router.refresh(), 900));
  }

  return (
    <div className="max-w-3xl">
      {/* alerta de queda */}
      {caiu && (
        <button
          onClick={reconectar}
          className="press w-full mb-4 rounded-2xl px-5 py-4 flex items-center gap-3 text-left transition"
          style={{ background: "rgba(224,30,30,0.14)", boxShadow: "inset 0 0 0 1px rgba(224,30,30,0.4)" }}
        >
          <AlertTriangle size={20} className="text-[#ff8a8a] shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-semibold text-[#ff8a8a]">WhatsApp desconectado</div>
            <div className="text-[12.5px] text-cream/65">A IA não está recebendo mensagens. Clique para reconectar.</div>
          </div>
          <span className="text-[13px] font-semibold text-[#ff8a8a] inline-flex items-center gap-1.5">
            <RefreshCw size={14} /> Reconectar
          </span>
        </button>
      )}

      {/* card de status */}
      <div
        className="glass-strong rounded-2xl p-6"
        style={{ boxShadow: caiu ? undefined : "inset 0 0 0 1px rgba(95,208,138,0.28)" }}
      >
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <div
              className="w-14 h-14 rounded-2xl grid place-items-center text-white text-xl font-bold"
              style={{ background: "linear-gradient(135deg,#25d366,#128c3e)" }}
            >
              {inicial(conexao.perfil) ?? <WhatsAppIcon size={26} />}
            </div>
            {!caiu && (
              <span
                className="absolute -right-1 -bottom-1 w-5 h-5 rounded-full grid place-items-center"
                style={{ background: "#128c3e", boxShadow: "0 0 0 3px rgba(58,16,28,0.9)" }}
              >
                <CheckCircle2 size={13} className="text-white" />
              </span>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-cream tracking-tight-apple">
                {conexao.perfil || "WhatsApp conectado"}
              </span>
              {!caiu && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1" style={{ background: "rgba(95,208,138,0.16)", color: "#5fd08a" }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#5fd08a]" /> Ativo
                </span>
              )}
            </div>
            <div className="text-sm text-cream/65 mt-0.5 inline-flex items-center gap-1.5">
              <WhatsAppIcon size={14} />
              {conexao.numero || "número conectado"}
            </div>
          </div>
        </div>

        {/* indicadores */}
        <div className="grid grid-cols-3 gap-3 mt-6">
          <Indicador
            icon={<span className="w-2 h-2 rounded-full inline-block" style={{ background: caiu ? "#ff8a8a" : "#5fd08a" }} />}
            rotulo="Status"
            valor={caiu ? "Offline" : "Online"}
          />
          <Indicador icon={<Clock size={15} className="text-dourado" />} rotulo="Conectado desde" valor={dataBr(conexao.conectadoEm) ?? "hoje"} />
          <Indicador icon={<MessageSquare size={15} className="text-dourado" />} rotulo="Respondidas hoje" valor={String(conexao.mensagensHoje)} />
        </div>
      </div>

      {/* toggle da IA */}
      <div className="glass rounded-2xl p-5 mt-4 flex items-center gap-4">
        <span className="grad-dourado w-10 h-10 rounded-xl grid place-items-center text-vinho-d shrink-0">
          <Bot size={19} />
        </span>
        <div className="flex-1">
          <div className="text-sm font-semibold text-cream">Resposta automática da IA</div>
          <div className="text-[12.5px] text-cream/60">
            {ia ? "A IA responde os clientes sozinha." : "Desligada. As mensagens chegam, mas ninguém responde automático."}
          </div>
        </div>
        {salvandoIa && <Loader2 size={16} className="animate-spin text-cream/50" />}
        <button
          type="button"
          role="switch"
          aria-checked={ia}
          onClick={toggleIa}
          className="relative h-6 w-11 rounded-full transition-colors shrink-0 press"
          style={{ background: ia ? "linear-gradient(135deg,#1fae54,#128c3e)" : "rgba(255,255,255,0.16)" }}
        >
          <span className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all" style={{ left: ia ? "22px" : "2px" }} />
        </button>
      </div>

      {/* acoes */}
      <div className="flex flex-wrap gap-2.5 mt-4">
        <button
          onClick={reconectar}
          disabled={estado === "conectando"}
          className="press glass rounded-lg px-4 py-2.5 text-sm text-cream/85 inline-flex items-center gap-2 hover:bg-white/[0.08] transition-colors disabled:opacity-60"
        >
          {estado === "conectando" ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} Reconectar
        </button>
        <button
          onClick={reconectar}
          disabled={estado === "conectando"}
          className="press glass rounded-lg px-4 py-2.5 text-sm text-cream/85 inline-flex items-center gap-2 hover:bg-white/[0.08] transition-colors disabled:opacity-60"
        >
          <Repeat size={15} /> Trocar número
        </button>
        <button
          onClick={desconectar}
          disabled={desconectando}
          className="press rounded-lg px-4 py-2.5 text-sm font-medium inline-flex items-center gap-2 transition-colors disabled:opacity-60 ml-auto"
          style={{ background: "rgba(224,30,30,0.12)", color: "#ff8a8a" }}
        >
          {desconectando ? <Loader2 size={15} className="animate-spin" /> : <LogOut size={15} />} Desconectar número
        </button>
      </div>
    </div>
  );
}

function Indicador({ icon, rotulo, valor }: { icon: React.ReactNode; rotulo: string; valor: string }) {
  return (
    <div className="glass-soft rounded-xl px-4 py-3">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-cream/50 font-semibold">
        {icon}
        {rotulo}
      </div>
      <div className="text-lg font-bold text-cream mt-1">{valor}</div>
    </div>
  );
}
