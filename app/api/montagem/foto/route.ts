// A foto de referência que o cliente mandou, pra dona VER na hora de conferir o
// bolo. Ela ficava guardada e só aparecia depois, no pedido: quem confere o
// bolo precisa dela junto do tema e do nome, senão confere no escuro.
import { NextRequest } from "next/server";
import { lerSessao } from "@/lib/auth";
import { bancoConfigurado, queryUm } from "@/lib/banco/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sessao = await lerSessao();
  if (!sessao) return new Response("nao autorizado", { status: 401 });
  const clienteId = req.nextUrl.searchParams.get("cliente");
  if (!clienteId || !bancoConfigurado) return Response.json({ foto: null });
  try {
    const l = await queryUm<{ dados: string; mime: string }>(
      `select dados, mime from pedido_fotos
        where negocio_id = $1 and cliente_id = $2 and pedido_id is null
        order by criado_em desc limit 1`,
      [sessao.negocioId, clienteId],
    );
    return Response.json(l ? { foto: `data:${l.mime || "image/jpeg"};base64,${l.dados}` } : { foto: null });
  } catch (e) {
    console.error("[montagem/foto]", e);
    return Response.json({ foto: null });
  }
}
