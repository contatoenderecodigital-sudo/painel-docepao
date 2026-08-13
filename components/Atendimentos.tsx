"use client";

// Tela de Atendimentos (chat) premium sobre vidro escuro. IA atende sozinha; o
// humano assume quando precisa e devolve pra IA. Composer funcional (emoji,
// anexo, enviar), etiquetas refinadas, info operacional e menu de acoes.

import { useEffect, useMemo, useRef, useState } from "react";
import type { Conversa, Mensagem } from "@/lib/tipos";
import { ScrollArea } from "@/components/ui/scroll-area";
import AjudaInfo from "@/components/AjudaInfo";
import { formatarTelefoneBR, linkWhatsapp } from "@/lib/tipos";
import {
  Search, Plus, Paperclip, SendHorizontal, MoreVertical, Zap,
  UserRound, Bot, ShoppingBag, Clock, CheckCheck, Archive, Ban, X, MessageSquare,
} from "lucide-react";

const CORES = ["#5b8c7b", "#c58a3d", "#7a6cae", "#4a7ba6", "#a85b52", "#6f9b52", "#b0713e", "#8a5a86"];

// Respostas rapidas (canned) da padaria. Digite "/" no campo ou clique no raio.
const RESPOSTAS = [
  "Nosso horário é das 7h às 19h, de segunda a sábado.",
  "O cento de salgado assado sai R$ 130,00.",
  "O cento de coxinha sai R$ 120,00.",
  "O cento de brigadeiro sai R$ 90,00.",
  "Pode retirar a partir das 14h.",
  "Aceitamos PIX, cartão e dinheiro na retirada.",
  "Bolos por encomenda pedimos com 2 dias de antecedência.",
  "Já anotei seu pedido. Qualquer coisa é só chamar!",
];

// Popover OPACO (nao deixa o conteudo de tras vazar por cima).
const POPOVER: React.CSSProperties = {
  background: "rgba(58,16,28,0.98)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: "1px solid rgba(255,255,255,0.12)",
  boxShadow: "0 16px 44px rgba(0,0,0,0.5)",
};

type Aba = "todas" | "ia" | "humano" | "resolvidas";
const ABAS: { id: Aba; nome: string }[] = [
  { id: "todas", nome: "Todas" },
  { id: "ia", nome: "IA" },
  { id: "humano", nome: "Humano" },
  { id: "resolvidas", nome: "Resolvidas" },
];

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

function Avatar({ nome, tam = 40, raio = 12 }: { nome: string; tam?: number; raio?: number }) {
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
function AvatarIA({ tam = 34 }: { tam?: number }) {
  return (
    <div className="shrink-0 grid place-items-center text-white select-none grad-cobre" style={{ width: tam, height: tam, borderRadius: 10 }} aria-hidden="true">
      <Bot size={tam * 0.56} strokeWidth={2} />
    </div>
  );
}
function AvatarEquipe({ tam = 34 }: { tam?: number }) {
  return (
    <div className="shrink-0 grid place-items-center text-white select-none" style={{ width: tam, height: tam, borderRadius: 10, background: "linear-gradient(135deg,#6e1f30,#491020)" }} aria-hidden="true">
      <UserRound size={tam * 0.56} strokeWidth={2} />
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

// Etiqueta (pill pequena) com cor por tipo.
type EtiquetaTom = "dourado" | "cobre" | "whatsapp" | "neutro";
function Etiqueta({ tom, comPonto, icone, children, onRemover }: { tom: EtiquetaTom; comPonto?: boolean; icone?: React.ReactNode; children: React.ReactNode; onRemover?: () => void }) {
  const est =
    tom === "dourado" ? { bg: "rgba(231,207,148,0.14)", c: "#e7cf94" }
    : tom === "cobre" ? { bg: "rgba(224,138,60,0.14)", c: "#e59355" }
    : tom === "whatsapp" ? { bg: "rgba(37,211,102,0.12)", c: "#4fd07f" }
    : { bg: "rgba(255,255,255,0.06)", c: "rgba(251,245,236,0.75)" };
  return (
    <span className="group inline-flex items-center gap-1.5 text-[11px] font-medium h-6 px-2.5 rounded-full" style={{ background: est.bg, color: est.c }}>
      {comPonto && <span className="w-1.5 h-1.5 rounded-full" style={{ background: est.c }} />}
      {icone}
      {children}
      {onRemover && (
        <button onClick={onRemover} className="opacity-0 group-hover:opacity-100 transition-opacity ml-0.5" aria-label="Remover etiqueta">
          <X size={11} />
        </button>
      )}
    </span>
  );
}

// Bolha agrupada: avatar so no primeiro do bloco.
function Balao({ de, texto, hora, nome, primeiro }: Mensagem & { nome: string; primeiro: boolean }) {
  const isCliente = de === "cliente";
  const av = isCliente ? <Avatar nome={nome} tam={34} raio={9} /> : de === "equipe" ? <AvatarEquipe /> : <AvatarIA />;
  const espaco = <div style={{ width: 34 }} className="shrink-0" />;
  return (
    <div className={"flex items-end gap-2.5 " + (primeiro ? "mt-3" : "mt-1") + (isCliente ? " justify-start" : " justify-end")}>
      {isCliente && (primeiro ? av : espaco)}
      <div className="max-w-[64%]">
        {!isCliente && de === "equipe" && primeiro && <div className="text-[10px] text-cream/45 mb-0.5 text-right pr-1">Você</div>}
        <div
          className={"rounded-[14px] px-3.5 py-2 text-[13.5px] leading-[1.5] whitespace-pre-line " + (isCliente ? "text-[#4a1020] rounded-bl-[4px]" : "text-white rounded-br-[4px]")}
          style={isCliente
            ? { background: "rgba(255,255,255,0.92)", boxShadow: "0 3px 12px rgba(0,0,0,0.16)" }
            : { background: "linear-gradient(135deg,#8f4712,#e08a3c)", boxShadow: "0 4px 14px rgba(143,71,18,0.28)" }}
        >
          {texto}
          <span className={"text-[10px] ml-2 float-right relative top-[7px] " + (isCliente ? "text-black/35" : "text-white/55")}>{hora}</span>
        </div>
      </div>
      {!isCliente && (primeiro ? av : espaco)}
    </div>
  );
}

export default function Atendimentos({ conversas: conversasIniciais }: { conversas: Conversa[] }) {
  const [conversas, setConversas] = useState<Conversa[]>(conversasIniciais);
  const [busca, setBusca] = useState("");
  const [ativaId, setAtivaId] = useState<string | undefined>(conversasIniciais[0]?.id);
  const [texto, setTexto] = useState("");
  const [msgsExtra, setMsgsExtra] = useState<Record<string, Mensagem[]>>({});
  const [controle, setControle] = useState<Record<string, "ia" | "humano">>({});
  const [tagsExtra, setTagsExtra] = useState<Record<string, string[]>>({});
  const [notas, setNotas] = useState<Record<string, string>>({});
  const [arquivadas, setArquivadas] = useState<Record<string, boolean>>({});
  const [resolvidas, setResolvidas] = useState<Record<string, boolean>>({});
  const [menuAberto, setMenuAberto] = useState(false);
  const [addTag, setAddTag] = useState(false);
  const [novaTag, setNovaTag] = useState("");
  const [verPedidos, setVerPedidos] = useState(false);
  const [aba, setAba] = useState<Aba>("todas");
  const [respostasAbertas, setRespostasAbertas] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const fim = useRef<HTMLDivElement>(null);

  // Tempo real: atualiza conversas/mensagens sozinho, sem recarregar a página.
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const r = await fetch("/api/conversas", { cache: "no-store" });
        if (r.ok) setConversas(await r.json());
      } catch {
        /* falha de rede: tenta de novo no próximo ciclo */
      }
    }, 5000);
    return () => clearInterval(id);
  }, []);

  // ultima mensagem de uma conversa (considerando as enviadas agora).
  const ultimaDe = (c: Conversa): Mensagem | undefined => {
    const ex = msgsExtra[c.id];
    return ex && ex.length ? ex[ex.length - 1] : c.mensagens[c.mensagens.length - 1];
  };
  const controleDe = (c: Conversa) => controle[c.id] ?? "ia";
  const aguardandoDe = (c: Conversa) => ultimaDe(c)?.de === "cliente"; // cliente esperando resposta

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const base = conversas
      .filter((c) => !arquivadas[c.id])
      .filter((c) => {
        if (aba === "resolvidas") return resolvidas[c.id];
        if (resolvidas[c.id]) return false;
        if (aba === "ia") return controleDe(c) === "ia";
        if (aba === "humano") return controleDe(c) === "humano";
        return true; // todas
      })
      .filter((c) =>
        !q ? true : c.clienteNome.toLowerCase().includes(q) || c.clienteTelefone.replace(/\D/g, "").includes(q.replace(/\D/g, "")) || c.previa.toLowerCase().includes(q),
      );
    // quem espera resposta ha mais tempo no topo; resto por mais recente.
    return base.sort((a, b) => {
      const aa = aguardandoDe(a), ab = aguardandoDe(b);
      if (aa !== ab) return aa ? -1 : 1;
      const ha = ultimaDe(a)?.hora ?? "", hb = ultimaDe(b)?.hora ?? "";
      return aa ? ha.localeCompare(hb) : hb.localeCompare(ha);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca, conversas, arquivadas, aba, resolvidas, controle, msgsExtra]);

  const ativa = conversas.find((c) => c.id === ativaId) ?? filtradas[0] ?? conversas[0];
  const ctrl = ativa ? controle[ativa.id] ?? "ia" : "ia";
  const mensagens = useMemo(
    () => (ativa ? [...ativa.mensagens, ...(msgsExtra[ativa.id] ?? [])] : []),
    [ativa, msgsExtra],
  );

  useEffect(() => {
    fim.current?.scrollIntoView({ block: "end" });
  }, [ativa?.id, mensagens.length]);

  if (!ativa) {
    // Sem conversas ainda: mantém o layout (busca + abas) e mostra o vazio no chat.
    return (
      <div className="px-6 py-6 h-screen flex flex-col">
        <div className="flex items-center gap-2 mb-3 shrink-0">
          <span className="text-[11px] uppercase tracking-[0.2em] text-dourado font-semibold">Atendimentos</span>
          <AjudaInfo titulo="Atendimentos" texto="As conversas do WhatsApp num só lugar. A IA atende sozinha e você assume a conversa quando quiser. Use a busca pra achar um cliente e as abas pra filtrar." />
        </div>
        <div className="flex-1 min-h-0">
          <div className="grid grid-cols-[300px_1fr] gap-4 h-full">
            {/* lista (busca + abas), vazia */}
            <div className="glass rounded-[20px] flex flex-col min-h-0 overflow-hidden">
              <div className="p-3">
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-cream/45" />
                  <input
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Pesquisar"
                    className="w-full bg-white/10 rounded-[10px] pl-9 pr-3 py-2 text-[13px] text-cream placeholder:text-cream/45 focus:outline-none focus:ring-2 focus:ring-cobre/25"
                  />
                </div>
              </div>
              <div className="px-3 pb-2 flex items-center gap-1">
                {ABAS.map((a) => (
                  <button key={a.id} onClick={() => setAba(a.id)} className={"text-[11.5px] font-medium px-2.5 py-1 rounded-full transition-colors " + (aba === a.id ? "bg-cobre/20 text-[color:var(--brand-cobre-l)]" : "text-cream/55 hover:text-cream hover:bg-white/8")}>
                    {a.nome}
                  </button>
                ))}
              </div>
              <div className="flex-1 grid place-items-center px-4 text-center">
                <div className="text-[13px] text-cream/50">Nenhum cliente ainda.</div>
              </div>
            </div>
            {/* chat vazio */}
            <div className="glass rounded-[20px] grid place-items-center px-6 text-center">
              <div>
                <div className="mx-auto w-14 h-14 rounded-2xl grid place-items-center text-dourado mb-3" style={{ background: "rgba(212,175,55,0.12)" }}>
                  <MessageSquare size={26} />
                </div>
                <div className="tracking-tight-apple text-xl font-bold text-cream">Nenhuma conversa ainda</div>
                <p className="text-sm text-cream/60 mt-1 max-w-xs mx-auto">
                  Quando um cliente chamar no WhatsApp, a conversa aparece aqui.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const resolvida = resolvidas[ativa.id];
  const statusTxt = resolvida ? "Resolvido" : ctrl === "humano" ? "Você está atendendo" : "IA atendendo";
  const statusCor = resolvida ? "#9aa0a6" : ctrl === "humano" ? "#e59355" : "#4fd07f";

  const ultima = mensagens[mensagens.length - 1];
  const aguardando = ultima?.de !== "cliente"; // se a ultima foi nossa, esperamos o cliente

  const tags = tagsExtra[ativa.id] ?? [];

  // respostas rapidas: abre pelo raio ou digitando "/" no campo
  const slashQ = texto.startsWith("/") ? texto.slice(1).toLowerCase() : null;
  const respostasFiltradas = slashQ !== null ? RESPOSTAS.filter((r) => r.toLowerCase().includes(slashQ)) : RESPOSTAS;
  const mostrarRespostas = (respostasAbertas || slashQ !== null) && respostasFiltradas.length > 0;

  function enviar() {
    const t = texto.trim();
    if (!t) return;
    setMsgsExtra((m) => ({ ...m, [ativa.id]: [...(m[ativa.id] ?? []), { de: "equipe", texto: t, hora: agora() }] }));
    setTexto("");
    setControle((c) => ({ ...c, [ativa.id]: "humano" })); // digitou = assumiu
  }
  function anexar(nome: string) {
    setMsgsExtra((m) => ({ ...m, [ativa.id]: [...(m[ativa.id] ?? []), { de: "equipe", texto: `Enviou um arquivo: ${nome}`, hora: agora() }] }));
    setControle((c) => ({ ...c, [ativa.id]: "humano" }));
  }
  function addEtiqueta() {
    const t = novaTag.trim();
    if (!t) return setAddTag(false);
    setTagsExtra((x) => ({ ...x, [ativa.id]: [...(x[ativa.id] ?? []), t] }));
    setNovaTag("");
    setAddTag(false);
  }

  return (
    <div className="px-6 py-6 h-screen flex flex-col">
      <div className="text-[11px] uppercase tracking-[0.2em] text-dourado font-semibold mb-3 shrink-0">Atendimentos</div>

      <div className="flex-1 min-h-0">
        <div className="grid grid-cols-[300px_1fr_280px] gap-4 h-full">
          {/* ---------- LISTA ---------- */}
          <div className="glass rounded-[20px] flex flex-col min-h-0 overflow-hidden">
            <div className="p-3 flex items-center gap-2">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-cream/45" />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Pesquisar"
                  className="w-full bg-white/10 rounded-[10px] pl-9 pr-3 py-2 text-[13px] text-cream placeholder:text-cream/45 focus:outline-none focus:ring-2 focus:ring-cobre/25"
                />
              </div>
            </div>
            {/* abas de filtro */}
            <div className="px-3 pb-2 flex items-center gap-1">
              {ABAS.map((a) => (
                <button key={a.id} onClick={() => setAba(a.id)} className={"text-[11.5px] font-medium px-2.5 py-1 rounded-full transition-colors " + (aba === a.id ? "bg-cobre/20 text-[color:var(--brand-cobre-l)]" : "text-cream/55 hover:text-cream hover:bg-white/8")}>
                  {a.nome}
                </button>
              ))}
            </div>
            <ScrollArea className="flex-1 min-h-0">
              <div className="px-2 pb-2">
                {filtradas.length === 0 && <div className="px-3 py-10 text-[13px] text-cream/55 text-center">Nada encontrado.</div>}
                {filtradas.map((c) => {
                  const on = c.id === ativa.id;
                  const cctrl = controle[c.id] ?? "ia";
                  const st = resolvidas[c.id] ? "Resolvido" : cctrl === "humano" ? "Você atendendo" : "IA atendendo";
                  const sc = resolvidas[c.id] ? "#9aa0a6" : cctrl === "humano" ? "#e59355" : "#4fd07f";
                  return (
                    <button
                      key={c.id}
                      onClick={() => setAtivaId(c.id)}
                      className={"w-full text-left px-2.5 py-2.5 rounded-[12px] flex gap-2.5 transition-colors mb-0.5 " + (on ? "grad-cobre" : "hover:bg-white/10")}
                    >
                      <Avatar nome={c.clienteNome} tam={44} raio={12} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className={"font-semibold text-[13.5px] truncate " + (on ? "text-white" : "text-cream")}>{c.clienteNome}</span>
                          <span className={"text-[10px] shrink-0 " + (on ? "text-white/70" : "text-cream/50")}>{c.ultimaHora}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-0.5">
                          <span className={"text-[12px] truncate " + (on ? "text-white/85" : "text-cream/70")}>{c.previa}</span>
                          {aguardandoDe(c) && (
                            <span className="shrink-0">
                              {c.naoLidas > 0 ? (
                                <span className="min-w-[18px] h-[18px] px-1 grid place-items-center rounded-full text-[10px] font-bold" style={{ background: on ? "#fff" : "#e08a3c", color: on ? "#8f4712" : "#fff" }}>{c.naoLidas}</span>
                              ) : (
                                <span className="w-2 h-2 rounded-full inline-block" style={{ background: on ? "#fff" : "#e08a3c" }} />
                              )}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: on ? "#fff" : sc }} />
                          <span className={"text-[10px] " + (on ? "text-white/85" : "")} style={on ? undefined : { color: sc }}>{st}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* ---------- CHAT ---------- */}
          <div className="glass rounded-[20px] flex flex-col min-h-0 overflow-hidden">
            {/* cabecalho */}
            <div className="px-4 h-[58px] border-b border-white/10 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <Avatar nome={ativa.clienteNome} tam={38} raio={12} />
                <div className="min-w-0">
                  <div className="font-semibold text-cream text-[14.5px] truncate">{ativa.clienteNome}</div>
                  <div className="flex items-center gap-1.5 text-[11px] mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusCor }} />
                    <span style={{ color: statusCor }}>{statusTxt}</span>
                  </div>
                </div>
              </div>
              <div className="relative shrink-0">
                <button onClick={() => setMenuAberto((v) => !v)} className="w-9 h-9 grid place-items-center rounded-full text-cream/55 hover:text-cream hover:bg-white/10 transition-colors" aria-label="Mais opções">
                  <MoreVertical size={18} />
                </button>
                {menuAberto && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuAberto(false)} />
                    <div className="absolute right-0 top-11 z-20 w-52 rounded-[14px] p-1.5 text-[13px]" style={POPOVER}>
                      <button onClick={() => { setResolvidas((r) => ({ ...r, [ativa.id]: !r[ativa.id] })); setMenuAberto(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-cream/85 hover:bg-white/10">
                        <CheckCheck size={16} /> {resolvida ? "Reabrir conversa" : "Marcar como resolvida"}
                      </button>
                      <button onClick={() => { setArquivadas((a) => ({ ...a, [ativa.id]: true })); setMenuAberto(false); setAtivaId(undefined); }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-cream/85 hover:bg-white/10">
                        <Archive size={16} /> Arquivar conversa
                      </button>
                      <button onClick={() => { setArquivadas((a) => ({ ...a, [ativa.id]: true })); setMenuAberto(false); setAtivaId(undefined); }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[#ff8a8a] hover:bg-white/10">
                        <Ban size={16} /> Bloquear contato
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* mensagens agrupadas */}
            <ScrollArea className="flex-1 min-h-0">
              <div className="px-6 py-4 flex flex-col">
                {mensagens.map((m, i) => {
                  const ant = mensagens[i - 1];
                  const primeiro = !ant || ant.de !== m.de;
                  return <Balao key={i} {...m} nome={ativa.clienteNome} primeiro={primeiro} />;
                })}
                <div ref={fim} />
              </div>
            </ScrollArea>

            {/* controle IA / humano */}
            <div className="px-3 pt-2.5 border-t border-white/10" style={{ background: "rgba(255,255,255,0.04)" }}>
              <div className="flex items-center justify-between gap-2 mb-2 text-[12px]">
                <span className="flex items-center gap-1.5" style={{ color: statusCor }}>
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: statusCor }} />
                  {ctrl === "humano" ? "Você está atendendo" : "A IA está respondendo"}
                </span>
                {ctrl === "humano" ? (
                  <button onClick={() => setControle((c) => ({ ...c, [ativa.id]: "ia" }))} className="press inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-full border border-cobre/40 text-[color:var(--brand-cobre-l)] hover:bg-cobre/10 transition-colors">
                    <Bot size={14} /> Devolver para a IA
                  </button>
                ) : (
                  <button onClick={() => setControle((c) => ({ ...c, [ativa.id]: "humano" }))} className="btn-cobre press inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5">
                    <UserRound size={14} /> Assumir conversa
                  </button>
                )}
              </div>

              {/* composer */}
              <div className="relative flex items-center gap-1.5 pb-2.5">
                <button onClick={() => fileRef.current?.click()} className="w-9 h-9 grid place-items-center rounded-full text-cream/55 hover:text-cream hover:bg-white/10 transition-colors" aria-label="Anexar arquivo">
                  <Paperclip size={18} />
                </button>
                <button onClick={() => setRespostasAbertas((v) => !v)} className="w-9 h-9 grid place-items-center rounded-full text-cream/55 hover:text-cream hover:bg-white/10 transition-colors" aria-label="Respostas rápidas" title="Respostas rápidas (ou digite /)">
                  <Zap size={18} />
                </button>
                <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) anexar(f.name); e.target.value = ""; }} />
                <input
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") enviar(); }}
                  placeholder="Escreva uma mensagem"
                  className="flex-1 bg-white/10 rounded-full px-4 py-2.5 text-[13.5px] text-cream placeholder:text-cream/40 focus:outline-none focus:ring-2 focus:ring-cobre/25"
                />
                <button onClick={enviar} disabled={!texto.trim()} className="grad-cobre press w-10 h-10 rounded-full grid place-items-center text-white shrink-0 shadow-[0_6px_16px_rgba(143,71,18,0.3)] disabled:opacity-45 disabled:cursor-default" aria-label="Enviar">
                  <SendHorizontal size={18} />
                </button>

                {mostrarRespostas && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setRespostasAbertas(false)} />
                    <div className="absolute left-0 right-14 bottom-14 z-20 rounded-[16px] p-1.5 max-h-72 overflow-auto" style={POPOVER}>
                      <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-cream/40">Respostas rápidas</div>
                      {respostasFiltradas.map((r, i) => (
                        <button key={i} onClick={() => { setTexto(r); setRespostasAbertas(false); }} className="w-full text-left px-3 py-2 rounded-lg text-[13px] text-cream/85 hover:bg-white/10 leading-snug">
                          {r}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ---------- INFO DO CONTATO ---------- */}
          <div className="glass rounded-[20px] flex flex-col min-h-0 overflow-hidden">
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-5">
                {/* topo */}
                <div className="flex flex-col items-center text-center pb-4">
                  <Avatar nome={ativa.clienteNome} tam={64} raio={18} />
                  <div className="font-semibold text-cream text-[16px] mt-3">{ativa.clienteNome}</div>
                  <a href={linkWhatsapp(ativa.clienteTelefone)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-cream/60 mt-1 hover:text-cream transition-colors">
                    <span className="text-[#4fd07f]"><WhatsAppIcon size={12} /></span> {formatarTelefoneBR(ativa.clienteTelefone)}
                  </a>
                </div>

                {/* etiquetas */}
                <div className="border-t border-white/10 pt-4">
                  <span className="t-label text-cream/45">Etiquetas</span>
                  <div className="flex flex-wrap items-center gap-2 mt-2.5">
                    <Etiqueta tom="dourado">Cliente</Etiqueta>
                    <Etiqueta tom={ctrl === "humano" ? "cobre" : "whatsapp"} comPonto>{statusTxt}</Etiqueta>
                    <Etiqueta tom="whatsapp" icone={<WhatsAppIcon size={11} />}>WhatsApp</Etiqueta>
                    {tags.map((t, i) => (
                      <Etiqueta key={i} tom="neutro" onRemover={() => setTagsExtra((x) => ({ ...x, [ativa.id]: tags.filter((_, j) => j !== i) }))}>{t}</Etiqueta>
                    ))}
                    {addTag ? (
                      <input
                        autoFocus
                        value={novaTag}
                        onChange={(e) => setNovaTag(e.target.value)}
                        onBlur={addEtiqueta}
                        onKeyDown={(e) => { if (e.key === "Enter") addEtiqueta(); if (e.key === "Escape") setAddTag(false); }}
                        placeholder="Nome da etiqueta"
                        className="h-6 w-32 bg-white/10 rounded-full px-3 text-[11px] text-cream placeholder:text-cream/40 focus:outline-none focus:ring-2 focus:ring-cobre/25"
                      />
                    ) : (
                      <button onClick={() => setAddTag(true)} className="h-6 w-6 grid place-items-center rounded-full bg-white/8 text-cream/60 hover:bg-white/15 hover:text-cream transition-colors" aria-label="Adicionar etiqueta">
                        <Plus size={13} />
                      </button>
                    )}
                  </div>
                </div>

                {/* info operacional do atendimento */}
                <div className="border-t border-white/10 pt-4 mt-4">
                  <span className="t-label text-cream/45">Atendimento</span>
                  <div className="mt-2.5 space-y-2.5 text-[13px]">
                    <div className="flex items-center gap-2.5">
                      {ctrl === "humano" ? <UserRound size={14} className="shrink-0" style={{ color: statusCor }} /> : <Bot size={14} className="shrink-0" style={{ color: statusCor }} />}
                      <span style={{ color: statusCor }}>{statusTxt}</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-cream/75">
                      <Clock size={14} className="shrink-0 text-cream/45" />
                      <span>Aberta desde {ativa.mensagens[0]?.hora ?? "-"}</span>
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

                {/* nota interna (memoria do cliente) */}
                <div className="border-t border-white/10 pt-4 mt-4">
                  <span className="t-label text-cream/45">Nota interna</span>
                  <textarea
                    value={notas[ativa.clienteTelefone] ?? ""}
                    onChange={(e) => setNotas((n) => ({ ...n, [ativa.clienteTelefone]: e.target.value }))}
                    placeholder="Adicionar nota..."
                    rows={2}
                    className="w-full mt-2 bg-white/[0.06] rounded-[10px] px-3 py-2 text-[12.5px] text-cream placeholder:text-cream/40 focus:outline-none focus:ring-2 focus:ring-cobre/25 resize-none leading-relaxed"
                  />
                </div>

                {/* dados */}
                <div className="border-t border-white/10 pt-4 mt-4 space-y-3">
                  {[["Canal", "WhatsApp"], ["Mensagens", String(mensagens.length)]].map(([l, v]) => (
                    <div key={l} className="flex items-center justify-between gap-3">
                      <span className="text-[11px] text-cream/45">{l}</span>
                      <span className="text-[13px] text-cream font-medium">{v}</span>
                    </div>
                  ))}
                </div>

                <button onClick={() => setVerPedidos(true)} className="w-full mt-5 py-2.5 rounded-[12px] bg-white/8 text-cream/85 text-[13px] font-medium hover:bg-white/14 transition-colors flex items-center justify-center gap-2">
                  <ShoppingBag size={16} /> Ver pedidos do cliente
                </button>
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>

      {/* modal: pedidos do cliente (dados reais do banco quando houver) */}
      {verPedidos && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: "rgba(0,0,0,0.5)" }} onClick={() => setVerPedidos(false)}>
          <div className="rounded-[20px] w-full max-w-md overflow-hidden flex flex-col" style={{ background: "rgba(73,16,32,0.9)", backdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.14)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/10">
              <div>
                <div className="t-label text-dourado">Pedidos do cliente</div>
                <h3 className="t-h2 text-cream mt-1">{ativa.clienteNome}</h3>
              </div>
              <button onClick={() => setVerPedidos(false)} className="w-9 h-9 grid place-items-center rounded-full text-cream/60 hover:text-cream hover:bg-white/10" aria-label="Fechar"><X size={18} /></button>
            </div>
            <div className="p-6 text-center">
              <ShoppingBag size={30} className="mx-auto text-cream/30" />
              <div className="text-cream/70 text-sm mt-3">Nenhum pedido registrado no sistema ainda para este cliente.</div>
              <div className="text-cream/45 text-xs mt-1">O histórico aparece aqui conforme os pedidos entram pela plataforma.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
