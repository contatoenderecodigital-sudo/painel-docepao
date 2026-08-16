"use client";

// Sidebar responsiva.
//
// Desktop (>=1024px): a barra fica fixa na lateral, como sempre foi.
// Celular: ela sai da frente. Uma barra superior com o botão de menu abre a
// sidebar por cima do conteúdo, e o conteúdo passa a usar a largura toda —
// antes a barra de 240px comia dois terços de uma tela de 360px.
//
// Fecha sozinha ao navegar, ao tocar fora e no Esc, que é o que qualquer app
// de celular faz. Sem isso o usuário abre o menu e fica preso nele.

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

export default function SidebarDrawer({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  const caminho = usePathname();

  // trocou de tela: fecha
  useEffect(() => {
    setAberto(false);
  }, [caminho]);

  // trava o scroll do fundo enquanto o menu está aberto e liga o Esc
  useEffect(() => {
    if (!aberto) return;
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = antes;
      window.removeEventListener("keydown", onKey);
    };
  }, [aberto]);

  return (
    <>
      {/* Barra superior — só no celular */}
      <header
        className="lg:hidden sticky top-0 z-30 flex items-center gap-3 px-4 h-14 shrink-0"
        style={{
          background: "linear-gradient(180deg, var(--brand-vinho-d), var(--brand-vinho))",
          borderBottom: "1px solid rgba(255,255,255,0.10)",
        }}
      >
        <button
          type="button"
          onClick={() => setAberto(true)}
          aria-label="Abrir menu"
          /* 44px: alvo mínimo de toque — abaixo disso erra o dedo */
          className="w-11 h-11 -ml-2 grid place-items-center rounded-xl text-cream/90 active:bg-white/10"
        >
          <Menu size={22} />
        </button>
        <span className="font-title font-bold text-cream truncate">{titulo}</span>
      </header>

      {/* Véu atrás do menu aberto */}
      {aberto && (
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={() => setAberto(false)}
          className="lg:hidden fixed inset-0 z-40"
          style={{ background: "rgba(0,0,0,0.55)" }}
        />
      )}

      <aside
        className={
          "w-60 shrink-0 text-white flex flex-col z-50 " +
          "fixed inset-y-0 left-0 max-w-[82vw] transition-transform duration-200 ease-out " +
          "lg:static lg:translate-x-0 lg:max-w-none lg:transition-none " +
          (aberto ? "translate-x-0" : "-translate-x-full")
        }
        style={{
          background: "linear-gradient(180deg, var(--brand-vinho-d), var(--brand-vinho))",
          borderRight: "1px solid rgba(255,255,255,0.10)",
        }}
      >
        {/* fechar — só aparece no celular, onde a sidebar é sobreposta */}
        <button
          type="button"
          onClick={() => setAberto(false)}
          aria-label="Fechar menu"
          className="lg:hidden absolute top-3 right-3 w-10 h-10 grid place-items-center rounded-xl text-white/70 active:bg-white/10"
        >
          <X size={20} />
        </button>
        {children}
      </aside>
    </>
  );
}
