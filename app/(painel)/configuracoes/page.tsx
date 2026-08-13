import AvisoDoDia from "@/components/AvisoDoDia";
import ToggleIA from "@/components/ToggleIA";
import LogoUpload from "@/components/LogoUpload";
import AjudaInfo from "@/components/AjudaInfo";
import { lerSessao } from "@/lib/auth";
import { bancoConfigurado } from "@/lib/banco/db";
import { carregarAvisoDoDia, carregarIaAtiva, carregarMarcaCache } from "@/lib/banco/negocios";
import { ehHojeBR } from "@/lib/aviso";

export const dynamic = "force-dynamic";

export default async function Page() {
  const sessao = await lerSessao();

  let texto: string | null = null;
  let atualizadoEm: string | null = null;
  let iaAtiva = true;
  let logoAtual: string | null = null;
  if (bancoConfigurado && sessao?.negocioId) {
    const [a, ia, marca] = await Promise.all([
      carregarAvisoDoDia(sessao.negocioId),
      carregarIaAtiva(sessao.negocioId),
      carregarMarcaCache(sessao.negocioId),
    ]);
    texto = a.texto;
    atualizadoEm = a.atualizadoEm;
    iaAtiva = ia;
    logoAtual = marca?.logoUrl ?? null;
  } else {
    // Modo demo (sem banco): exemplo preenchido pra mostrar a feature.
    texto = "Hoje o pão francês vai só até as 18h. Amanhã cedo tem fresquinho de novo.";
    atualizadoEm = new Date().toISOString();
  }
  const ativoHoje = ehHojeBR(atualizadoEm);

  return (
    <div className="px-8 py-7">
      <div className="text-[11px] uppercase tracking-[0.2em] text-dourado font-semibold">Configurações</div>
      <div className="flex items-center gap-2 mt-1">
        <h1 className="font-title text-3xl font-bold text-cream">Configurações</h1>
        <AjudaInfo titulo="Configurações" texto="Ajustes do atendimento: ligue ou desligue a IA e escreva o aviso do dia que a IA deve passar aos clientes." />
      </div>
      <p className="text-sm text-cream/60 mt-1 mb-8 max-w-2xl">
        Ajustes do atendimento: ligue ou desligue a IA e avise as novidades do dia.
      </p>

      <div className="flex flex-col gap-4">
        <ToggleIA ativa={iaAtiva} />
        <LogoUpload inicial={logoAtual} />
        <AvisoDoDia texto={texto} atualizadoEm={atualizadoEm} ativoHoje={ativoHoje} />
      </div>
    </div>
  );
}
