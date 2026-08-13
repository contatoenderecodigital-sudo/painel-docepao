import Resultados from "@/components/Resultados";
import { carregarResultados, type Periodo } from "@/lib/resultados";
import { lerSessao } from "@/lib/auth";
import { nomeNegocioAtual } from "@/lib/negocio";

export const dynamic = "force-dynamic";

const VALIDOS: Periodo[] = ["hoje", "semana", "mes", "ano", "custom"];

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; de?: string; ate?: string }>;
}) {
  const sp = await searchParams;
  const periodo: Periodo = VALIDOS.includes(sp.periodo as Periodo) ? (sp.periodo as Periodo) : "mes";

  const sessao = await lerSessao();
  const [dados, nome] = await Promise.all([
    carregarResultados(sessao?.negocioId, periodo, sp.de, sp.ate),
    nomeNegocioAtual(),
  ]);

  return <Resultados dados={dados} nome={nome} de={sp.de ?? ""} ate={sp.ate ?? ""} />;
}
