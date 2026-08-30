// O cardapio em forma de lista, pro painel oferecer produto e sabor prontos.
//
// A montagem mora em `lib/cardapio-opcoes.ts` pra poder ser MEDIDA: dentro do
// route handler ela nao era exportavel, e teste que nao roda a coisa real acaba
// medindo uma reconstrucao (foi o que quase me fez reportar um defeito que nao
// existia).
import { OPCOES, CORES_DE_FORMINHA } from "@/lib/cardapio-opcoes";

export const dynamic = "force-static";

export async function GET() {
  // As cores vao junto com os produtos porque quem precisa das duas e a mesma
  // tela, na mesma abertura. Duas rotas seriam duas idas pro mesmo cardapio.
  return Response.json({ produtos: OPCOES, cores: CORES_DE_FORMINHA });
}
