// ============================================================================
//  FOTO DE REFERÊNCIA DE UM PEDIDO — serve a imagem guardada no banco.
//  A imagem fica em base64 no Postgres (não no filesystem: container efêmero).
//  Só o painel logado enxerga, e escopada pelo negócio da sessão (multi-tenant).
//  Usada no card da Fila de Aprovação e na Produção do dia. O cupom NÃO usa.
// ============================================================================

import { NextRequest } from "next/server";
import { lerSessao } from "@/lib/auth";
import { buscarFotoPedido } from "@/lib/banco/conversas";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await lerSessao();
  if (!sessao) return new Response("nao autorizado", { status: 401 });

  const { id } = await params;
  if (!id) return new Response("id ausente", { status: 400 });

  let foto;
  try {
    // ?tipo=comprovante busca o comprovante do pix; sem parametro, a referencia
    // da peca, que e o que a cozinha precisa ver na producao.
    const tipo = req.nextUrl.searchParams.get("tipo") === "comprovante" ? "comprovante" : "referencia";
    foto = await buscarFotoPedido(sessao.negocioId, id, tipo);
  } catch (e) {
    console.error("[foto] falha ao buscar foto do pedido:", e);
    return new Response("erro", { status: 500 });
  }
  if (!foto) return new Response("sem foto", { status: 404 });

  const bin = Buffer.from(foto.dados, "base64");
  return new Response(bin, {
    status: 200,
    headers: {
      "Content-Type": foto.mime || "image/jpeg",
      "Cache-Control": "private, max-age=300",
      "Content-Length": String(bin.length),
    },
  });
}
