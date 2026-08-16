// Shell do painel: sidebar de navegação + área de conteúdo.
// Server Component — também é o portão de sessão: sem login, manda pro /login.
// Fica no LAYOUT do grupo (painel), então a sidebar não re-renderiza a cada
// troca de aba: só o conteúdo troca. A navegação da sidebar é client (usePathname).

import SidebarDrawer from "@/components/SidebarDrawer";
import Image from "next/image";
import { redirect } from "next/navigation";
import { MapPin } from "lucide-react";
import { bancoConfigurado } from "@/lib/banco/db";
import { lerSessao } from "@/lib/auth";
import { sair } from "@/app/login/acao";
import SidebarNav from "@/components/SidebarNav";

// Clareia (amount>0, rumo ao branco) ou escurece (amount<0, rumo ao preto) um hex.
function mix(hex: string, amount: number): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const t = amount < 0 ? 0 : 255;
  const p = Math.min(1, Math.abs(amount));
  const c = (v: number) => Math.round((t - v) * p + v).toString(16).padStart(2, "0");
  return "#" + c(r) + c(g) + c(b);
}

// Override das CSS vars da marca a partir da cor do tenant (white-label por cliente).
// Doce Pão usa as cores padrão (fica igual); outro tenant reveste o painel inteiro.
function paletaDoTenant(pri: string | null, des: string | null): React.CSSProperties {
  const s: Record<string, string> = {};
  if (pri) {
    s["--brand-vinho"] = pri;
    s["--brand-vinho-d"] = mix(pri, -0.28);
  }
  if (des) {
    s["--brand-dourado"] = des;
    s["--brand-dourado-l"] = mix(des, 0.32);
    s["--brand-cobre"] = des;
    s["--brand-cobre-l"] = mix(des, 0.22);
    s["--brand-cobre-d"] = mix(des, -0.2);
  }
  return s as React.CSSProperties;
}

export default async function Shell({
  children,
  filaCount = 0,
}: {
  children: React.ReactNode;
  filaCount?: number;
}) {
  // Portão de sessão: com banco configurado, exige login.
  const sessao = bancoConfigurado ? await lerSessao() : null;
  if (bancoConfigurado && !sessao) redirect("/login");

  // Nome E PALETA vêm do tenant logado (white-label por cliente).
  let nomeNegocio = "Doce Pão";
  let corPrimaria: string | null = null;
  let corDestaque: string | null = null;
  let tipoNegocio = "padaria";
  let logoUrl: string | null = null;
  if (sessao) {
    const { carregarMarcaCache } = await import("@/lib/banco/negocios");
    const marca = await carregarMarcaCache(sessao.negocioId);
    if (marca?.nome) nomeNegocio = marca.nome;
    corPrimaria = marca?.corPrimaria ?? null;
    corDestaque = marca?.corDestaque ?? null;
    if (marca?.tipo) tipoNegocio = marca.tipo;
    logoUrl = marca?.logoUrl ?? null;
  }
  const styleMarca = paletaDoTenant(corPrimaria, corDestaque);

  // No celular vira coluna (barra superior + conteúdo); no desktop, lado a lado.
  return (
    <div className="min-h-screen flex flex-col lg:flex-row app-mesh text-cream" style={styleMarca}>
      {/* Sidebar — material fosco da marca (estilo Apple).
          Fixa no desktop, drawer no celular (ver SidebarDrawer). */}
      <SidebarDrawer titulo={nomeNegocio}>
        <div className="px-5 py-6 border-b border-white/10 flex items-center gap-3">
          {logoUrl ? (
            // Logo anexada pelo tenant (Configurações): vale pra qualquer painel.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt=""
              className="w-12 h-12 shrink-0 rounded-full object-contain bg-white/5 border border-white/10"
            />
          ) : tipoNegocio === "agencia" ? (
            // Agência (Endereço Digital): marca própria, o MapPin dourado do login.
            <div
              className="w-12 h-12 shrink-0 rounded-[13px] grid place-items-center"
              style={{
                border: "1px solid var(--brand-dourado)",
                background: "rgba(201,169,97,0.10)",
              }}
            >
              <MapPin className="w-6 h-6" strokeWidth={2.2} style={{ color: "var(--brand-dourado)" }} />
            </div>
          ) : (
            <Image
              src="/logo.png"
              alt=""
              width={48}
              height={48}
              className="w-12 h-12 shrink-0 rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.25)]"
              priority
            />
          )}
          <div className="min-w-0">
            <div className="font-title text-lg font-bold leading-tight truncate">{nomeNegocio}</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-dourado-l mt-0.5">Painel</div>
          </div>
        </div>

        <SidebarNav filaCount={filaCount} tipo={tipoNegocio} />

        <div className="px-4 py-4 border-t border-white/10">
          {sessao ? (
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs text-white/80 truncate">{sessao.nome}</div>
                <div className="text-[10px] text-white/40">Endereço Digital</div>
              </div>
              <form action={sair}>
                <button
                  type="submit"
                  className="toque text-[11px] text-white/60 hover:text-white border border-white/15 rounded-md px-3 py-1 transition-colors"
                >
                  Sair
                </button>
              </form>
            </div>
          ) : (
            <div className="text-[11px] text-white/45">Endereço Digital · demo</div>
          )}
        </div>
      </SidebarDrawer>

      {/* Conteúdo */}
      <main className="flex-1 min-w-0 overflow-x-hidden">{children}</main>
    </div>
  );
}
