// COMO SE ACHA UM CLIENTE NA BUSCA DO CRM, NUM LUGAR SO.
//
// POR QUE ISTO SAIU DE DENTRO DA TELA
//
// A ficha mostra o telefone formatado, "+55 (49) 99999-9999", e a busca
// comparava contra o telefone CRU do banco, "5549999999999". Entao procurar o
// cliente pelo numero escrito ali em cima, ou pelo numero que ele dita no
// balcao com traco e parenteses, nao achava ninguem.
//
// Enquanto a regra morava dentro do `useMemo` do componente, nao dava pra medir
// sem subir a tela inteira. Aqui da, e o teste
// `a-busca-do-cliente-acha-o-numero-da-tela.cjs` mede.
//
// A REGRA
//
// Quem digita letra esta procurando nome. Quem digita numero esta procurando
// telefone, e nao deveria precisar saber em que formato o banco guardou. Entao,
// quando a busca tem digito, os dois lados viram so digitos antes de comparar,
// e o 55 do pais sai fora dos dois: ninguem procura um cliente pelo codigo do
// Brasil.

export type ClienteBuscavel = { nome: string; telefone: string };

const soDigitos = (s: string) => s.replace(/\D/g, "");
const semPais = (s: string) => (s.startsWith("55") ? s.slice(2) : s);

export function clienteBateNaBusca(c: ClienteBuscavel, busca: string): boolean {
  const t = busca.trim().toLowerCase();
  if (!t) return true;

  // O jeito antigo continua valendo: acha por nome, e tambem por quem colar o
  // numero cru vindo de outro lugar do painel.
  if ((c.nome + " " + c.telefone).toLowerCase().includes(t)) return true;

  const digitosDaBusca = semPais(soDigitos(t));
  if (!digitosDaBusca) return false;
  return semPais(soDigitos(c.telefone)).includes(digitosDaBusca);
}

export function filtrarClientes<T extends ClienteBuscavel>(clientes: T[], busca: string): T[] {
  if (!busca.trim()) return clientes;
  return clientes.filter((c) => clienteBateNaBusca(c, busca));
}
