// OS CAMPOS DO PERFIL DO WHATSAPP, sem nada que fale com o banco.
//
// A tela de Configuracoes precisa do tipo e da lista de categorias, e o
// `perfil.ts` fala com o banco pra pegar as credenciais. Importar de la a
// partir de um componente de cliente arrastava `lib/banco/negocios` e o driver
// `pg` inteiro pro bundle do navegador: o `next build` reprovava com
// module-not-found, e o portao nao pegava porque ele confere TIPO, e isto e
// empacotamento.
//
// Aqui nao ha import nenhum, entao os dois lados leem a mesma lista sem que o
// servidor vaze pro navegador.

export interface PerfilWhatsapp {
  about: string;
  description: string;
  address: string;
  email: string;
  website: string;
  vertical: string;
  fotoUrl: string | null;
}

// Categorias aceitas pela Meta. A lista é fechada — mandar outra coisa dá erro.
export const CATEGORIAS: { valor: string; rotulo: string }[] = [
  { valor: "UNDEFINED", rotulo: "Não definida" },
  { valor: "OTHER", rotulo: "Outro" },
  { valor: "AUTO", rotulo: "Automotivo" },
  { valor: "BEAUTY", rotulo: "Beleza e estética" },
  { valor: "APPAREL", rotulo: "Roupas e acessórios" },
  { valor: "EDU", rotulo: "Educação" },
  { valor: "ENTERTAIN", rotulo: "Entretenimento" },
  { valor: "EVENT_PLAN", rotulo: "Eventos" },
  { valor: "FINANCE", rotulo: "Finanças" },
  { valor: "GROCERY", rotulo: "Mercado e alimentos" },
  { valor: "GOVT", rotulo: "Governo" },
  { valor: "HOTEL", rotulo: "Hotelaria" },
  { valor: "HEALTH", rotulo: "Saúde" },
  { valor: "NONPROFIT", rotulo: "Sem fins lucrativos" },
  { valor: "PROF_SERVICES", rotulo: "Serviços profissionais" },
  { valor: "RETAIL", rotulo: "Varejo" },
  { valor: "RESTAURANT", rotulo: "Restaurante / padaria" },
  { valor: "TRAVEL", rotulo: "Viagens" },
];
