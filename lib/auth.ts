// ============================================================================
//  LOGIN DO PAINEL — sessão própria, sem serviço externo.
//  Senha guardada como hash bcrypt no banco (tabela usuarios).
//  Sessão = cookie assinado com HMAC (não dá pra forjar sem o SESSION_SECRET).
//
//  Fluxo: autenticar(email, senha) -> criarSessao (Server Action seta o cookie)
//         lerSessao() em qualquer Server Component pra saber quem está logado.
// ============================================================================

import { cookies } from "next/headers";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { queryUm } from "./banco/db";

const COOKIE = "docepao_sessao";
const SEGREDO = process.env.SESSION_SECRET || "dev-inseguro-troque-em-producao";
const DIAS = 30;

export type Sessao = { negocioId: string; userId: string; nome: string; papel: string };

// --- assinatura do cookie (payload.assinatura) ---
function assinar(payload: string): string {
  const mac = crypto.createHmac("sha256", SEGREDO).update(payload).digest("base64url");
  return `${payload}.${mac}`;
}
function verificar(token: string): Sessao | null {
  const i = token.lastIndexOf(".");
  if (i < 0) return null;
  const payload = token.slice(0, i);
  const mac = token.slice(i + 1);
  const esperado = crypto.createHmac("sha256", SEGREDO).update(payload).digest("base64url");
  // comparação em tempo constante (evita timing attack)
  if (mac.length !== esperado.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(esperado)))
    return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString()) as Sessao;
  } catch {
    return null;
  }
}

// Confere email + senha contra o banco. Retorna a sessão ou null.
export async function autenticar(email: string, senha: string): Promise<Sessao | null> {
  const u = await queryUm<{ id: string; negocio_id: string; nome: string | null; papel: string; senha_hash: string }>(
    "select id, negocio_id, nome, papel, senha_hash from usuarios where email = $1",
    [email.trim().toLowerCase()],
  );
  if (!u) return null;
  const ok = await bcrypt.compare(senha, u.senha_hash);
  if (!ok) return null;
  return { negocioId: u.negocio_id, userId: u.id, nome: u.nome || "Equipe", papel: u.papel };
}

// Seta o cookie de sessão (chamar dentro de Server Action / Route Handler).
export async function criarSessao(s: Sessao): Promise<void> {
  const payload = Buffer.from(JSON.stringify(s)).toString("base64url");
  const jar = await cookies();
  jar.set(COOKIE, assinar(payload), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DIAS * 24 * 60 * 60,
  });
}

export async function encerrarSessao(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

// Lê a sessão atual (ou null). Use em Server Components pra proteger telas.
export async function lerSessao(): Promise<Sessao | null> {
  const jar = await cookies();
  const tok = jar.get(COOKIE)?.value;
  return tok ? verificar(tok) : null;
}
