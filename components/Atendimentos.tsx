"use client";

// ============================================================================
//  ATENDIMENTOS: o WhatsApp Web da Doce Pão.
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
import PedidoMontado from "./PedidoMontado";
import type { Conversa, Mensagem, TipoMidia } from "@/lib/tipos";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatarTelefoneBR, linkWhatsapp, brl } from "@/lib/tipos";
import CampoTelefone, { telefoneCompleto } from "@/components/CampoTelefone";
import AudioBolha from "@/components/AudioBolha";
import { Check,
  Search, Plus, Paperclip, SendHorizontal, ArrowLeft, Bot, X,
  MessageSquare, Info, FileText, Download, CheckCheck, AlertCircle,
  Clock, ShieldAlert, Hand, ShoppingBag,
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
// A dona digita "renata" no celular e o cliente esta gravado como "Renatá":
// sem tirar acento e caixa a busca nao acha ninguem e ela acha que a conversa
// sumiu da lista.
function semAcento(t: string) {
  return String(t ?? "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// QUEM ESTA ATENDENDO, ESCRITO NUM LUGAR SO.
// Na conversa do Paulo (55 11 96000-9999) o selo "Precisa de você" estava aceso
// e a API devolvia estado "precisa_humano", mas o cabecalho, o bloco Atendimento
// e o rodape diziam "IA atendendo" e "A IA está respondendo". Os tres so
// perguntavam se o estado era "humano", entao handoff caia no galho da IA. E
// mentira: quando a IA pede a equipe ela PARA de responder aquele cliente. Quem
// lia aquilo achava que a conversa seguia sozinha e deixava o Paulo esperando.
type QuemAtende = {
  cor: string;
  cabecalho: string;
  painel: string;
  rodape: string;
  icone: "voce" | "ia" | "espera";
};
function quemAtende(estado: Conversa["estado"]): QuemAtende {
  if (estado === "humano") {
    return { cor: "#e7cf94", cabecalho: "Você atendendo", painel: "Você está atendendo", rodape: "Você está atendendo", icone: "voce" };
  }
  if (estado === "precisa_humano") {
    return {
      cor: "#e7cf94",
      cabecalho: "Esperando você",
      painel: "IA parada, esperando a equipe",
      rodape: "A IA parou e está esperando você",
      icone: "espera",
    };
  }
  return { cor: "#7fd1a4", cabecalho: "IA atendendo", painel: "IA atendendo", rodape: "A IA está respondendo", icone: "ia" };
}

// NEGRITO DO WHATSAPP, RENDERIZADO DE VERDADE.
// A mensagem de confirmacao sai daqui com *asterisco*: no celular do cliente
// isso vira negrito, e no painel aparecia cru ("*Pedido recebido*", "*Nome:*",
// "*Total: R$ 225,00*"), sujando o balao inteiro. Aqui o trecho entre asteriscos
// vira <strong> e o resto do texto continua igual.
// Sai SEMPRE em pedacos de texto, nunca HTML: o que o cliente escrever no
// WhatsApp e conteudo, e o React escapa cada pedaco; nada que ele mande vira
// marcacao da pagina.
// O par tem que abrir e fechar sem espaco colado no asterisco (regra do proprio
// WhatsApp), senao "1 kg * 3" viraria negrito no meio da conta do pedido.
const NEGRITO_WPP = /\*([^\s*][^*\n]*[^\s*]|[^\s*])\*/g;
function comNegrito(texto: string): React.ReactNode {
  const t = texto ?? "";
  if (!t.includes("*")) return t;
  const partes: React.ReactNode[] = [];
  let fim = 0;
  for (const m of t.matchAll(NEGRITO_WPP)) {
    const i = m.index ?? 0;
    if (i > fim) partes.push(t.slice(fim, i));
    partes.push(<strong key={i} className="font-semibold">{m[1]}</strong>);
    fim = i + m[0].length;
  }
  if (fim < t.length) partes.push(t.slice(fim));
  return partes;
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
  // midiaUrl = peça já publicada (cardápio); midiaId = arquivo que o
  // cliente mandou e está no banco em base64.
  const src = m.blobUrl || m.midiaUrl || (m.midiaId ? `/api/midia/${m.midiaId}` : null);
  // Balão claro pra quem recebe e degradê dourado pra quem envia. Era o desenho
  // original do painel. Tentei trocar isso pela paleta chapada do WhatsApp e
  // ficou pior: o degradê é o que dá o acabamento da marca, e achatar cor é
  // erro que já tinha sido apontado antes.
  const bolhaBase =
    "rounded-[14px] text-[15px] md:text-[14px] leading-[1.45] whitespace-pre-line " +
    (isCliente ? "text-[#4a1020] rounded-bl-[4px]" : "text-[#3d1219] rounded-br-[4px]");
  const bolhaStyle: React.CSSProperties = isCliente
    ? { background: "rgba(255,255,255,0.95)", boxShadow: "0 3px 12px rgba(0,0,0,0.16)" }
    : { background: "linear-gradient(135deg,#96741a,#e7cf94)", boxShadow: "0 4px 14px rgba(187,146,31,0.28)" };

  // legenda que acompanha a mídia: tira as notas internas ("[o cliente enviou
  // ...]") e os rótulos automáticos (Foto/Áudio/nome do arquivo), pra não repetir.
  const isMidia = m.tipo === "imagem" || m.tipo === "audio" || m.tipo === "documento" || m.tipo === "video";
  let legenda = (m.texto || "").replace(/\[o cliente enviou[^\]]*\]/gi, "").replace(/\[midia\]/gi, "").trim();
  const rotulosAuto = [m.midiaNome ?? "", "foto", "áudio", "audio"].map((s) => s.toLowerCase());
  if (isMidia && legenda && rotulosAuto.includes(legenda.toLowerCase())) legenda = "";

  const HoraSelo = () => (
    <span className={"text-[10px] inline-flex items-center gap-1 align-bottom " + (isCliente ? "text-black/35" : "text-black/45")}>
      {m.hora}
      {!isCliente && m.de === "equipe" && m.status === "enviando" && <Clock size={11} />}
      {!isCliente && m.de === "equipe" && m.status === "enviado" && <CheckCheck size={12} />}
      {!isCliente && m.de === "equipe" && m.status === "erro" && <AlertCircle size={12} className="text-red-900" />}
      {/* O que o WhatsApp respondeu depois do envio. Falha e o unico caso que
          pede acao: a mensagem nao chegou no cliente. */}
      {!isCliente && m.falhaEnvio && (
        <span className="inline-flex items-center gap-1 text-red-900" title={m.falhaEnvio}>
          <AlertCircle size={12} /> não chegou
        </span>
      )}
      {!isCliente && !m.falhaEnvio && m.lidaWpp && <CheckCheck size={12} className="text-sky-800" />}
      {!isCliente && !m.falhaEnvio && !m.lidaWpp && m.entregue && <CheckCheck size={12} />}
      {!isCliente && !m.falhaEnvio && !m.lidaWpp && !m.entregue && m.de === "ia" && <Check size={12} />}
    </span>
  );

  return (
    <div className={"flex " + (primeiro ? "mt-3" : "mt-1") + (isCliente ? " justify-start" : " justify-end")}>
      <div className="max-w-[78%] md:max-w-[64%]">
        {!isCliente && m.de === "equipe" && primeiro && <div className="text-[10px] text-cream/45 mb-0.5 text-right pr-1">Você</div>}
        {!isCliente && m.de === "ia" && primeiro && <div className="text-[10px] text-cream/45 mb-0.5 text-right pr-1 flex items-center justify-end gap-1"><Bot size={11} /> Atendente</div>}
        <div>
        <div className={bolhaBase} style={{ ...bolhaStyle, padding: m.tipo === "imagem" && src ? 4 : undefined }}>
          {/* IMAGEM */}
          {m.tipo === "imagem" && src && (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt="Imagem enviada"
                onClick={() => onImagem(src)}
                className="rounded-[11px] max-h-64 w-auto object-cover cursor-zoom-in block"
              />
              {/* A hora fica SOBRE a foto, com um véu escuro pra ler em imagem
                  clara. Antes era uma linha embaixo puxada pra cima, que comia
                  o rodapé da imagem. */}
              {!legenda && (
                <span
                  className="absolute bottom-1.5 right-1.5 text-[10px] text-white/90 px-1.5 py-0.5 rounded-full inline-flex items-center gap-1"
                  style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)" }}
                >
                  {m.hora}
                  {!isCliente && m.de === "equipe" && m.status === "enviando" && <Clock size={10} />}
                  {!isCliente && m.de === "equipe" && m.status === "enviado" && <CheckCheck size={11} />}
                  {!isCliente && m.de === "equipe" && m.status === "erro" && <AlertCircle size={11} />}
                </span>
              )}
            </div>
          )}
          {/* VÍDEO */}
          {m.tipo === "video" && src && (
            <video src={src} controls preload="metadata" className="rounded-[11px] max-h-64 w-auto block" />
          )}
          {/* ÁUDIO */}
          {m.tipo === "audio" && src && (
            <div className="px-2.5 py-1.5">
              <AudioBolha src={src} />
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
                <span className={"text-[11px] " + (isCliente ? "text-black/45" : "text-black/55")}>Abrir arquivo</span>
              </span>
              <Download size={15} className={isCliente ? "text-black/40 shrink-0" : "text-white/70 shrink-0"} />
            </a>
          )}
          {/* TEXTO puro */}
          {!isMidia && (
            <div className="px-3.5 py-2">
              {comNegrito(m.texto)}
              <span className="ml-2">
                <HoraSelo />
              </span>
            </div>
          )}
          {/* LEGENDA da mídia (quando há uma real) */}
          {isMidia && legenda && (
            <div className="px-3.5 pb-2 pt-1">
              {comNegrito(legenda)}
              <span className="ml-2">
                <HoraSelo />
              </span>
            </div>
          )}
          {/* rodapé de hora quando a mídia não tem legenda */}
          {isMidia && !legenda && m.tipo !== "imagem" && (
            <div className="flex items-center justify-end pr-2 pb-1">
              <HoraSelo />
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}

export default function Atendimentos({
  conversas: conversasIniciais,
  telefoneInicial,
}: {
  conversas: Conversa[];
  telefoneInicial?: string;
}) {
  // Quem chegou por 'Abrir conversa' quer ESTA conversa, nao a lista. So os
  // digitos importam: a fila manda o telefone cru e a lista guarda com mascara.
  const soDigitos = (t?: string) => String(t ?? "").replace(/\D/g, "");
  const daUrl = telefoneInicial
    ? conversasIniciais.find((c) => soDigitos(c.clienteTelefone) === soDigitos(telefoneInicial))
    : undefined;
  const [conversas, setConversas] = useState<Conversa[]>(conversasIniciais);
  const [busca, setBusca] = useState("");
  const [ativaId, setAtivaId] = useState<string | undefined>(daUrl?.id);
  const [vista, setVista] = useState<"lista" | "chat">(daUrl ? "chat" : "lista");
  const [texto, setTexto] = useState("");
  const [pendentes, setPendentes] = useState<Record<string, Pend[]>>({});
  const [naoLidasLocal, setNaoLidasLocal] = useState<Record<string, number>>({});
  const [enviando, setEnviando] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [tplAberto, setTplAberto] = useState(false);
  const [assumindo, setAssumindo] = useState<string | null>(null);
  const [zoom, setZoom] = useState(false);
  const [aba, setAba] = useState<"todas" | "ia" | "humano" | "atencao">("todas");
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

  // Assumir a conversa (a IA para de responder este cliente) ou devolver.
  // O estado muda na hora na tela: quem clica precisa ver que pegou, sem
  // esperar o próximo polling pra ter certeza de que a IA calou.
  const alternarAssumir = useCallback(async (clienteId: string, assumir: boolean) => {
    setAssumindo(clienteId);
    setConversas((prev) => prev.map((c) => (c.id === clienteId ? { ...c, estado: assumir ? "humano" : "ia" } : c)));
    try {
      const r = await fetch("/api/conversas/assumir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clienteId, assumir }),
      });
      if (!r.ok) throw new Error("falha");
      mostrarToast(assumir ? "Você assumiu. A IA não responde mais este cliente." : "Devolvido: a IA volta a atender.");
    } catch {
      setConversas((prev) => prev.map((c) => (c.id === clienteId ? { ...c, estado: assumir ? "ia" : "humano" } : c)));
      mostrarToast("Não consegui mudar quem atende. Tente de novo.");
    } finally {
      setAssumindo(null);
    }
  }, [mostrarToast]);

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

  // A BUSCA VEM ANTES DA ABA, E OS CHIPS CONTAM O QUE SOBROU DELA.
  // Com "cristina" digitado a lista mostrava uma conversa e os chips seguiam
  // dizendo "Todas 8" e "IA 7", porque o numero era contado sobre a lista
  // inteira. A equipe lia aquilo como conversa escondida por filtro e ficava
  // clicando nas abas atras de gente que a busca ja tinha tirado.
  const buscadas = useMemo(() => {
    const q = semAcento(busca);
    if (!q) return conversas;
    // Só compara telefone quando o que foi digitado TEM número. Digitando
    // "Renata" os dígitos da busca davam string vazia, e telefone.includes("")
    // é sempre verdadeiro: a lista continuava com as cinco conversas e parecia
    // que a busca estava morta.
    const qDigitos = busca.replace(/\D/g, "");
    return conversas.filter(
      (c) =>
        semAcento(c.clienteNome).includes(q) ||
        (qDigitos !== "" && c.clienteTelefone.replace(/\D/g, "").includes(qDigitos)) ||
        semAcento(c.previa).includes(q) ||
        c.mensagens.some((m) => semAcento(m.texto).includes(q)),
    );
  }, [busca, conversas]);

  const filtradas = useMemo(() => {
    // A aba filtra por QUEM está respondendo: é a pergunta que a equipe faz ao
    // abrir a tela ("o que precisa de mim?"), não "quem mandou mensagem".
    const porAba = (c: Conversa) =>
      aba === "todas" ? true
      : aba === "humano" ? c.estado === "humano"
      : aba === "atencao" ? c.estado === "precisa_humano"
      : c.estado === "ia";
    // handoff ("precisa de você") primeiro; resto pela mais recente (já vem ordenado).
    return buscadas.filter(porAba).sort((a, b) => {
      const ha = a.estado === "precisa_humano" ? 1 : 0;
      const hb = b.estado === "precisa_humano" ? 1 : 0;
      return hb - ha;
    });
  }, [buscadas, aba]);

  const ativa = conversas.find((c) => c.id === ativaId);
  const mensagens: Pend[] = useMemo(
    () => (ativa ? [...ativa.mensagens, ...(pendentes[ativa.id] ?? [])] : []),
    [ativa, pendentes],
  );

  const trocouDeConversa = useRef<string | undefined>(undefined);

  useEffect(() => {
    const alvo = fim.current;
    if (!alvo) return;
    // Trocou de conversa: desce direto, e o comeco do atendimento.
    if (trocouDeConversa.current !== ativa?.id) {
      trocouDeConversa.current = ativa?.id;
      alvo.scrollIntoView({ block: "end" });
      return;
    }
    // Mensagem nova com a dona lendo o meio da conversa: nao puxa a tela.
    const caixa = alvo.parentElement;
    if (!caixa) return;
    const naoFim = caixa.scrollHeight - caixa.scrollTop - caixa.clientHeight;
    if (naoFim < 120) alvo.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [ativa?.id, mensagens.length]);

  // janela de 24h: undefined = mock/demo (deixa aberto); null = cliente nunca
  // escreveu (fechada, só template); número = compara com agora.
  const janelaAberta = ativa
    ? ativa.janelaExpiraMs === undefined
      ? true
      : ativa.janelaExpiraMs != null && Date.now() < ativa.janelaExpiraMs
    : false;

  // Voltar pra lista limpa o endereco, senao recarregar a pagina joga a dona
  // de volta pra dentro do chat que ela acabou de fechar.
  function fecharConversa() {
    setVista("lista");
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.delete("cliente");
    window.history.replaceState(null, "", url.pathname + url.search);
  }

  function abrir(id: string) {
    setAtivaId(id);
    setVista("chat");
    // O endereco guarda quem esta aberto: enviar mensagem recarrega a tela, e
    // sem isso a dona voltava pra lista com o cliente esperando resposta.
    const c = conversas.find((x) => x.id === id);
    if (c?.clienteTelefone && typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("cliente", c.clienteTelefone);
      window.history.replaceState(null, "", url.toString());
    }
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
        mostrarToast(j.erro === "sem_conexao" ? "Conecte o WhatsApp em Conectar WhatsApp." : j.erro === "conexao_expirada" ? "A conexão do WhatsApp expirou. Reconecte em Conectar WhatsApp." : "Não consegui enviar. Tente de novo.");
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
        mostrarToast(j.erro === "janela_fechada" ? "A janela de 24h fechou." : j.erro === "sem_conexao" ? "Conecte o WhatsApp em Conectar WhatsApp." : j.erro === "conexao_expirada" ? "A conexão do WhatsApp expirou. Reconecte em Conectar WhatsApp." : j.erro === "arquivo_grande" ? "Arquivo grande demais (máx 16MB)." : "Não consegui enviar o anexo.");
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
        mostrarToast(j.erro === "sem_conexao" ? "Conecte o WhatsApp em Conectar WhatsApp." : j.erro === "conexao_expirada" ? "A conexão do WhatsApp expirou. Reconecte em Conectar WhatsApp." : j.erro === "telefone_invalido" ? "Número inválido." : "Não consegui enviar o modelo.");
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

  // A altura vem do <main>, não de 100dvh. Somando 100dvh com a barra superior
  // do celular, a página inteira passava a rolar e o cabeçalho subia junto, e a
  // rolagem tem que ficar SÓ dentro das mensagens.
  return (
    <div className="h-full min-h-0 flex flex-col px-3 md:px-6 py-3 md:py-6 overflow-hidden">
      <div className="hidden md:block text-[11px] uppercase tracking-[0.2em] text-dourado font-semibold mb-3 shrink-0">Atendimentos</div>

      <div className="flex-1 min-h-0">
        <div className="h-full md:grid md:grid-cols-[minmax(300px,360px)_1fr] xl:grid-cols-[minmax(300px,340px)_1fr_320px] md:gap-4">
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
              <button onClick={() => setNovaAberto(true)} className="btn-cobre press w-11 h-11 md:w-9 md:h-9 grid place-items-center shrink-0" aria-label="Nova conversa" title="Nova conversa">
                <Plus size={18} />
              </button>
            </div>

            {/* filtros por quem atende */}
            <div className="px-3 pb-2 flex items-center gap-1.5 flex-wrap">
              {([["todas", "Todas"], ["ia", "IA"], ["humano", "Humano"], ["atencao", "Precisa de você"]] as const).map(([id, rotulo]) => {
                const on = aba === id;
                // Conta sobre o resultado da busca, nunca sobre a lista inteira:
                // o numero do chip tem que bater com o que a tela mostra ao
                // clicar nele.
                const n = id === "todas" ? buscadas.length : buscadas.filter((c) => (id === "humano" ? c.estado === "humano" : id === "atencao" ? c.estado === "precisa_humano" : c.estado === "ia")).length;
                return (
                  <button
                    key={id}
                    onClick={() => setAba(id)}
                    className={"shrink-0 h-10 md:h-7 px-3.5 md:px-3 rounded-full text-[12px] font-medium transition-colors " + (on ? "text-vinho-d" : "text-cream/70 hover:text-cream")}
                    style={on ? { background: "linear-gradient(135deg,#96741a,#e7cf94)" } : { background: "rgba(255,255,255,0.07)" }}
                  >
                    {rotulo}{n > 0 && <span className={on ? "opacity-70" : "opacity-50"}> {n}</span>}
                  </button>
                );
              })}
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
                      className={"w-full text-left px-2.5 py-2.5 rounded-[12px] flex gap-2.5 transition-colors mb-0.5 relative " + (on ? "grad-cobre" : "hover:bg-white/10") + (handoff && !on ? " chama-equipe" : "")}
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
                <div className="chat-cabecalho px-3 md:px-4 h-[52px] md:h-[58px] border-b border-white/10 flex items-center justify-between gap-2 shrink-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <button onClick={fecharConversa} className="md:hidden w-11 h-11 grid place-items-center rounded-full text-cream/80 hover:bg-white/10 active:bg-white/15 -ml-1.5 shrink-0" aria-label="Voltar">
                      <ArrowLeft size={20} />
                    </button>
                    <Avatar nome={ativa.clienteNome} tam={38} raio={11} />
                    <div className="min-w-0">
                      <div className="font-semibold text-cream text-[14.5px] truncate">{ativa.clienteNome}</div>
                      <div className="text-[11px] truncate flex items-center gap-1.5" style={{ color: quemAtende(ativa.estado).cor }}>
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "currentColor" }} />
                        <span className="truncate">{quemAtende(ativa.estado).cabecalho}</span>
                        <span className="hidden sm:inline text-cream/45 shrink-0">·</span>
                        <span className="hidden sm:inline shrink-0 text-cream/55">{formatarTelefoneBR(ativa.clienteTelefone)}</span>
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

                    <button onClick={() => setDrawer(true)} className="xl:hidden w-11 h-11 shrink-0 grid place-items-center rounded-full text-cream/70 hover:text-cream hover:bg-white/10 active:bg-white/15 transition-colors" aria-label="Informações do contato">
                      <Info size={18} />
                    </button>
                  </div>
                </div>

                {/* mensagens */}
                <ScrollArea className="flex-1 min-h-0">
                  {/* Enquanto a equipe está com a conversa, isso precisa ficar na
                      cara: sem o aviso, ninguém lembra de devolver e o cliente
                      fica sem a IA pra sempre. */}
                  {ativa.estado === "humano" && (
                    <div className="sticky top-0 z-10 px-3 md:px-6 py-2 flex items-center justify-center gap-2 text-[12px] font-medium"
                         style={{ background: "#3a2417", color: "#e7cf94", borderBottom: "1px solid rgba(231,207,148,0.22)" }}>
                      <Hand size={13} className="shrink-0" />
                      <span>Você está atendendo. A IA não responde este cliente.</span>
                      <button onClick={() => alternarAssumir(ativa.id, false)} className="underline underline-offset-2 font-semibold shrink-0">
                        devolver
                      </button>
                    </div>
                  )}
                  <div className="px-3 md:px-6 py-4 flex flex-col min-h-full">
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

                {/* Quem está respondendo, logo acima de onde se digita. É o lugar
                    certo pra isso: a decisão de assumir acontece na hora de
                    escrever, não no topo da tela. */}
                <div className="barra-estado px-3 py-2 border-t border-white/10 shrink-0 flex items-center justify-between gap-2" style={{ background: "rgba(0,0,0,0.14)" }}>
                  <span className="estado-texto inline-flex items-center gap-2 text-[12.5px] min-w-0" style={{ color: quemAtende(ativa.estado).cor }}>
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "currentColor" }} />
                    <span className="leading-snug">{quemAtende(ativa.estado).rodape}</span>
                  </span>
                  <button
                    onClick={() => alternarAssumir(ativa.id, ativa.estado !== "humano")}
                    disabled={assumindo === ativa.id}
                    className="press toque inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-[12.5px] font-semibold shrink-0 disabled:opacity-60"
                    style={ativa.estado === "humano"
                      ? { background: "rgba(255,255,255,0.09)", color: "rgba(255,247,235,0.88)", border: "1px solid rgba(255,255,255,0.16)" }
                      : { background: "linear-gradient(135deg,#96741a,#e7cf94)", color: "#3d1219" }}
                  >
                    {ativa.estado === "humano" ? <><Bot size={14} /> Devolver pra IA</> : <><Hand size={14} /> Assumir conversa</>}
                  </button>
                </div>

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
                        placeholder="Mensagem"
                        rows={1}
                        className="flex-1 resize-none bg-white/10 rounded-[20px] px-4 py-2.5 text-[15px] md:text-[14px] text-cream placeholder:text-cream/40 focus:outline-none focus:ring-2 focus:ring-cobre/25 max-h-32"
                      />
                      <button onClick={enviarTexto} disabled={!texto.trim() || enviando} className="grad-cobre press w-11 h-11 rounded-full grid place-items-center text-vinho-d shrink-0 disabled:opacity-45 disabled:cursor-default" aria-label="Enviar">
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

          {/* ===================== CONTATO (3a coluna no PC) ===================== */}
          {ativa && (
            <div className="hidden xl:flex glass rounded-[20px] flex-col min-h-0 overflow-hidden h-full">
              <div className="px-4 h-[58px] border-b border-white/10 flex items-center shrink-0">
                <span className="text-[11px] uppercase tracking-[0.18em] text-dourado font-semibold">Contato</span>
              </div>
              <ScrollArea className="flex-1 min-h-0">
                <PainelContato conversa={ativa} qtdMensagens={mensagens.length} onToast={mostrarToast} />
              </ScrollArea>
            </div>
          )}
        </div>
      </div>

      {/* ===================== DRAWER: info do contato ===================== */}
      {ativa && drawer && (
        <ContatoDrawer conversa={ativa} qtdMensagens={mensagens.length} onFechar={() => setDrawer(false)} onToast={mostrarToast} />
      )}

      {/* ===================== LIGHTBOX ===================== */}
      {lightbox && (
        // A peça de cardápio é alta e cheia de texto miúdo. Antes o `max-h-full`
        // não segurava nada (percentual contra linha de grid automática não
        // restringe), então a imagem abria em tamanho natural e só dava pra ver
        // o cabeçalho. Agora ela cabe inteira na tela, e um toque amplia pra
        // largura pra dar pra ler os preços, com a tela rolando.
        <div
          className="fixed inset-0 z-[60] overflow-auto"
          style={{ background: "rgba(0,0,0,0.9)" }}
          onClick={() => { setLightbox(null); setZoom(false); }}
        >
          <div className="min-h-full flex items-center justify-center p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightbox}
              alt="Imagem"
              onClick={(e) => { e.stopPropagation(); setZoom((z) => !z); }}
              className={"rounded-lg " + (zoom ? "w-full max-w-[1100px] cursor-zoom-out" : "max-h-[88dvh] max-w-full object-contain cursor-zoom-in")}
            />
          </div>
          <button
            onClick={() => { setLightbox(null); setZoom(false); }}
            className="fixed top-3 right-3 w-11 h-11 grid place-items-center rounded-full text-white/90"
            style={{ background: "rgba(0,0,0,0.5)" }}
            aria-label="Fechar"
          >
            <X size={22} />
          </button>
          <a
            href={lightbox}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="fixed bottom-3 left-1/2 -translate-x-1/2 text-[12.5px] text-white/85 px-3.5 py-2 rounded-full"
            style={{ background: "rgba(0,0,0,0.55)" }}
          >
            {zoom ? "Toque na imagem pra caber na tela" : "Toque na imagem pra ampliar"}
          </a>
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

// ---------- Drawer de informações do contato (celular/tablet) ----------
// No PC o mesmo conteúdo vira a terceira coluna fixa (PainelContato). Era assim
// no desenho original e some informação demais quando fica escondido atrás de um
// botão: etiqueta, nota, desde quando a conversa está aberta.
function ContatoDrawer({ conversa, qtdMensagens, onFechar, onToast }: { conversa: Conversa; qtdMensagens: number; onFechar: () => void; onToast: (t: string) => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end xl:hidden" style={{ background: "rgba(0,0,0,0.5)" }} onClick={onFechar}>
      <div className="w-full max-w-sm h-full overflow-auto" style={{ background: "rgba(73,16,32,0.96)", backdropFilter: "blur(24px)", borderLeft: "1px solid rgba(255,255,255,0.14)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 h-[58px] border-b border-white/10">
          <span className="text-[11px] uppercase tracking-[0.18em] text-dourado font-semibold">Contato</span>
          <button onClick={onFechar} className="w-9 h-9 grid place-items-center rounded-full text-cream/60 hover:text-cream hover:bg-white/10" aria-label="Fechar"><X size={18} /></button>
        </div>
        <PainelContato conversa={conversa} qtdMensagens={qtdMensagens} onToast={onToast} />
      </div>
    </div>
  );
}

function PainelContato({ conversa, qtdMensagens, onToast }: { conversa: Conversa; qtdMensagens: number; onToast: (t: string) => void }) {
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
  const ultima = conversa.mensagens[conversa.mensagens.length - 1];
  const aguardando = ultima ? ultima.de !== "cliente" : false;
  const atendimento = quemAtende(conversa.estado);
  return (
        <div className="p-5">
          <div className="flex flex-col items-center text-center pb-4">
            <Avatar nome={conversa.clienteNome} tam={64} raio={18} />
            <div className="font-semibold text-cream text-[16px] mt-3">{conversa.clienteNome}</div>
            <a href={linkWhatsapp(conversa.clienteTelefone)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-cream/60 mt-1 hover:text-cream transition-colors">
              <span className="text-[#25d366]"><WhatsAppIcon size={12} /></span> {formatarTelefoneBR(conversa.clienteTelefone)}
            </a>
            {/* Veio de anuncio: a Meta so conta isso na primeira mensagem da
                conversa, entao e informacao que nao da pra recuperar depois. */}
            {conversa.origemAnuncio?.titulo && (
              <div className="mt-2 text-[11px] text-cream/55 px-3 py-1.5 rounded-[10px]" style={{ background: "rgba(231,207,148,0.10)" }}>
                Veio do anúncio: <span className="text-cream/80">{conversa.origemAnuncio.titulo}</span>
              </div>
            )}
          </div>
          {/* O pedido tomando forma, no alto da coluna: fica ao lado da conversa
              (dá pra conferir sem tapar o que o cliente está escrevendo) e é a
              primeira coisa que a equipe precisa ver ao abrir o atendimento. */}
          <div className="border-t border-white/10 pt-4 mb-4">
            <PedidoMontado clienteId={conversa.id} versao={qtdMensagens} />
          </div>
          {conversa.estado === "precisa_humano" && (
            <div className="flex items-center gap-2 text-[12px] rounded-[10px] px-3 py-2 mb-4" style={{ background: "rgba(231,207,148,0.12)", color: "#e7cf94" }}>
              <ShieldAlert size={14} /> A IA pediu a equipe nesta conversa.
            </div>
          )}
          {/* Estado do atendimento: quem responde, desde quando, e de quem é a
              vez. Sem isso a equipe abre a conversa sem saber se pode entrar. */}
          <div className="border-t border-white/10 pt-4">
            <span className="t-label text-cream/45">Atendimento</span>
            <div className="mt-2.5 space-y-2.5 text-[13px]">
              <div className="flex items-center gap-2.5" style={{ color: atendimento.cor }}>
                {atendimento.icone === "voce" ? <Hand size={14} className="shrink-0" />
                  : atendimento.icone === "espera" ? <ShieldAlert size={14} className="shrink-0" />
                  : <Bot size={14} className="shrink-0" />}
                <span>{atendimento.painel}</span>
              </div>
              <div className="flex items-center gap-2.5 text-cream/75">
                <Clock size={14} className="shrink-0 text-cream/45" />
                <span>Aberta desde {conversa.mensagens[0]?.hora ?? "-"}</span>
              </div>
              <div className="flex items-start gap-2.5 text-cream/75">
                <CheckCheck size={14} className="shrink-0 mt-0.5 text-cream/45" />
                <div className="min-w-0">
                  <div>{aguardando ? "Aguardando cliente" : "Cliente aguardando resposta"}</div>
                  <div className="text-[11px] text-cream/45 mt-0.5">último contato {ultima?.hora ?? "-"}</div>
                </div>
              </div>
            </div>
          </div>
          <div className="border-t border-white/10 pt-4 mt-4">
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
            {[["Canal", "WhatsApp"], ["Mensagens", String(qtdMensagens)], ["Custo de IA", conversa.custoCentavos ? brl(conversa.custoCentavos) : "-"]].map(([l, v]) => (
              <div key={l} className="flex items-center justify-between gap-3">
                <span className="text-[11px] text-cream/45">{l}</span>
                <span className="text-[13px] text-cream font-medium">{v}</span>
              </div>
            ))}
          </div>
          <a
            href={"/clientes?telefone=" + encodeURIComponent(conversa.clienteTelefone)}
            className="w-full mt-5 py-2.5 rounded-[12px] bg-white/8 text-cream/85 text-[13px] font-medium hover:bg-white/14 transition-colors flex items-center justify-center gap-2"
          >
            <ShoppingBag size={16} /> Ver pedidos do cliente
          </a>
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
