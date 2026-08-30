// O PERFIL COMERCIAL DO WHATSAPP, editado de dentro do painel.
//
// POR QUE ESTA ROTA EXISTE
//
// Migrar pro Cloud API tirou o aplicativo do celular da dona, e com ele o lugar
// onde ela editava o recado embaixo do nome, a descricao e o endereco. O
// caminho que sobrou e o WhatsApp Manager da Meta: painel tecnico, cheio de
// coisa que ela pode quebrar sem querer.
//
// O `lib/whatsapp/perfil.ts` fazia esse trabalho desde sempre e NUNCA foi
// chamado por ninguem: apareceu como codigo morto em 30/08/2026, quando o
// detector de fantasma deixou de varrer so quatro pastas escritas a mao.
// Apagar seria jogar fora trabalho certo; o que faltava era a porta.

import { NextRequest } from "next/server";
import { lerSessao } from "@/lib/auth";
import { lerPerfil, salvarPerfil, type PerfilWhatsapp } from "@/lib/whatsapp/perfil";

export const dynamic = "force-dynamic";

export async function GET() {
  const sessao = await lerSessao();
  const negocioId = sessao?.negocioId;
  if (!negocioId) return Response.json({ ok: false, erro: "sem sessao" }, { status: 401 });

  const { perfil, erro } = await lerPerfil(negocioId);
  return Response.json({ ok: !erro, perfil, erro });
}

export async function POST(req: NextRequest) {
  const sessao = await lerSessao();
  const negocioId = sessao?.negocioId;
  if (!negocioId) return Response.json({ ok: false, erro: "sem sessao" }, { status: 401 });

  let body: Partial<PerfilWhatsapp>;
  try {
    body = (await req.json()) as Partial<PerfilWhatsapp>;
  } catch {
    return Response.json({ ok: false, erro: "corpo invalido" }, { status: 400 });
  }

  // So os campos que a Meta aceita escrever. A FOTO nao entra: ela exige upload
  // em duas etapas contra o id do app, que este painel nao conhece, e o
  // `perfil.ts` ja diz isso no cabecalho dele.
  const { about, description, address, email, website, vertical } = body;
  const r = await salvarPerfil(negocioId, { about, description, address, email, website, vertical });
  return Response.json(r, { status: r.ok ? 200 : 400 });
}
