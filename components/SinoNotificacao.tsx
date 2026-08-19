"use client";

// ============================================================================
//  SINO: avisa que chegou pedido novo, com som.
//
//  A padaria não fica olhando a tela: o pessoal está no balcão, no forno. Um
//  pedido que entra e ninguém vê é um cliente esperando resposta à toa.
//
//  Três decisões que valem explicar:
//
//  1. O som é DESLIGADO por padrão e fica guardado no navegador. Navegador
//     bloqueia áudio sem gesto do usuário, então tocar sozinho de cara não
//     funcionaria, e um painel que apita sem ninguém ter pedido é motivo pra
//     deixar a aba fechada.
//  2. O beep é gerado no próprio navegador (WebAudio), sem arquivo de som:
//     um mp3 seria mais uma coisa pra carregar, versionar e falhar.
//  3. A primeira leitura NUNCA toca. Sem isso, abrir o painel com 4 pedidos na
//     fila dispararia o alarme como se os 4 tivessem acabado de chegar.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bell, BellOff, ChevronRight, AlertTriangle } from "lucide-react";
import { brl } from "@/lib/tipos";

const CHAVE = "docepao:som-notificacao";
const INTERVALO_MS = 7000;

type Item = { id: string; nome: string; total: number; onde: "fila" | "aguardando"; motivo: string | null };
type Contagem = { fila: number; aguardando: number; ajuda: number; itens?: Item[] };

// Quem busca e quem escuta. Fora do componente porque valem pra pagina
// inteira: o sino do monitor e o do celular sao duas instancias do mesmo
// componente e nao podem virar dois relogios.
let liderAtivo = false;
const ouvintes = new Set<(c: Contagem) => void>();

export default function SinoNotificacao({ nome = "Painel" }: { nome?: string }) {
  const router = useRouter();
  const [som, setSom] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [contagem, setContagem] = useState<Contagem | null>(null);
  const anterior = useRef<Contagem | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);

  useEffect(() => {
    try {
      setSom(localStorage.getItem(CHAVE) === "1");
    } catch {
      // navegador sem storage: segue desligado, não quebra a tela
    }
  }, []);

  // Dois toques curtos, como um aviso de balcão, e não um alarme.
  const tocar = useCallback(() => {
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      audioCtx.current = audioCtx.current ?? new Ctx();
      const ctx = audioCtx.current;
      if (ctx.state === "suspended") void ctx.resume();
      [0, 0.18].forEach((atraso, i) => {
        const osc = ctx.createOscillator();
        const vol = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = i === 0 ? 880 : 1170;
        vol.gain.setValueAtTime(0.0001, ctx.currentTime + atraso);
        vol.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + atraso + 0.02);
        vol.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + atraso + 0.16);
        osc.connect(vol).connect(ctx.destination);
        osc.start(ctx.currentTime + atraso);
        osc.stop(ctx.currentTime + atraso + 0.18);
      });
    } catch {
      // som é conforto, nunca pode derrubar o painel
    }
  }, []);

  // Pede permissão pro navegador na hora que ela liga o som: é o mesmo gesto,
  // e assim o aviso funciona com a aba minimizada, que é o caso real da padaria.
  const avisarNoNavegador = useCallback((texto: string) => {
    try {
      if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
      const n = new Notification(nome, { body: texto, tag: "docepao-fila" });
      n.onclick = () => {
        window.focus();
        n.close();
      };
    } catch {
      // aviso é conforto, nunca pode derrubar o painel
    }
  }, [nome]);

  useEffect(() => {
    let vivo = true;
    // O sino existe duas vezes na pagina: no topo do monitor e na barra do
    // celular. Um deles busca e conta pro outro; senao sao duas batidas por
    // ciclo na mesma rota, e dois pedidos de atualizacao da pagina.
    const souOLider = !liderAtivo;
    if (!souOLider) {
      ouvintes.add(setContagem);
      return () => {
        vivo = false;
        ouvintes.delete(setContagem);
      };
    }
    liderAtivo = true;
    const checar = async () => {
      try {
        const r = await fetch("/api/fila/contagem", { cache: "no-store" });
        if (!r.ok || !vivo) return;
        const nova = (await r.json()) as Contagem;
        const antes = anterior.current;
        anterior.current = nova;
        setContagem(nova);
        ouvintes.forEach((avisar) => avisar(nova));
        // primeira leitura só estabelece a linha de base
        if (!antes) return;
        // Mudou pra qualquer lado (entrou pedido novo ou um saiu de Aguardando
        // pra Aprovacao): a pagina que esta na frente dela se atualiza sozinha,
        // e com ela o numero da lateral. Sem isso so um F5 mostrava a verdade.
        if (nova.fila !== antes.fila || nova.aguardando !== antes.aguardando || nova.ajuda !== antes.ajuda) {
          router.refresh();
        }
        const cresceu = nova.fila > antes.fila || nova.aguardando > antes.aguardando || nova.ajuda > antes.ajuda;
        if (cresceu) {
          if (som) tocar();
          if (typeof document !== "undefined") {
            document.title = `(${nova.fila + nova.aguardando + nova.ajuda}) ${nome}`;
          }
        }
      } catch {
        // rede caiu: tenta de novo no próximo ciclo
      }
    };
    void checar();
    const id = setInterval(checar, INTERVALO_MS);
    return () => {
      vivo = false;
      liderAtivo = false;
      clearInterval(id);
    };
  }, [som, tocar, avisarNoNavegador]);

  function alternar() {
    const novo = !som;
    setSom(novo);
    try {
      localStorage.setItem(CHAVE, novo ? "1" : "0");
    } catch {
      // sem storage: vale só nesta aba
    }
    // Ligar JÁ toca uma vez: é o gesto do usuário que libera o áudio no
    // navegador, e também prova pra ela que o som funciona.
    if (novo) {
      tocar();
      try {
        if (typeof Notification !== "undefined" && Notification.permission === "default") {
          void Notification.requestPermission();
        }
      } catch {
        // navegador sem suporte: o som sozinho já ajuda
      }
    }
  }

  const total = (contagem?.fila ?? 0) + (contagem?.aguardando ?? 0) + (contagem?.ajuda ?? 0);

  // O menu aberto já separa pedido de conversa, mas o balãozinho do sino somava
  // tudo e chamava de pedido: com 6 pedidos na fila e 1 conversa passada pra
  // equipe ele dizia "7 pedido(s) esperando você", e a dona ia procurar um
  // sétimo pedido que não existia. Aqui o texto conta cada coisa pelo nome.
  const pedidosEsperando = (contagem?.fila ?? 0) + (contagem?.aguardando ?? 0);
  const conversasEsperando = contagem?.ajuda ?? 0;
  const partesTitulo: string[] = [];
  if (pedidosEsperando > 0) {
    partesTitulo.push(`${pedidosEsperando} ${pedidosEsperando === 1 ? "pedido" : "pedidos"}`);
  }
  if (conversasEsperando > 0) {
    partesTitulo.push(`${conversasEsperando} ${conversasEsperando === 1 ? "conversa" : "conversas"}`);
  }
  const tituloSino =
    partesTitulo.length > 0 ? `${partesTitulo.join(" e ")} esperando você` : "Nada esperando você";

  return (
    <div className="relative">
      <button
        onClick={() => setAberto((v) => !v)}
        title={tituloSino}
        aria-label="Notificações"
        className="press toque relative w-10 h-10 grid place-items-center rounded-full transition-colors"
        style={
          total > 0
            ? { background: "rgba(231,207,148,0.16)", color: "#e7cf94", border: "1px solid rgba(231,207,148,0.35)" }
            : { background: "rgba(255,255,255,0.07)", color: "rgba(255,247,235,0.6)", border: "1px solid rgba(255,255,255,0.12)" }
        }
      >
        {som ? <Bell size={17} /> : <BellOff size={17} />}
        {total > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-1 rounded-full text-[10px] font-bold grid place-items-center"
            style={{ background: "#e7cf94", color: "#3d1219" }}
          >
            {total > 99 ? "99" : total}
          </span>
        )}
      </button>

      {aberto && (
        <>
          {/* clicar fora fecha, sem precisar mirar de novo no sino */}
          <button className="fixed inset-0 z-40 cursor-default" aria-label="Fechar" onClick={() => setAberto(false)} />
          <div
            // Ancorado na ESQUERDA e pra cima: o sino fica no rodape da barra
            // lateral, entao abrir pra direita jogava o painel pra fora da tela
            // e a dona so via um pedaco cortado.
            className="absolute bottom-12 left-0 z-50 w-[262px] max-w-[calc(100vw-2rem)] rounded-[14px] overflow-hidden text-left"
            style={{ background: "rgba(58,16,28,0.98)", border: "1px solid rgba(255,255,255,0.14)", boxShadow: "0 16px 44px rgba(0,0,0,0.5)" }}
          >
            <div className="px-3.5 py-2.5 border-b border-white/10 text-[11px] uppercase tracking-[0.16em] text-dourado font-semibold">
              Esperando você
            </div>

            {total === 0 ? (
              <div className="px-3.5 py-4 text-[13px] text-cream/60">Nada pendente agora.</div>
            ) : (
              <>
                {/* Cada linha diz DE ONDE veio e leva pra lá. Um número sozinho
                    não ajuda: ela precisa saber se é aprovar ou orçar. */}
                {(contagem?.fila ?? 0) > 0 && (
                  <Link href="/" onClick={() => setAberto(false)} className="flex items-center gap-2.5 px-3.5 py-3 hover:bg-white/[0.07] transition-colors">
                    <Bell size={15} className="text-dourado shrink-0" />
                    <span className="text-[13px] text-cream flex-1">
                      {contagem?.fila} pedido{(contagem?.fila ?? 0) > 1 ? "s" : ""} pra aprovar
                    </span>
                    <ChevronRight size={15} className="text-cream/40" />
                  </Link>
                )}
                {(contagem?.aguardando ?? 0) > 0 && (
                  <Link href="/aguardando" onClick={() => setAberto(false)} className="flex items-center gap-2.5 px-3.5 py-3 border-t border-white/10 hover:bg-white/[0.07] transition-colors">
                    <AlertTriangle size={15} className="text-dourado shrink-0" />
                    <span className="text-[13px] text-cream flex-1">
                      {contagem?.aguardando} esperando valor ou cliente
                    </span>
                    <ChevronRight size={15} className="text-cream/40" />
                  </Link>
                )}
                {/* A IA passou a conversa pra equipe: e o unico aviso que a dona
                    tem de que tem cliente esperando resposta de gente. */}
                {(contagem?.ajuda ?? 0) > 0 && (
                  <Link href="/atendimentos" onClick={() => setAberto(false)} className="flex items-center gap-2.5 px-3.5 py-3 border-t border-white/10 hover:bg-white/[0.07] transition-colors">
                    <AlertTriangle size={15} className="text-dourado shrink-0" />
                    <span className="text-[13px] text-cream flex-1">
                      {contagem?.ajuda} conversa{(contagem?.ajuda ?? 0) > 1 ? "s" : ""} esperando você responder
                    </span>
                    <ChevronRight size={15} className="text-cream/40" />
                  </Link>
                )}
              </>
            )}

            <button
              onClick={alternar}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 border-t border-white/10 hover:bg-white/[0.07] transition-colors text-left"
            >
              {som ? <Bell size={14} className="text-dourado shrink-0" /> : <BellOff size={14} className="text-cream/50 shrink-0" />}
              <span className="text-[12.5px] text-cream/75">{som ? "Som ligado" : "Som desligado"}</span>
              <span className="ml-auto text-[11px] text-dourado">{som ? "silenciar" : "ativar"}</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
