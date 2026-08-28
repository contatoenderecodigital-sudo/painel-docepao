// SSO: o hub (console) manda um token assinado com SSO_SECRET contendo só o
// negocioId; o painel resolve o usuário (dono) daquele negócio e loga a sessão
// automaticamente (sem login separado). Usado no iframe do MODO OWNER.
import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { queryUm } from "@/lib/banco/db";

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
  // TOKEN SEM VALIDADE E RECUSADO, E NAO ACEITO PRA SEMPRE.
  //
  // Aqui estava `(exp && Date.now() > exp)`: quando o token nao trazia `exp`, o
  // valor caia pra 0, o `(exp && ...)` era falsy, e o token PASSAVA. Um link de
  // SSO sem validade valeria pra sempre, e ele viaja na URL, que vai pro
  // historico do navegador, pro log do proxy e pro cabecalho Referer.
  //
  // O hub sempre emite com 5 minutos (`app/ws/[neg]/page.tsx`), entao ninguem
  // estava exposto hoje. Mas a guarda estava escrita pra ACEITAR o token mais
  // fraco possivel, que e a mesma forma de erro das dezesseis rotas sem login:
  // um `if` que parece guarda e nao dispara nunca.
  //
  // Agora falha fechado: sem `exp` numerico e valido, nao entra.
  //
  // Achado na leitura do `app/`, 28/08/2026.
  const exp = data && typeof data.exp === "number" ? data.exp : 0;
  const negocioId = data && typeof data.negocioId === "string" ? data.negocioId : "";
  if (!data || !negocioId || !exp || Date.now() > exp) {
    return new NextResponse(null, { status: 303, headers: { Location: "/login" } });
  }
  // resolve o dono do negócio na gaveta
  const u = await queryUm<{ id: string; nome: string | null; papel: string }>(
    "select id, nome, papel from usuarios where negocio_id = $1 order by (papel = 'dono') desc limit 1",
    [negocioId],
  );
  if (!u) return new NextResponse(null, { status: 303, headers: { Location: "/login" } });

  const sessao = { negocioId, userId: u.id, nome: u.nome || "", papel: u.papel || "dono" };
  const cookieVal = assinar(Buffer.from(JSON.stringify(sessao)).toString("base64url"), SESSION_SECRET);
  const res = new NextResponse(null, { status: 303, headers: { Location: "/" } });
  res.cookies.set(COOKIE, cookieVal, { httpOnly: true, sameSite: "none", secure: true, path: "/", maxAge: 60 * 60 * 24 * 30 });
  return res;
}
