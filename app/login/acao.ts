"use server";

// Ações de login/logout do painel. Rodam no servidor.

import { redirect } from "next/navigation";
import { autenticar, criarSessao, encerrarSessao } from "@/lib/auth";

export async function entrar(_prev: string | null, form: FormData): Promise<string | null> {
  const email = String(form.get("email") || "");
  const senha = String(form.get("senha") || "");
  const s = await autenticar(email, senha);
  if (!s) return "E-mail ou senha incorretos.";
  await criarSessao(s);
  redirect("/");
}

export async function sair(): Promise<void> {
  await encerrarSessao();
  redirect("/login");
}
