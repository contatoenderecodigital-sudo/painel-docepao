// ⚠️ ROTA DE PREVIEW — só pra iterar o design sem login/banco. Apagar depois.
import Atendimentos from "@/components/Atendimentos";
import { CONVERSAS_MOCK } from "@/lib/mock";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <div className="min-h-screen bg-cream">
      <Atendimentos conversas={CONVERSAS_MOCK} />
    </div>
  );
}
