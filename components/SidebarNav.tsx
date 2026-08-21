"use client";

// Navegação da sidebar (client): marca o item ativo pela rota atual, sem
// depender de prop vinda do servidor — assim o Shell fica no layout e não
// re-renderiza a cada troca de aba (navegação mais lisa).

import Link from "next/link";
import { usePathname } from "next/navigation";

// tipos: em quais tipos de negócio a aba aparece. Sem tipos = aparece em todos
// (universal). Padaria vê tudo; agência (só WhatsApp/CRM) não vê aprovação de
// pedido, pedidos do dia, recuperação nem resultados de padaria.
type Item = { href: string; label: string; icon: string; tipos?: string[]
  // So o dono do sistema ve: a padaria nao usa e so polui o menu dela.
  owner?: boolean;
};

const ITENS: Item[] = [
  { href: "/", label: "Aprovação", icon: "bell", tipos: ["padaria"] },
  { href: "/aguardando", label: "Aguardando confirmação", icon: "aguardando", tipos: ["padaria"] },
  { href: "/dia", label: "Pedidos do dia", icon: "order", tipos: ["padaria"] },
  { href: "/atendimentos", label: "Atendimentos", icon: "chat" },
  { href: "/testar", label: "Testar IA", icon: "bot", owner: true },
  { href: "/clientes", label: "Clientes", icon: "clientes" },
  { href: "/recuperar", label: "Recuperar", icon: "restore", tipos: ["padaria"] },
  { href: "/resultados", label: "Resultados", icon: "chart", tipos: ["padaria"] },
  // O botao Reportar gravava no banco e nenhuma tela lia: o botao que existe
  // pra tornar o problema visivel estava tornando ele invisivel.
  { href: "/reportes", label: "Reportes da equipe", icon: "chat", owner: true },
  { href: "/conectar", label: "Conectar WhatsApp", icon: "whatsapp", owner: true },
  { href: "/configuracoes", label: "Configurações", icon: "config" },
];

// Ícone via CSS mask: pinta o SVG com a cor do texto (currentColor).
function Icone({ nome }: { nome: string }) {
  if (nome === "whatsapp") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12.04 2c-5.46 0-9.9 4.44-9.9 9.9 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22c5.46 0 9.9-4.44 9.9-9.9S17.5 2 12.04 2Zm5.8 14.16c-.24.68-1.4 1.3-1.94 1.34-.5.05-.98.23-3.3-.68-2.79-1.1-4.56-3.96-4.7-4.15-.14-.19-1.12-1.49-1.12-2.84 0-1.35.7-2.01.96-2.29.24-.26.53-.32.7-.32.18 0 .35 0 .5.01.16.01.38-.06.6.46.23.53.77 1.86.84 2 .07.14.11.3.02.48-.09.19-.14.3-.28.47-.14.16-.29.36-.42.48-.14.14-.28.28-.12.55.16.28.72 1.18 1.54 1.91 1.06.94 1.95 1.24 2.23 1.38.28.14.44.12.6-.07.16-.19.69-.8.87-1.08.18-.28.36-.23.6-.14.24.09 1.55.73 1.82.86.28.14.46.21.53.32.07.12.07.68-.17 1.36Z" />
      </svg>
    );
  }
  if (nome === "aguardando") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
        <path d="M12 9v4M12 17h.01" />
      </svg>
    );
  }
  if (nome === "bot") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 8V4H8" />
        <rect width="16" height="12" x="4" y="8" rx="2" />
        <path d="M2 14h2M20 14h2M15 13v2M9 13v2" />
      </svg>
    );
  }
  if (nome === "clientes") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    );
  }
  if (nome === "config") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
      </svg>
    );
  }
  const url = `url(/icones/${nome}.svg)`;
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        width: 18,
        height: 18,
        backgroundColor: "currentColor",
        maskImage: url,
        WebkitMaskImage: url,
        maskSize: "contain",
        WebkitMaskSize: "contain",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskPosition: "center",
      }}
    />
  );
}

export default function SidebarNav({
  filaCount = 0,
  tipo = "padaria",
  owner = false,
}: {
  filaCount?: number;
  tipo?: string;
  owner?: boolean;
}) {
  const path = usePathname();
  const itens = ITENS.filter((it) => (!it.tipos || it.tipos.includes(tipo)) && (!it.owner || owner));
  return (
    <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
      {itens.map((it) => {
        const on = path === it.href;
        const badge = it.href === "/" ? filaCount : 0;
        return (
          <Link
            key={it.href}
            href={it.href}
            prefetch
            className={
              "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors " +
              (on ? "bg-white/12 text-white font-medium" : "text-white/70 hover:bg-white/6 hover:text-white")
            }
          >
            {on && (
              <span className="grad-dourado absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full" />
            )}
            <span className="leading-none opacity-90">
              <Icone nome={it.icon} />
            </span>
            <span className="flex-1">{it.label}</span>
            {badge ? (
              <span className="grad-dourado min-w-5 h-5 px-1.5 rounded-full text-vinho-d text-xs font-bold grid place-items-center">
                {badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
