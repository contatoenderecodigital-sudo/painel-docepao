"use client";

// Player de áudio no formato de mensagem de voz.
//
// O `<audio controls>` do navegador é uma barra cinza com menu de três pontos —
// não parece mensagem, parece player de site. Aqui é o formato que a equipe
// reconhece: botão redondo de tocar, onda, e o tempo correndo.
//
// A onda é decorativa e determinística (derivada da url), não uma análise real
// do arquivo: analisar o áudio exigiria baixar e decodificar tudo antes de
// desenhar, o que atrasaria a abertura da conversa sem mudar nada de útil.

import { useEffect, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";

function barras(chave: string, n = 34): number[] {
  let h = 0;
  for (let i = 0; i < chave.length; i++) h = (h * 31 + chave.charCodeAt(i)) >>> 0;
  return Array.from({ length: n }, (_, i) => {
    h = (h * 1103515245 + 12345) >>> 0;
    // entre 22% e 100% da altura, com um leve arco pro meio ficar mais alto
    const base = 0.22 + ((h >>> 16) % 79) / 100;
    const arco = 1 - Math.abs(i - n / 2) / (n * 1.6);
    return Math.max(0.18, Math.min(1, base * (0.7 + arco * 0.5)));
  });
}

function mmss(s: number): string {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

export default function AudioBolha({ src, claro }: { src: string; claro?: boolean }) {
  const ref = useRef<HTMLAudioElement | null>(null);
  const [tocando, setTocando] = useState(false);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(0);
  const ondas = barras(src);

  useEffect(() => {
    const a = ref.current;
    if (!a) return;
    const onTime = () => setPos(a.currentTime);
    const onMeta = () => setDur(a.duration);
    const onEnd = () => { setTocando(false); setPos(0); };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("ended", onEnd);
    };
  }, []);

  function alternar() {
    const a = ref.current;
    if (!a) return;
    if (a.paused) { void a.play(); setTocando(true); } else { a.pause(); setTocando(false); }
  }

  // clicar na onda pula pro ponto
  function pular(e: React.MouseEvent<HTMLDivElement>) {
    const a = ref.current;
    if (!a || !Number.isFinite(a.duration)) return;
    const r = e.currentTarget.getBoundingClientRect();
    a.currentTime = ((e.clientX - r.left) / r.width) * a.duration;
    setPos(a.currentTime);
  }

  const progresso = dur > 0 ? pos / dur : 0;
  const cor = claro ? "rgba(255,255,255,0.9)" : "var(--brand-dourado-l)";
  const corFraca = claro ? "rgba(255,255,255,0.35)" : "rgba(231,207,148,0.32)";

  return (
    <div className="flex items-center gap-2.5 py-1 pr-1" style={{ minWidth: 210 }}>
      <audio ref={ref} preload="metadata" src={src} className="hidden" />
      <button
        type="button"
        onClick={alternar}
        aria-label={tocando ? "Pausar áudio" : "Tocar áudio"}
        className="w-9 h-9 shrink-0 grid place-items-center rounded-full transition-transform active:scale-95"
        style={{ background: cor, color: "#3d1219" }}
      >
        {tocando ? <Pause size={16} /> : <Play size={16} style={{ marginLeft: 1 }} />}
      </button>

      <div className="flex-1 min-w-0">
        <div onClick={pular} className="flex items-end gap-[2px] h-6 cursor-pointer" role="presentation">
          {ondas.map((h, i) => (
            <span
              key={i}
              style={{
                flex: 1,
                height: `${Math.round(h * 100)}%`,
                borderRadius: 2,
                background: i / ondas.length <= progresso ? cor : corFraca,
                transition: "background 120ms linear",
              }}
            />
          ))}
        </div>
        <div className="text-[11px] mt-0.5" style={{ color: claro ? "rgba(255,255,255,0.65)" : "var(--brand-cream2)" }}>
          {mmss(tocando || pos > 0 ? pos : dur)}
        </div>
      </div>
    </div>
  );
}
