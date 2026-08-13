import Recuperar from "@/components/Recuperar";
import { carregarParados, carregarStatsRecuperacao } from "@/lib/dados";
import { lerSessao } from "@/lib/auth";
import { bancoConfigurado } from "@/lib/banco/db";
import { nomeNegocioAtual } from "@/lib/negocio";

export const dynamic = "force-dynamic";

const MSG_PADRAO = "Oi {nome}! Seu orçamento ainda está de pé. Quer confirmar? É só responder por aqui.";

export default async function Page() {
  const sessao = await lerSessao();
  const [parados, stats] = await Promise.all([
    carregarParados(sessao?.negocioId),
    carregarStatsRecuperacao(sessao?.negocioId),
  ]);
  const nomeNegocio = await nomeNegocioAtual("");

  let msgCobranca = MSG_PADRAO;
  if (bancoConfigurado && sessao?.negocioId) {
    const { carregarMsgCobranca } = await import("@/lib/banco/negocios");
    msgCobranca = (await carregarMsgCobranca(sessao.negocioId)) || MSG_PADRAO;
  }

  return (
    <Recuperar
      parados={parados}
      nomeNegocio={nomeNegocio}
      agora={Date.now()}
      stats={stats}
      msgCobranca={msgCobranca}
    />
  );
}
