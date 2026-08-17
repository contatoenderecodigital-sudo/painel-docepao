"use client";

// ============================================================================
//  SINO — avisa que chegou pedido novo, com som.
//
//  A padaria não fica olhando a tela: o pessoal está no balcão, no forno. Um
//  pedido que entra e ninguém vê é um cliente esperando resposta à toa.
//
//  Três decisões que valem explicar:
//
//  1. O som é DESLIGADO por padrão e fica guardado no navegador. Navegador
//     bloqueia áudio sem gesto do usuário, então tocar sozinho de cara não
//     funcionaria — e um painel que apita sem ninguém ter pedido é motivo pra
//     deixar a aba fechada.
//  2. O beep é gerado no próprio navegador (WebAudio), sem arquivo de som:
//     um mp3 seria mais uma coisa pra carregar, versionar e falhar.
//  3. A primeira leitura NUNCA toca. Sem isso, abrir o painel com 4 pedidos na
//     fila dispararia o alarme como se os 4 tivessem acabado de chegar.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, BellOff } from "lucide-react";

const CHAVE = "docepao:som-notificacao";
const INTERVALO_MS = 20000;

type Contagem = { fila: number; aguardando: number };

export default function SinoNotificacao() {
  const [som, setSom] = useState(false);
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

  // Dois toques curtos, como um aviso de balcão — não um alarme.
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

  useEffect(() => {
    let vivo = true;
    const checar = async () => {
      try {
        const r = await fetch("/api/fila/contagem", { cache: "no-store" });
        if (!r.ok || !vivo) return;
        const nova = (await r.json()) as Contagem;
        const antes = anterior.current;
        anterior.current = nova;
        setContagem(nova);
        // primeira leitura só estabelece a linha de base
        if (!antes) return;
        const cresceu = nova.fila > antes.fila || nova.aguardando > antes.aguardando;
        if (cresceu) {
          if (som) tocar();
          if (typeof document !== "undefined") {
            document.title = `(${nova.fila + nova.aguardando}) Doce Pão`;
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
      clearInterval(id);
    };
  }, [som, tocar]);

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
    if (novo) tocar();
  }

  const total = (contagem?.fila ?? 0) + (contagem?.aguardando ?? 0);

  return (
    <button
      onClick={alternar}
      title={som ? "Som ligado: toca quando entrar pedido novo. Clique pra silenciar." : "Som desligado. Clique pra ser avisada com som quando entrar pedido."}
      aria-label={som ? "Silenciar aviso de pedido novo" : "Ativar aviso sonoro de pedido novo"}
      className="press toque relative w-10 h-10 grid place-items-center rounded-full transition-colors"
      style={
        som
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
  );
}
