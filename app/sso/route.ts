// SSO: o hub (console) manda um token assinado com SSO_SECRET e loga a sessão do
// painel automaticamente (sem login separado). Usado no iframe do MODO OWNER.
import { NextResponse } from "next/server";
import crypto from "node:crypto";

export const dynamic = "force-dynamic";

const SSO_SECRET = process.env.SSO_SECRET || "";
const SESSION_SECRET = process.env.SESSION_SECRET || "dev-inseguro-troque-em-producao";
const COOKIE = "docepao_sessao";

function assinar(payload: string, secret: string): string {
  const mac = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${mac}`;
}
function verificar(token: string, secret: string): Record<string, unknown> | null {
  const i = token.lastIndexOf(".");
  if (i < 0) return null;
  const payload = token.slice(0, i);
  const mac = token.slice(i + 1);
  const esperado = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  if (mac.length !== esperado.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(esperado))) return null;
  try { return JSON.parse(Buffer.from(payload, "base64url").toString()); } catch { return null; }
}

export async function GET(req: Request) {
  const t = new URL(req.url).searchParams.get("t") || "";
  const data = SSO_SECRET ? verificar(t, SSO_SECRET) : null;
  const exp = data && typeof data.exp === "number" ? data.exp : 0;
  if (!data || !data.negocioId || !data.userId || (exp && Date.now() > exp)) {
    return new NextResponse(null, { status: 303, headers: { Location: "/login" } });
  }
  const sessao = { negocioId: data.negocioId, userId: data.userId, nome: data.nome || "", papel: data.papel || "dono" };
  const cookieVal = assinar(Buffer.from(JSON.stringify(sessao)).toString("base64url"), SESSION_SECRET);
  const res = new NextResponse(null, { status: 303, headers: { Location: "/" } });
  res.cookies.set(COOKIE, cookieVal, { httpOnly: true, sameSite: "none", secure: true, path: "/", maxAge: 60 * 60 * 24 * 30 });
  return res;
}
