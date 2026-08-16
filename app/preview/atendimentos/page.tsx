// ATENCAO: ROTA DE PREVIEW, só pra iterar o design sem login/banco. Apagar depois.
import Atendimentos from "@/components/Atendimentos";
import { CONVERSAS_MOCK } from "@/lib/mock";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    // mesmo fundo do painel real (app-mesh + text-cream). Antes era bg-cream,
    // então o texto creme dos componentes sumia e o preview mentia sobre o
    // contraste real da tela.
    <div className="min-h-screen app-mesh text-cream">
      <Atendimentos conversas={CONVERSAS_MOCK} />
    </div>
  );
}
