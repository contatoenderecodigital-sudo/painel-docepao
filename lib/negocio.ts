// ============================================================================
//  Nome do negócio logado (multi-tenant), pra usar em COPY das telas.
//  Sem banco/sessão (modo demo) cai num genérico — nunca hardcode "Doce Pão".
// ============================================================================

import { bancoConfigurado } from "./banco/db";
import { lerSessao } from "./auth";

export async function nomeNegocioAtual(padrao = "sua padaria"): Promise<string> {
  if (!bancoConfigurado) return padrao;
  const sessao = await lerSessao();
  if (!sessao) return padrao;
  const { carregarMarcaCache } = await import("./banco/negocios");
  const marca = await carregarMarcaCache(sessao.negocioId);
  return marca?.nome || padrao;
}
