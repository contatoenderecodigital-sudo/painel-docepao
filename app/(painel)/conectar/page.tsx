import PainelConexao from "@/components/PainelConexao";
import { nomeNegocioAtual } from "@/lib/negocio";
import { lerSessao } from "@/lib/auth";
import { bancoConfigurado } from "@/lib/banco/db";
import { carregarConexao, type ConexaoWhatsapp } from "@/lib/banco/negocios";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>;
}) {
  const [nome, sessao, sp] = await Promise.all([nomeNegocioAtual(""), lerSessao(), searchParams]);

  let conexao: ConexaoWhatsapp;
  if (bancoConfigurado && sessao?.negocioId) {
    conexao = await carregarConexao(sessao.negocioId);
  } else if (sp.preview === "conectado" || sp.preview === "queda") {
    // Modo demo: previa dos estados conectado/queda (sem banco), pra ver e gravar.
    conexao = {
      conectado: true,
      phoneId: "demo",
      numero: "+55 (49) 99828-4354",
      perfil: nome || "Doce Pão",
      iaAtiva: true,
      conectadoEm: new Date(Date.now() - 2 * 86400000).toISOString(),
      mensagensHoje: 128,
      problema: sp.preview === "queda",
    };
  } else {
    conexao = {
      conectado: false,
      phoneId: null,
      numero: null,
      perfil: null,
      iaAtiva: true,
      conectadoEm: null,
      mensagensHoje: 0,
    };
  }

  return <PainelConexao conexao={conexao} nome={nome} />;
}
