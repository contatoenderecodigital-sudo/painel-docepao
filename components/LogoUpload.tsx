"use client";

// Anexa a logo do negocio (aparece na sidebar de todos os paineis do tenant).
// A imagem e redimensionada aqui no navegador pra no maximo 256px e salva como
// data URL no config do negocio, sem storage externo. Trocar a logo reflete no
// painel na proxima navegacao.

import { useRef, useState } from "react";
import { Loader2, ImageUp, Trash2 } from "lucide-react";
import { avisoDeSessao } from "@/lib/buscar-do-painel";

const LADO_MAX = 256; // maior lado da logo depois de reduzir

// Le o arquivo, desenha reduzido num canvas e devolve um data URL leve (webp).
function reduzir(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onerror = () => reject(new Error("falha ao ler"));
    leitor.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("imagem invalida"));
      img.onload = () => {
        const escala = Math.min(1, LADO_MAX / Math.max(img.width, img.height));
        const w = Math.round(img.width * escala);
        const h = Math.round(img.height * escala);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("sem canvas"));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/webp", 0.9));
      };
      img.src = leitor.result as string;
    };
    leitor.readAsDataURL(arquivo);
  });
}

export default function LogoUpload({ inicial }: { inicial: string | null }) {
  const [logo, setLogo] = useState<string | null>(inicial);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function escolher(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setErro(null);
    setSalvando(true);
    try {
      const dataUrl = await reduzir(arquivo);
      const r = await fetch("/api/marca/logo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logo: dataUrl }),
      });
      // O STATUS VEM ANTES DO CORPO.
      //
      // `r.json()` lanca quando a resposta nao e JSON, e um 401 responde a
      // pagina de login. A excecao caia no catch e a padaria via na tela o texto
      // cru do erro de parse, em ingles, no lugar de "sua sessao expirou".
      if (!r.ok) {
        setErro(avisoDeSessao(r.status) ?? "Não consegui salvar a logo. Tente de novo.");
        return;
      }
      const j = (await r.json()) as { ok?: boolean; erro?: string };
      if (!j.ok) {
        setErro(j.erro || "Não consegui salvar a logo. Tente de novo.");
        return;
      }
      setLogo(dataUrl);
    } catch {
      // Mensagem de excecao nao e recado pra quem esta na padaria.
      setErro("Não consegui salvar a logo. Tente de novo.");
    } finally {
      setSalvando(false);
      if (input.current) input.current.value = "";
    }
  }

  async function remover() {
    setErro(null);
    setSalvando(true);
    try {
      const r = await fetch("/api/marca/logo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logo: null }),
      });
      if (!r.ok) {
        setErro(
          avisoDeSessao(r.status) ??
            "Não consegui remover a logo. Ela CONTINUA aparecendo: tente de novo.",
        );
        return;
      }
      const j = (await r.json()) as { ok?: boolean; erro?: string };
      if (!j.ok) {
        setErro(j.erro || "Não consegui remover a logo. Ela CONTINUA aparecendo: tente de novo.");
        return;
      }
      setLogo(null);
    } catch {
      setErro("Não consegui remover a logo. Ela CONTINUA aparecendo: tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="glass rounded-2xl p-5 flex items-center gap-4 max-w-2xl">
      <span className="grad-dourado w-10 h-10 rounded-xl grid place-items-center text-vinho-d shrink-0">
        <ImageUp size={19} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-cream">Logo do negócio</div>
        <div className="text-[12.5px] text-cream/60">
          {logo
            ? "Aparece na barra lateral do painel. Troque quando quiser."
            : "Anexe a logo. Ela aparece na barra lateral do painel."}
        </div>
        {erro && <div className="text-[12px] text-red-300 mt-1">{erro}</div>}
      </div>

      {/* preview da logo atual */}
      {logo && (
        <span className="w-12 h-12 shrink-0 rounded-full overflow-hidden border border-white/15 bg-white/5 grid place-items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt="" className="w-full h-full object-contain" />
        </span>
      )}

      {salvando && <Loader2 size={16} className="animate-spin text-cream/50 shrink-0" />}

      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" onChange={escolher} className="hidden" />

      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={salvando}
        className="toque shrink-0 text-[13px] font-semibold text-vinho-d grad-dourado rounded-lg px-4 py-2 press disabled:opacity-60"
      >
        {logo ? "Trocar" : "Anexar"}
      </button>

      {logo && (
        <button
          type="button"
          onClick={remover}
          disabled={salvando}
          className="shrink-0 text-cream/55 hover:text-red-300 border border-white/15 rounded-lg p-2 transition-colors disabled:opacity-60"
          aria-label="Remover logo"
        >
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );
}
