// Sinal de vida da ponte da impressora, pro painel dizer se a cozinha vai
// receber o papel. Quem alimenta isso e a propria ponte, ao consultar a fila.
import { lerSessao } from "@/lib/auth";
import { bancoConfigurado } from "@/lib/banco/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const sessao = await lerSessao();
  if (!sessao) return new Response("nao autorizado", { status: 401 });
  if (!bancoConfigurado) return Response.json({ online: true, segundosDesde: 0 });
  try {
    const { statusDaPonte } = await import("@/lib/banco/fila");
    return Response.json(await statusDaPonte(sessao.negocioId));
  } catch (e) {
    console.error("[impressora] status", e);
    return Response.json({ online: false, segundosDesde: null });
  }
}
