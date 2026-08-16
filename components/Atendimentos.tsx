"use client";

// ============================================================================
//  ATENDIMENTOS — o WhatsApp Web da Doce Pão.
//  O número da padaria sai do celular pra Cloud API da Meta: a dona perde o
//  WhatsApp normal, então ESTA tela substitui o WhatsApp dela. Funciona no PC
//  (lista + chat lado a lado) e no celular (lista ocupa a tela; ao abrir uma
//  conversa, ela ocupa a tela com um botão voltar).
//
//  Camada de dados reaproveitada: /api/conversas (lista + histórico + janela de
//  24h), /api/conversas/enviar (texto), /api/conversas/anexo (imagem/doc),
//  /api/conversas/templates + /template (fora da janela / conversa nova),
//  /api/midia/[id] (mídia recebida). Atualização por POLLING leve (~6s).
// ============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Conversa, Mensagem, TipoMidia } from "@/lib/tipos";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatarTelefoneBR, linkWhatsapp, brl } from "@/lib/tipos";
import CampoTelefone, { telefoneCompleto } from "@/components/CampoTelefone";
import {
  Search, Plus, Paperclip, SendHorizontal, ArrowLeft, Bot, X,
  MessageSquare, Info, FileText, Download, CheckCheck, AlertCircle,
  Clock, ShieldAlert,
} from "lucide-react";

const CORES = ["#5b8c7b", "#c58a3d", "#7a6cae", "#4a7ba6", "#a85b52", "#6f9b52", "#b0713e", "#8a5a86"];

const POPOVER: React.CSSProperties = {
  background: "rgba(58,16,28,0.98)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: "1px solid rgba(255,255,255,0.12)",
  boxShadow: "0 16px 44px rgba(0,0,0,0.5)",
};

// mensagem local (envio otimista): guarda o id do servidor (pra reconciliar no
// polling) e um blobUrl (preview de anexo antes de subir).
type Pend = Mensagem & { serverId?: string; blobUrl?: string };
type Template = { nome: string; idioma: string; categoria: string; corpo: string; variaveis: number };

function iniciais(nome: string) {
  const p = nome.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase() || "?";
}
function corDoNome(nome: string) {
  let h = 0;
  for (let i = 0; i < nome.length; i++) h = (h * 31 + nome.charCodeAt(i)) >>> 0;
  return CORES[h % CORES.length];
}
function agora() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function rotuloDia(data?: string): string {
  if (!data) return "";
  if (data === hojeISO()) return "Hoje";
  const o = new Date();
  o.setDate(o.getDate() - 1);
  const ontem = `${o.getFullYear()}-${String(o.getMonth() + 1).padStart(2, "0")}-${String(o.getDate()).padStart(2, "0")}`;
  if (data === ontem) return "Ontem";
  const [Y, M, D] = data.split("-");
  return `${D}/${M}/${Y}`;
}
function renderPreview(corpo: string, params: string[]): string {
  return corpo.replace(/\{\{(\d+)\}\}/g, (_, n) => params[Number(n) - 1] || `{{${n}}}`);
}

function Avatar({ nome, tam = 44, raio = 12 }: { nome: string; tam?: number; raio?: number }) {
  return (
    <div
      className="shrink-0 grid place-items-center text-white font-semibold select-none"
      style={{ width: tam, height: tam, borderRadius: raio, background: corDoNome(nome), fontSize: tam * 0.34 }}
      aria-hidden="true"
    >
      {iniciais(nome)}
    </div>
  );
}

function WhatsAppIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.04 2c-5.46 0-9.9 4.44-9.9 9.9 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22c5.46 0 9.9-4.44 9.9-9.9S17.5 2 12.04 2Zm5.8 14.16c-.24.68-1.4 1.3-1.94 1.34-.5.05-.98.23-3.3-.68-2.79-1.1-4.56-3.96-4.7-4.15-.14-.19-1.12-1.49-1.12-2.84 0-1.35.7-2.01.96-2.29.24-.26.53-.32.7-.32.18 0 .35 0 .5.01.16.01.38-.06.6.46.23.53.77 1.86.84 2 .07.14.11.3.02.48-.09.19-.14.3-.28.47-.14.16-.29.36-.42.48-.14.14-.28.28-.12.55.16.28.72 1.18 1.54 1.91 1.06.94 1.95 1.24 2.23 1.38.28.14.44.12.6-.07.16-.19.69-.8.87-1.08.18-.28.36-.23.6-.14.24.09 1.55.73 1.82.86.28.14.46.21.53.32.07.12.07.68-.17 1.36Z" />
    </svg>
  );
}

// ---------- Balão de mensagem (texto + mídia) ----------
function Balao({ m, primeiro, onImagem }: { m: Pend; primeiro: boolean; onImagem: (url: string) => void }) {
  const isCliente = m.de === "cliente";
  const src = m.blobUrl || (m.midiaId ? `/api/midia/${m.midiaId}` : null);
  const bolhaBase =
    "rounded-[14px] text-[15px] md:text-[14px] leading-[1.45] whitespace-pre-line " +
    (isCliente ? "text-[#4a1020] rounded-bl-[4px]" : "text-white rounded-br-[4px]");
  const bolhaStyle: React.CSSProperties = isCliente
    ? { background: "rgba(255,255,255,0.95)", boxShadow: "0 3px 12px rgba(0,0,0,0.16)" }
    : { background: "linear-gradient(135deg,#96741a,#e7cf94)", boxShadow: "0 4px 14px rgba(187,146,31,0.28)" };

  // legenda que acompanha a mídia: tira as notas internas ("[o cliente enviou
  // ...]") e os rótulos automáticos (Foto/Áudio/nome do arquivo), pra não repetir.
  const isMidia = m.tipo === "imagem" || m.tipo === "audio" || m.tipo === "documento";
  let legenda = (m.texto || "").replace(/\[o cliente enviou[^\]]*\]/gi, "").replace(/\[midia\]/gi, "").trim();
  const rotulosAuto = [m.midiaNome ?? "", "foto", "áudio", "audio"].map((s) => s.toLowerCase());
  if (isMidia && legenda && rotulosAuto.includes(legenda.toLowerCase())) legenda = "";

  const HoraSelo = () => (
    <span className={"text-[10px] inline-flex items-center gap-1 align-bottom " + (isCliente ? "text-black/35" : "text-white/60")}>
      {m.hora}
      {!isCliente && m.de === "equipe" && m.status === "enviando" && <Clock size={11} />}
      {!isCliente && m.de === "equipe" && m.status === "enviado" && <CheckCheck size={12} />}
      {!isCliente && m.de === "equipe" && m.status === "erro" && <AlertCircle size={12} className="text-red-200" />}
    </span>
  );

  return (
    <div className={"flex " + (primeiro ? "mt-3" : "mt-1") + (isCliente ? " justify-start" : " justify-end")}>
      <div className="max-w-[78%] md:max-w-[64%]">
        {!isCliente && m.de === "equipe" && primeiro && <div className="text-[10px] text-cream/45 mb-0.5 text-right pr-1">Você</div>}
        {!isCliente && m.de === "ia" && primeiro && <div className="text-[10px] text-cream/45 mb-0.5 text-right pr-1 flex items-center justify-end gap-1"><Bot size={11} /> Atendente</div>}
        <div className={bolhaBase} style={{ ...bolhaStyle, padding: m.tipo === "imagem" && src ? 4 : undefined }}>
          {/* IMAGEM */}
          {m.tipo === "imagem" && src && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt="Imagem enviada"
              onClick={() => onImagem(src)}
              className="rounded-[11px] max-h-64 w-auto object-cover cursor-zoom-in block"
            />
          )}
          {/* ÁUDIO */}
          {m.tipo === "audio" && src && (
            <div className={isCliente ? "px-2.5 py-2" : "px-2.5 py-2"}>
              <audio controls preload="none" src={src} className="max-w-[220px] h-9" />
            </div>
          )}
          {/* DOCUMENTO */}
          {m.tipo === "documento" && (
            <a
              href={src ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              className={"flex items-center gap-2.5 px-3.5 py-2.5 " + (src ? "" : "pointer-events-none opacity-70")}
            >
              <span className={"w-9 h-9 rounded-lg grid place-items-center shrink-0 " + (isCliente ? "bg-black/8 text-[#96741a]" : "bg-white/20 text-white")}>
                <FileText size={18} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium">{m.midiaNome || "Documento"}</span>
                <span className={"text-[11px] " + (isCliente ? "text-black/45" : "text-white/70")}>Abrir arquivo</span>
              </span>
              <Download size={15} className={isCliente ? "text-black/40 shrink-0" : "text-white/70 shrink-0"} />
            </a>
          )}
          {/* TEXTO puro */}
          {!isMidia && (
            <div className="px-3.5 py-2">
              {m.texto}
              <span className="ml-2">
                <HoraSelo />
              </span>
            </div>
          )}
          {/* LEGENDA da mídia (quando há uma real) */}
          {isMidia && legenda && (
            <div className="px-3.5 pb-2 pt-1">
              {legenda}
              <span className="ml-2">
                <HoraSelo />
              </span>
            </div>
          )}
          {/* rodapé de hora quando a mídia não tem legenda */}
          {isMidia && !legenda && (
            <div className="flex items-center justify-end pr-2 pb-1 -mt-0.5">
              <HoraSelo />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Atendimentos({ conversas: conversasIniciais }: { conversas: Conversa[] }) {
  const [conversas, setConversas] = useState<Conversa[]>(conversasIniciais);
  const [busca, setBusca] = useState("");
  const [ativaId, setAtivaId] = useState<string | undefined>(undefined);
  const [vista, setVista] = useState<"lista" | "chat">("lista");
  const [texto, setTexto] = useState("");
  const [pendentes, setPendentes] = useState<Record<string, Pend[]>>({});
  const [naoLidasLocal, setNaoLidasLocal] = useState<Record<string, number>>({});
  const [enviando, setEnviando] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [tplAberto, setTplAberto] = useState(false);
  const [novaAberto, setNovaAberto] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [, setTick] = useState(0); // força recomputar a janela de 24h
  const fileRef = useRef<HTMLInputElement>(null);
  const fim = useRef<HTMLDivElement>(null);
  const ativaIdRef = useRef<string | undefined>(undefined);
  ativaIdRef.current = ativaId;

  const mostrarToast = useCallback((t: string) => {
    setToast(t);
    setTimeout(() => setToast((v) => (v === t ? null : v)), 3200);
  }, []);

  // Busca a lista/histórico do servidor e reconcilia os envios otimistas.
  const atualizar = useCallback(async () => {
    try {
      const r = await fetch("/api/conversas", { cache: "no-store" });
      if (!r.ok) return;
      const data = (await r.json()) as Conversa[];
      setConversas(data);
      // reconcilia pendentes: some com o que já chegou do servidor.
      setPendentes((prev) => {
        const next: Record<string, Pend[]> = {};
        for (const [id, arr] of Object.entries(prev)) {
          const conv = data.find((c) => c.id === id);
          if (!conv) { next[id] = arr; continue; }
          const ids = new Set(conv.mensagens.map((m) => m.id).filter(Boolean));
          next[id] = arr.filter((p) => {
            if (p.status !== "enviado") return true; // mantém 'enviando'/'erro'
            if (p.serverId && ids.has(p.serverId)) return false;
            if (conv.mensagens.some((m) => m.de === "equipe" && m.texto === p.texto)) return false;
            return true;
          });
          if (!next[id].length) delete next[id];
        }
        return next;
      });
      // mantém a conversa aberta marcada como lida (chegou mensagem enquanto lia).
      const aid = ativaIdRef.current;
      if (aid) {
        const conv = data.find((c) => c.id === aid);
        if (conv && conv.naoLidas > 0) {
          setNaoLidasLocal((n) => ({ ...n, [aid]: 0 }));
          fetch("/api/conversas/ler", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clienteId: aid }) }).catch(() => {});
        }
      }
    } catch {
      /* rede: tenta no próximo ciclo */
    }
  }, []);

  useEffect(() => {
    const id = setInterval(atualizar, 6000);
    const jan = setInterval(() => setTick((t) => t + 1), 30000);
    return () => { clearInterval(id); clearInterval(jan); };
  }, [atualizar]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const base = q
      ? conversas.filter(
          (c) =>
            c.clienteNome.toLowerCase().includes(q) ||
            c.clienteTelefone.replace(/\D/g, "").includes(q.replace(/\D/g, "")) ||
            c.previa.toLowerCase().includes(q) ||
            c.mensagens.some((m) => m.texto.toLowerCase().includes(q)),
        )
      : conversas;
    // handoff ("precisa de você") primeiro; resto pela mais recente (já vem ordenado).
    return [...base].sort((a, b) => {
      const ha = a.estado === "precisa_humano" ? 1 : 0;
      const hb = b.estado === "precisa_humano" ? 1 : 0;
      return hb - ha;
    });
  }, [busca, conversas]);

  const ativa = conversas.find((c) => c.id === ativaId);
  const mensagens: Pend[] = useMemo(
    () => (ativa ? [...ativa.mensagens, ...(pendentes[ativa.id] ?? [])] : []),
    [ativa, pendentes],
  );

  useEffect(() => {
    fim.current?.scrollIntoView({ block: "end" });
  }, [ativa?.id, mensagens.length]);

  // janela de 24h: undefined = mock/demo (deixa aberto); null = cliente nunca
  // escreveu (fechada, só template); número = compara com agora.
  const janelaAberta = ativa
    ? ativa.janelaExpiraMs === undefined
      ? true
      : ativa.janelaExpiraMs != null && Date.now() < ativa.janelaExpiraMs
    : false;

  function abrir(id: string) {
    setAtivaId(id);
    setVista("chat");
    setDrawer(false);
    setNaoLidasLocal((n) => ({ ...n, [id]: 0 }));
    fetch("/api/conversas/ler", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clienteId: id }) }).catch(() => {});
  }

  function marcarPend(convId: string, tmpId: string, patch: Partial<Pend>) {
    setPendentes((p) => ({ ...p, [convId]: (p[convId] ?? []).map((m) => (m.id === tmpId ? { ...m, ...patch } : m)) }));
  }

  async function enviarTexto() {
    const t = texto.trim();
    if (!t || !ativa || enviando) return;
    if (!janelaAberta) { setTplAberto(true); return; }
    const tmpId = `tmp-${Date.now()}`;
    const convId = ativa.id;
    setPendentes((p) => ({ ...p, [convId]: [...(p[convId] ?? []), { de: "equipe", texto: t, hora: agora(), status: "enviando", id: tmpId, data: hojeISO() }] }));
    setTexto("");
    setEnviando(true);
    try {
      const r = await fetch("/api/conversas/enviar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clienteId: convId, texto: t }) });
      if (r.status === 409) { marcarPend(convId, tmpId, { status: "erro" }); mostrarToast("A janela de 24h fechou. Use um modelo aprovado."); setTplAberto(true); }
      else if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        marcarPend(convId, tmpId, { status: "erro" });
        mostrarToast(j.erro === "sem_conexao" ? "Conecte o WhatsApp em Conectar WhatsApp." : "Não consegui enviar. Tente de novo.");
      } else {
        const j = await r.json();
        marcarPend(convId, tmpId, { status: "enviado", serverId: j.id });
        atualizar();
      }
    } catch {
      marcarPend(convId, tmpId, { status: "erro" });
      mostrarToast("Sem conexão. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  async function anexar(file: File) {
    if (!ativa) return;
    if (!janelaAberta) { mostrarToast("Fora da janela de 24h só dá pra mandar modelo aprovado."); return; }
    const ehImg = file.type.startsWith("image/");
    const convId = ativa.id;
    const tmpId = `tmp-${Date.now()}`;
    const blobUrl = ehImg ? URL.createObjectURL(file) : undefined;
    setPendentes((p) => ({
      ...p,
      [convId]: [...(p[convId] ?? []), { de: "equipe", texto: ehImg ? "Foto" : file.name, hora: agora(), status: "enviando", id: tmpId, data: hojeISO(), tipo: (ehImg ? "imagem" : "documento") as TipoMidia, midiaMime: file.type, midiaNome: file.name, blobUrl }],
    }));
    const fd = new FormData();
    fd.append("clienteId", convId);
    fd.append("file", file);
    try {
      const r = await fetch("/api/conversas/anexo", { method: "POST", body: fd });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        marcarPend(convId, tmpId, { status: "erro" });
        mostrarToast(j.erro === "janela_fechada" ? "A janela de 24h fechou." : j.erro === "sem_conexao" ? "Conecte o WhatsApp em Conectar WhatsApp." : j.erro === "arquivo_grande" ? "Arquivo grande demais (máx 16MB)." : "Não consegui enviar o anexo.");
      } else {
        const j = await r.json();
        marcarPend(convId, tmpId, { status: "enviado", serverId: j.id });
        atualizar();
      }
    } catch {
      marcarPend(convId, tmpId, { status: "erro" });
      mostrarToast("Sem conexão. Tente de novo.");
    }
  }

  // Envio de template (fora da janela, na conversa aberta OU nova conversa).
  async function enviarTemplate(payload: { clienteId?: string; telefone?: string; nome: string; idioma: string; parametros: string[]; preview: string }): Promise<boolean> {
    try {
      const r = await fetch("/api/conversas/template", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        mostrarToast(j.erro === "sem_conexao" ? "Conecte o WhatsApp em Conectar WhatsApp." : j.erro === "telefone_invalido" ? "Número inválido." : "Não consegui enviar o modelo.");
        return false;
      }
      await atualizar();
      if (j.clienteId) { setAtivaId(j.clienteId); setVista("chat"); }
      mostrarToast("Modelo enviado.");
      return true;
    } catch {
      mostrarToast("Sem conexão. Tente de novo.");
      return false;
    }
  }

  return (
    <div className="h-[100dvh] flex flex-col px-3 md:px-6 py-3 md:py-6">
      <div className="hidden md:block text-[11px] uppercase tracking-[0.2em] text-dourado font-semibold mb-3 shrink-0">Atendimentos</div>

      <div className="flex-1 min-h-0">
        <div className="h-full md:grid md:grid-cols-[minmax(300px,360px)_1fr] md:gap-4">
          {/* ===================== LISTA ===================== */}
          <div className={"glass rounded-[20px] flex-col min-h-0 overflow-hidden h-full " + (vista === "chat" ? "hidden md:flex" : "flex")}>
            <div className="p-3 flex items-center gap-2">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-cream/45" />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Pesquisar nome, número ou mensagem"
                  className="w-full bg-white/10 rounded-[10px] pl-9 pr-3 py-2 text-[13px] text-cream placeholder:text-cream/45 focus:outline-none focus:ring-2 focus:ring-cobre/25"
                />
              </div>
              <button onClick={() => setNovaAberto(true)} className="btn-cobre press w-9 h-9 grid place-items-center shrink-0" aria-label="Nova conversa" title="Nova conversa">
                <Plus size={18} />
              </button>
            </div>

            <ScrollArea className="flex-1 min-h-0">
              <div className="px-2 pb-2">
                {filtradas.length === 0 && (
                  <div className="px-3 py-10 text-[13px] text-cream/55 text-center">{busca ? "Nada encontrado." : "Nenhuma conversa ainda."}</div>
                )}
                {filtradas.map((c) => {
                  const on = c.id === ativa?.id;
                  const naoLidas = naoLidasLocal[c.id] ?? c.naoLidas;
                  const handoff = c.estado === "precisa_humano";
                  return (
                    <button
                      key={c.id}
                      onClick={() => abrir(c.id)}
                      className={"w-full text-left px-2.5 py-2.5 rounded-[12px] flex gap-2.5 transition-colors mb-0.5 relative " + (on ? "grad-cobre" : "hover:bg-white/10")}
                      style={handoff && !on ? { boxShadow: "inset 3px 0 0 #e7cf94" } : undefined}
                    >
                      <Avatar nome={c.clienteNome} tam={44} raio={12} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className={"font-semibold text-[13.5px] truncate " + (on ? "text-white" : "text-cream")}>{c.clienteNome}</span>
                          <span className={"text-[10px] shrink-0 " + (on ? "text-white/70" : "text-cream/50")}>{c.ultimaHora}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-0.5">
                          <span className={"text-[12px] truncate " + (on ? "text-white/85" : "text-cream/70")}>{c.previa}</span>
                          {naoLidas > 0 && (
                            <span className="shrink-0 min-w-[18px] h-[18px] px-1 grid place-items-center rounded-full text-[10px] font-bold" style={{ background: on ? "#fff" : "#25d366", color: on ? "#96741a" : "#06331a" }}>{naoLidas}</span>
                          )}
                        </div>
                        {handoff && (
                          <div className="flex items-center gap-1.5 mt-1">
                            <ShieldAlert size={12} style={{ color: on ? "#fff" : "#e7cf94" }} />
                            <span className="text-[10px] font-medium" style={{ color: on ? "#fff" : "#e7cf94" }}>Precisa de você</span>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* ===================== CHAT ===================== */}
          <div className={"glass rounded-[20px] flex-col min-h-0 overflow-hidden h-full " + (vista === "lista" ? "hidden md:flex" : "flex")}>
            {!ativa ? (
              <div className="flex-1 grid place-items-center px-6 text-center">
                <div>
                  <div className="mx-auto w-14 h-14 rounded-2xl grid place-items-center text-dourado mb-3" style={{ background: "rgba(212,175,55,0.12)" }}>
                    <MessageSquare size={26} />
                  </div>
                  <div className="tracking-tight-apple text-xl font-bold text-cream">Selecione uma conversa</div>
                  <p className="text-sm text-cream/60 mt-1 max-w-xs mx-auto">Escolha um cliente à esquerda pra ver e responder as mensagens do WhatsApp.</p>
                </div>
              </div>
            ) : (
              <>
                {/* cabeçalho */}
                <div className="px-3 md:px-4 h-[58px] border-b border-white/10 flex items-center justify-between gap-2 shrink-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <button onClick={() => setVista("lista")} className="md:hidden w-11 h-11 grid place-items-center rounded-full text-cream/80 hover:bg-white/10 active:bg-white/15 -ml-1.5 shrink-0" aria-label="Voltar">
                      <ArrowLeft size={20} />
                    </button>
                    <Avatar nome={ativa.clienteNome} tam={38} raio={11} />
                    <div className="min-w-0">
                      <div className="font-semibold text-cream text-[14.5px] truncate">{ativa.clienteNome}</div>
                      <div className="text-[11px] text-cream/55 truncate flex items-center gap-1.5">
                        <span className="truncate">{formatarTelefoneBR(ativa.clienteTelefone)}</span>
                        {ativa.custoCentavos != null && ativa.custoCentavos > 0 && (
                          <span className="text-cream/35 shrink-0" title="Custo estimado de IA nesta conversa">
                            · {brl(ativa.custoCentavos)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {ativa.estado === "precisa_humano" && (
                      <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 h-7 rounded-full" style={{ background: "rgba(231,207,148,0.14)", color: "#e7cf94" }}>
                        <ShieldAlert size={13} /> Precisa de você
                      </span>
                    )}
                    <button onClick={() => setDrawer(true)} className="w-9 h-9 grid place-items-center rounded-full text-cream/55 hover:text-cream hover:bg-white/10 transition-colors" aria-label="Informações do contato">
                      <Info size={18} />
                    </button>
                  </div>
                </div>

                {/* mensagens */}
                <ScrollArea className="flex-1 min-h-0">
                  <div className="px-3 md:px-6 py-4 flex flex-col">
                    {mensagens.map((m, i) => {
                      const ant = mensagens[i - 1];
                      const mostrarDia = !ant || ant.data !== m.data;
                      const primeiro = !ant || ant.de !== m.de || mostrarDia;
                      return (
                        <div key={m.id ?? i}>
                          {mostrarDia && m.data && (
                            <div className="flex justify-center my-3">
                              <span className="text-[11px] text-cream/70 px-3 py-1 rounded-full" style={{ background: "rgba(0,0,0,0.22)" }}>{rotuloDia(m.data)}</span>
                            </div>
                          )}
                          <Balao m={m} primeiro={primeiro} onImagem={setLightbox} />
                        </div>
                      );
                    })}
                    <div ref={fim} />
                  </div>
                </ScrollArea>

                {/* composer / aviso de janela */}
                <div className="px-3 pt-2.5 pb-3 border-t border-white/10 shrink-0" style={{ background: "rgba(255,255,255,0.04)" }}>
                  {janelaAberta ? (
                    <div className="flex items-end gap-1.5">
                      <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) anexar(f); e.target.value = ""; }} />
                      <button onClick={() => fileRef.current?.click()} className="w-10 h-10 grid place-items-center rounded-full text-cream/55 hover:text-cream hover:bg-white/10 transition-colors shrink-0" aria-label="Anexar arquivo">
                        <Paperclip size={18} />
                      </button>
                      <textarea
                        value={texto}
                        onChange={(e) => setTexto(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviarTexto(); } }}
                        placeholder="Escreva uma mensagem"
                        rows={1}
                        className="flex-1 resize-none bg-white/10 rounded-[20px] px-4 py-2.5 text-[15px] md:text-[14px] text-cream placeholder:text-cream/40 focus:outline-none focus:ring-2 focus:ring-cobre/25 max-h-32"
                      />
                      <button onClick={enviarTexto} disabled={!texto.trim() || enviando} className="grad-cobre press w-10 h-10 rounded-full grid place-items-center text-white shrink-0 shadow-[0_6px_16px_rgba(187,146,31,0.3)] disabled:opacity-45 disabled:cursor-default" aria-label="Enviar">
                        <SendHorizontal size={18} />
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-[14px] p-3" style={{ background: "rgba(231,207,148,0.10)", border: "1px solid rgba(231,207,148,0.22)" }}>
                      <div className="flex items-start gap-2.5">
                        <Clock size={16} className="text-dourado-l shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] text-cream font-medium">Passou de 24h da última mensagem do cliente</div>
                          <p className="text-[12px] text-cream/65 mt-0.5">Pela regra da Meta, agora só um modelo aprovado reabre a conversa. Escolha um pra continuar.</p>
                        </div>
                      </div>
                      <button onClick={() => setTplAberto(true)} className="btn-cobre press w-full mt-2.5 py-2.5 text-[13px] font-semibold flex items-center justify-center gap-2">
                        <FileText size={16} /> Escolher modelo aprovado
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ===================== DRAWER: info do contato ===================== */}
      {ativa && drawer && (
        <ContatoDrawer conversa={ativa} qtdMensagens={mensagens.length} onFechar={() => setDrawer(false)} onToast={mostrarToast} />
      )}

      {/* ===================== LIGHTBOX ===================== */}
      {lightbox && (
        <div className="fixed inset-0 z-[60] grid place-items-center p-4" style={{ background: "rgba(0,0,0,0.82)" }} onClick={() => setLightbox(null)}>
          <button className="absolute top-4 right-4 w-10 h-10 grid place-items-center rounded-full text-white/80 hover:bg-white/10" aria-label="Fechar"><X size={22} /></button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="Imagem" className="max-w-full max-h-full rounded-lg" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      {/* ===================== MODAL: template (fora da janela) ===================== */}
      {tplAberto && ativa && (
        <ModalTemplate
          titulo="Escolher modelo aprovado"
          comTelefone={false}
          onFechar={() => setTplAberto(false)}
          onEnviar={async (nome, idioma, parametros, preview) => {
            const ok = await enviarTemplate({ clienteId: ativa.id, nome, idioma, parametros, preview });
            if (ok) setTplAberto(false);
          }}
        />
      )}

      {/* ===================== MODAL: nova conversa ===================== */}
      {novaAberto && (
        <ModalTemplate
          titulo="Nova conversa"
          comTelefone
          onFechar={() => setNovaAberto(false)}
          onEnviar={async (nome, idioma, parametros, preview, telefone) => {
            const ok = await enviarTemplate({ telefone, nome, idioma, parametros, preview });
            if (ok) setNovaAberto(false);
          }}
        />
      )}

      {/* ===================== TOAST ===================== */}
      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[70] px-4 py-2.5 rounded-full text-[13px] text-white font-medium" style={{ background: "rgba(58,16,28,0.98)", border: "1px solid rgba(255,255,255,0.14)", boxShadow: "0 10px 30px rgba(0,0,0,0.4)" }}>
          {toast}
        </div>
      )}
    </div>
  );
}

// ---------- Drawer de informações do contato ----------
function ContatoDrawer({ conversa, qtdMensagens, onFechar, onToast }: { conversa: Conversa; qtdMensagens: number; onFechar: () => void; onToast: (t: string) => void }) {
  const [nota, setNota] = useState("");
  const [salvando, setSalvando] = useState(false);
  async function salvarNota() {
    setSalvando(true);
    try {
      await fetch("/api/cliente/nota", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ telefone: conversa.clienteTelefone, nota }) });
      onToast("Nota salva.");
    } catch {
      onToast("Não consegui salvar a nota.");
    } finally {
      setSalvando(false);
    }
  }
  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: "rgba(0,0,0,0.5)" }} onClick={onFechar}>
      <div className="w-full max-w-sm h-full overflow-auto" style={{ background: "rgba(73,16,32,0.96)", backdropFilter: "blur(24px)", borderLeft: "1px solid rgba(255,255,255,0.14)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 h-[58px] border-b border-white/10">
          <span className="text-[11px] uppercase tracking-[0.18em] text-dourado font-semibold">Contato</span>
          <button onClick={onFechar} className="w-9 h-9 grid place-items-center rounded-full text-cream/60 hover:text-cream hover:bg-white/10" aria-label="Fechar"><X size={18} /></button>
        </div>
        <div className="p-5">
          <div className="flex flex-col items-center text-center pb-4">
            <Avatar nome={conversa.clienteNome} tam={64} raio={18} />
            <div className="font-semibold text-cream text-[16px] mt-3">{conversa.clienteNome}</div>
            <a href={linkWhatsapp(conversa.clienteTelefone)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-cream/60 mt-1 hover:text-cream transition-colors">
              <span className="text-[#25d366]"><WhatsAppIcon size={12} /></span> {formatarTelefoneBR(conversa.clienteTelefone)}
            </a>
          </div>
          {conversa.estado === "precisa_humano" && (
            <div className="flex items-center gap-2 text-[12px] rounded-[10px] px-3 py-2 mb-4" style={{ background: "rgba(231,207,148,0.12)", color: "#e7cf94" }}>
              <ShieldAlert size={14} /> A IA pediu a equipe nesta conversa.
            </div>
          )}
          <div className="border-t border-white/10 pt-4">
            <span className="t-label text-cream/45">Nota interna</span>
            <textarea
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              onBlur={salvarNota}
              placeholder="Preferências, endereço, observações..."
              rows={3}
              className="w-full mt-2 bg-white/[0.06] rounded-[10px] px-3 py-2 text-[12.5px] text-cream placeholder:text-cream/40 focus:outline-none focus:ring-2 focus:ring-cobre/25 resize-none leading-relaxed"
            />
            <div className="text-[11px] text-cream/40 mt-1 h-4">{salvando ? "Salvando..." : ""}</div>
          </div>
          <div className="border-t border-white/10 pt-4 mt-4 space-y-3">
            {[["Canal", "WhatsApp"], ["Mensagens", String(qtdMensagens)]].map(([l, v]) => (
              <div key={l} className="flex items-center justify-between gap-3">
                <span className="text-[11px] text-cream/45">{l}</span>
                <span className="text-[13px] text-cream font-medium">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Modal de template (reabrir fora da janela / nova conversa) ----------
function ModalTemplate({ titulo, comTelefone, onFechar, onEnviar }: {
  titulo: string;
  comTelefone: boolean;
  onFechar: () => void;
  onEnviar: (nome: string, idioma: string, parametros: string[], preview: string, telefone?: string) => void | Promise<void>;
}) {
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [motivo, setMotivo] = useState<string | undefined>();
  const [sel, setSel] = useState<Template | null>(null);
  const [params, setParams] = useState<string[]>([]);
  const [telefone, setTelefone] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/conversas/templates", { cache: "no-store" });
        const j = await r.json();
        setTemplates(j.templates ?? []);
        setMotivo(j.motivo);
      } catch {
        setTemplates([]);
      }
    })();
  }, []);

  function escolher(t: Template) {
    setSel(t);
    setParams(Array.from({ length: t.variaveis }, () => ""));
  }

  const preview = sel ? renderPreview(sel.corpo, params) : "";
  const podeEnviar = Boolean(sel) && (!comTelefone || telefoneCompleto(telefone)) && params.every((p) => p.trim());

  async function confirmar() {
    if (!sel || !podeEnviar || enviando) return;
    setEnviando(true);
    await onEnviar(sel.nome, sel.idioma, params, preview, comTelefone ? telefone : undefined);
    setEnviando(false);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.55)" }} onClick={onFechar}>
      <div className="rounded-[20px] w-full max-w-md max-h-[85vh] overflow-hidden flex flex-col" style={{ background: "rgba(73,16,32,0.96)", backdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.14)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/10">
          <h3 className="t-h2 text-cream">{titulo}</h3>
          <button onClick={onFechar} className="w-9 h-9 grid place-items-center rounded-full text-cream/60 hover:text-cream hover:bg-white/10" aria-label="Fechar"><X size={18} /></button>
        </div>

        <div className="p-5 overflow-auto">
          {comTelefone && (
            <div className="mb-4">
              <span className="t-label text-cream/45">Número do cliente</span>
              <CampoTelefone value={telefone} onChange={setTelefone} className="mt-2" />
            </div>
          )}

          <span className="t-label text-cream/45">Modelo aprovado</span>
          {templates === null ? (
            <div className="text-[13px] text-cream/55 py-6 text-center">Carregando modelos...</div>
          ) : templates.length === 0 ? (
            <div className="text-[13px] text-cream/65 py-6 text-center leading-relaxed">
              {motivo === "sem_conexao"
                ? "Conecte o WhatsApp em Conectar WhatsApp pra usar modelos aprovados."
                : "Nenhum modelo aprovado ainda. Crie e aprove um modelo no Gerenciador da Meta."}
            </div>
          ) : (
            <div className="mt-2 space-y-1.5">
              {templates.map((t) => (
                <button
                  key={t.nome + t.idioma}
                  onClick={() => escolher(t)}
                  className={"w-full text-left px-3 py-2.5 rounded-[12px] transition-colors " + (sel?.nome === t.nome && sel?.idioma === t.idioma ? "grad-cobre text-vinho-d" : "bg-white/[0.06] hover:bg-white/12 text-cream")}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-semibold truncate">{t.nome}</span>
                    <span className="text-[10px] uppercase tracking-wide opacity-70">{t.idioma}</span>
                  </div>
                  <p className="text-[12px] opacity-80 mt-0.5 line-clamp-2">{t.corpo}</p>
                </button>
              ))}
            </div>
          )}

          {sel && sel.variaveis > 0 && (
            <div className="mt-4 space-y-2">
              <span className="t-label text-cream/45">Preencher variáveis</span>
              {params.map((p, i) => (
                <input
                  key={i}
                  value={p}
                  onChange={(e) => setParams((arr) => arr.map((x, j) => (j === i ? e.target.value : x)))}
                  placeholder={`Variável {{${i + 1}}}`}
                  className="w-full bg-white/10 rounded-[10px] px-3 py-2 text-[13px] text-cream placeholder:text-cream/40 focus:outline-none focus:ring-2 focus:ring-cobre/25"
                />
              ))}
            </div>
          )}

          {sel && (
            <div className="mt-4">
              <span className="t-label text-cream/45">Prévia</span>
              <div className="mt-2 rounded-[12px] px-3.5 py-2.5 text-[13px] text-white whitespace-pre-line" style={{ background: "linear-gradient(135deg,#96741a,#e7cf94)" }}>{preview}</div>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-white/10">
          <button onClick={confirmar} disabled={!podeEnviar || enviando} className="btn-cobre press w-full py-2.5 text-[13.5px] font-semibold flex items-center justify-center gap-2 disabled:opacity-45 disabled:cursor-default">
            {enviando ? "Enviando..." : (<><SendHorizontal size={16} /> Enviar {comTelefone ? "e abrir conversa" : "modelo"}</>)}
          </button>
        </div>
      </div>
    </div>
  );
}
