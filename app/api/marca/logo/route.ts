// Salva ou remove a logo do negocio logado (config.logo_url). A logo chega ja
// redimensionada do navegador como data URL (base64), entao nao ha upload de
// arquivo nem storage externo: fica no proprio config do tenant.

import { NextRequest } from "next/server";
import { lerSessao } from "@/lib/auth";
import { definirLogo } from "@/lib/banco/negocios";

export const dynamic = "force-dynamic";

// Teto de tamanho do data URL (a logo ja vem reduzida a ~256px do cliente).
// Base64 infla ~33%, entao 600 KB de string cobre uma logo pequena com folga.
const MAX = 600 * 1024;

export async function POST(req: NextRequest) {
  const sessao = await lerSessao();
  const negocioId = sessao?.negocioId ?? process.env.NEGOCIO_PADRAO_ID;
  if (!negocioId) return Response.json({ ok: false, erro: "sem sessao" }, { status: 401 });

  let body: { logo?: string | null };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, erro: "corpo invalido" }, { status: 400 });
  }

  const logo = body.logo;

  // Remover a logo (volta pro padrao do tenant).
  if (logo === null || logo === "") {
    await definirLogo(negocioId, null);
    return Response.json({ ok: true, logo: null });
  }

  // Aceita so imagem em data URL, dentro do teto.
  if (typeof logo !== "string" || !/^data:image\/(png|jpeg|webp);base64,/.test(logo)) {
    return Response.json({ ok: false, erro: "formato invalido" }, { status: 400 });
  }
  if (logo.length > MAX) {
    return Response.json({ ok: false, erro: "imagem muito grande" }, { status: 413 });
  }

  await definirLogo(negocioId, logo);
  return Response.json({ ok: true });
}
