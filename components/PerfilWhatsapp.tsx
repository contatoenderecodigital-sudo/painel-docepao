"use client";

// O PERFIL COMERCIAL DO WHATSAPP, editado aqui em vez do painel da Meta.
//
// E o que o cliente ve quando toca no nome do contato: o recado curto embaixo
// do nome, a descricao, a categoria e a ficha (endereco, email, site).
//
// Migrar pro Cloud API tirou o aplicativo do celular da dona, e com ele o lugar
// onde ela editava isso. O caminho oficial passa a ser o WhatsApp Manager, um
// painel tecnico onde ela pode quebrar coisa sem querer.
//
// A FOTO nao esta aqui, e o motivo esta escrito no `lib/whatsapp/perfil.ts`:
// ela exige upload em duas etapas contra o id do app, que este painel nao
// conhece. Fica no WhatsApp Manager ate a gente trazer o id pra ca. Dizer isso
// na tela e melhor que a dona procurar um campo que nao existe.

import { useEffect, useState } from "react";
import { Loader2, Check, IdCard } from "lucide-react";
import { avisoDeSessao } from "@/lib/buscar-do-painel";
// Do modulo PURO, e nao do `perfil.ts`: aquele fala com o banco, e importar
// dele aqui arrastava o driver `pg` pro bundle do navegador.
import { CATEGORIAS, type PerfilWhatsapp as Perfil } from "@/lib/whatsapp/perfil-campos";

const CAMPOS: { chave: keyof Perfil; rotulo: string; dica: string; limite: number; linhas?: number }[] = [
  { chave: "about", rotulo: "Recado", dica: "A frase curta embaixo do nome da padaria", limite: 139 },
  { chave: "description", rotulo: "Descrição", dica: "O texto de apresentação, que aparece na ficha", limite: 512, linhas: 3 },
  { chave: "address", rotulo: "Endereço", dica: "Como aparece pro cliente", limite: 256 },
  { chave: "email", rotulo: "E-mail", dica: "Opcional", limite: 128 },
  { chave: "website", rotulo: "Site", dica: "Opcional", limite: 256 },
];

export default function PerfilWhatsapp() {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  // A TELA NAO DIZ QUE SALVOU SEM TER SALVADO. `await fetch` so lanca em erro de
  // rede: 401 e 500 passam direto e cairiam na linha do certinho verde.
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/whatsapp/perfil", { cache: "no-store" });
        if (!r.ok) {
          setErro(avisoDeSessao(r.status) ?? "Não consegui ler o perfil agora.");
          return;
        }
        const j = (await r.json()) as { ok: boolean; perfil: Perfil; erro: string | null };
        setPerfil(j.perfil);
        // `sem_conexao` nao e defeito: e a padaria ainda sem numero ligado.
        if (j.erro && j.erro !== "sem_conexao") setErro(j.erro);
        else if (j.erro === "sem_conexao") setErro("Conecte o WhatsApp primeiro, em Conectar WhatsApp.");
      } catch {
        setErro("Sem conexão. Não consegui ler o perfil.");
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  async function salvar() {
    if (!perfil) return;
    setSalvando(true);
    setSalvo(false);
    setErro(null);
    try {
      const r = await fetch("/api/whatsapp/perfil", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(perfil),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { erro?: string };
        setErro(
          avisoDeSessao(r.status) ??
            j.erro ??
            "Não consegui salvar. O perfil CONTINUA como estava: o que você escreveu está aqui.",
        );
        return;
      }
      setSalvo(true);
      setTimeout(() => setSalvo(false), 2500);
    } catch {
      setErro("Sem conexão. O perfil CONTINUA como estava: o que você escreveu está aqui.");
    } finally {
      setSalvando(false);
    }
  }

  const mudar = (chave: keyof Perfil, valor: string) =>
    setPerfil((p) => (p ? { ...p, [chave]: valor } : p));

  return (
    <div className="glass rounded-2xl p-6 max-w-2xl">
      <div className="flex items-start gap-3">
        <span className="grad-dourado w-10 h-10 rounded-xl grid place-items-center text-vinho-d shrink-0">
          <IdCard size={19} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-base font-semibold text-cream">Perfil do WhatsApp</div>
          <p className="text-[13px] text-cream/60 mt-0.5">
            O que o cliente vê ao tocar no nome da padaria. A foto continua sendo trocada no
            painel da Meta.
          </p>
        </div>
      </div>

      {carregando ? (
        <div className="grid place-items-center py-10 text-cream/50">
          <Loader2 size={22} className="animate-spin" />
        </div>
      ) : perfil ? (
        <>
          <div className="flex flex-col gap-3 mt-5">
            {CAMPOS.map((c) => (
              <label key={c.chave} className="block">
                <span className="text-[13px] font-semibold text-cream">{c.rotulo}</span>
                <span className="text-[12px] text-cream/50 ml-2">{c.dica}</span>
                {c.linhas ? (
                  <textarea
                    value={String(perfil[c.chave] ?? "")}
                    onChange={(e) => mudar(c.chave, e.target.value.slice(0, c.limite))}
                    rows={c.linhas}
                    className="w-full mt-1 rounded-xl bg-white/[0.05] border border-white/12 px-4 py-2.5 text-sm text-cream outline-none focus:ring-1 focus:ring-dourado/40 resize-none"
                  />
                ) : (
                  <input
                    value={String(perfil[c.chave] ?? "")}
                    onChange={(e) => mudar(c.chave, e.target.value.slice(0, c.limite))}
                    className="w-full mt-1 rounded-xl bg-white/[0.05] border border-white/12 px-4 py-2.5 text-sm text-cream outline-none focus:ring-1 focus:ring-dourado/40"
                  />
                )}
              </label>
            ))}

            <label className="block">
              <span className="text-[13px] font-semibold text-cream">Categoria</span>
              <span className="text-[12px] text-cream/50 ml-2">A lista é fechada, quem define é a Meta</span>
              <select
                value={perfil.vertical || "UNDEFINED"}
                onChange={(e) => mudar("vertical", e.target.value)}
                className="w-full mt-1 rounded-xl bg-white/[0.05] border border-white/12 px-4 py-2.5 text-sm text-cream outline-none focus:ring-1 focus:ring-dourado/40"
              >
                {CATEGORIAS.map((c) => (
                  <option key={c.valor} value={c.valor} className="bg-vinho-d">
                    {c.rotulo}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex items-center gap-2.5 mt-4">
            <button
              onClick={salvar}
              disabled={salvando}
              className="btn-cobre press px-4 py-2.5 rounded-lg text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-50"
            >
              {salvando ? <Loader2 size={15} className="animate-spin" /> : salvo ? <Check size={15} /> : null}
              {salvo ? "Salvo" : "Salvar perfil"}
            </button>
          </div>
        </>
      ) : null}

      {erro && <div className="text-[12.5px] text-[#ff8a8a] mt-3">{erro}</div>}
    </div>
  );
}
