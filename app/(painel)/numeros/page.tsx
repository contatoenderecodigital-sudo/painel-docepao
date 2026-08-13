import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// Rota antiga: virou /resultados. Redireciona pra não quebrar links antigos.
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") qs.set(k, v);
  }
  const s = qs.toString();
  redirect("/resultados" + (s ? `?${s}` : ""));
}
