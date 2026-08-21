// ============================================================================
//  OS REPORTES DA EQUIPE, NA TELA DE QUEM CUIDA DO SISTEMA.
//
//  O botao Reportar existe porque a IA nao melhora sozinha: alguem precisa
//  saber que ela falou besteira. So que ate 20/08/2026 o reporte gravava no
//  banco e NENHUMA tela lia. O botao que existe pra tornar o problema visivel
//  estava tornando ele invisivel.
//
//  O aviso no WhatsApp depende do ADMIN_WHATSAPP estar configurado e da janela
//  de 24h da Meta. Esta tela nao depende de nada disso: o reporte esta gravado,
//  entao esta aqui.
//
//  So o OWNER ve. A dona nao precisa de mais uma tela, e reporte e conversa
//  entre a equipe dela e quem mantem o sistema.
// ============================================================================
import { lerSessao } from "@/lib/auth";
import { bancoConfigurado } from "@/lib/banco/db";

export const dynamic = "force-dynamic";

type Linha = {
  id: string;
  o_que: string;
  quem: string | null;
  criado_em: string;
  resolvido: boolean | null;
  cliente_nome: string | null;
  telefone: string | null;
};

export default async function Page() {
  const sessao = await lerSessao();
  if (!sessao) return null;
  if (sessao.papel !== "owner") {
    return (
      <div className="p-6 text-cream/70 text-sm">
        Esta tela é de quem mantém o sistema.
      </div>
    );
  }

  let linhas: Linha[] = [];
  if (bancoConfigurado) {
    const { query } = await import("@/lib/banco/db");
    linhas = await query<Linha>(
      `select r.id, r.o_que, r.quem, r.criado_em, r.resolvido,
              c.nome as cliente_nome, c.telefone
         from reportes r
         left join clientes c on c.id = r.cliente_id
        where r.negocio_id = $1
        order by r.criado_em desc
        limit 100`,
      [sessao.negocioId],
    ).catch(() => []);
  }

  const quando = (t: string) =>
    new Date(t).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-cream text-lg font-semibold">Reportes da equipe</h1>
      <p className="text-cream/55 text-[13px] mt-1 leading-snug">
        O que a equipe da padaria marcou como besteira da Dora. Chega aqui mesmo
        sem WhatsApp configurado, porque o reporte fica gravado.
      </p>

      {linhas.length === 0 ? (
        <p className="text-cream/45 text-sm mt-6">
          Nenhum reporte até agora. Quando a equipe clicar em Reportar numa
          conversa, ele aparece aqui.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {linhas.map((l) => (
            <li key={l.id} className="rounded-[12px] px-3 py-2.5" style={{ background: "rgba(255,255,255,0.04)" }}>
              <div className="text-cream/45 text-[11px]">
                {quando(l.criado_em)}
                {l.quem ? " · " + l.quem : ""}
                {l.cliente_nome ? " · sobre " + l.cliente_nome : ""}
                {l.telefone ? " (" + l.telefone + ")" : ""}
              </div>
              <div className="text-cream text-[13px] leading-snug mt-1 whitespace-pre-wrap">{l.o_que}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
