// ============================================================================
//  CONEXÃO COM O POSTGRES (Supabase gerenciado) — driver pg, pool reaproveitado.
//
//  O app conecta como UM usuário do banco. O isolamento entre clientes
//  (multi-tenant) é feito no código: TODA query filtra por negocio_id.
//
//  ⚠️ NO VERCEL (serverless) use a string do CONNECTION POOLER do Supabase
//  (porta 6543, modo "Transaction"), NÃO a conexão direta (5432). O pooler
//  aguenta as muitas conexões curtas do serverless; a direta estoura.
//  Ex: DATABASE_URL=postgres://postgres.xxxx:senha@aws-0-...pooler.supabase.com:6543/postgres
// ============================================================================

import { Pool, types, type QueryResultRow } from "pg";

// ⚠️ IMPORTANTE: por padrão o pg converte date/timestamp em objeto Date do JS.
// O painel trata data como TEXTO ("YYYY-MM-DD") e faz .split()/.slice() nela.
// Então forçamos date/timestamp a virem como STRING crua (evita "e.split is not
// a function" ao renderizar pedidos reais).
types.setTypeParser(1082, (v) => v); // date        -> "2026-07-28"
types.setTypeParser(1114, (v) => v); // timestamp   -> string crua
types.setTypeParser(1184, (v) => v); // timestamptz -> string crua

// Está configurado? (o painel cai no mock se não houver banco — bom pra demo.)
export const bancoConfigurado = Boolean(
  process.env.DATABASE_URL || process.env.PGHOST || process.env.PGDATABASE,
);

// Um pool por processo. Reusado entre requisições (Next mantém o módulo vivo).
declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

function criarPool(): Pool {
  const cfg = process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {}; // pega PGHOST/PGPORT/... do ambiente automaticamente
  // Supabase exige SSL. PGSSL=0 desliga (só pra Postgres local sem SSL).
  const ssl = process.env.PGSSL === "0" ? undefined : { rejectUnauthorized: false };
  // Quantas conexões este container pode abrir.
  //
  // Eram 3, herdado de quando isso rodava serverless: lá cada instância tem o
  // próprio pool e quem agrega é o pooler do provedor. Aqui é um container só
  // numa VPS dedicada, e a tela da dona chama quatro rotas em ciclo (aprovação
  // a cada 5s, contagem a cada 7s, dia e aguardando a cada 8s), cada uma com
  // várias subconsultas. Duas abas abertas já pediam mais de três conexões ao
  // mesmo tempo: a requisição ficava na fila, o proxy cansava antes e devolvia
  // 504, que na tela vira a fila piscando erro sozinha.
  const max = Number(process.env.PG_POOL_MAX || 10);
  const p = new Pool({
    ...cfg,
    ssl,
    max,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000, // não fica pendurado esperando conexão do pool
    allowExitOnIdle: true,
  } as never);
  // Conexão OCIOSA que cai (o pooler do Supabase recicla, restart, etc.) emite
  // 'error' no pool. Sem este listener, o pg joga a exceção como não tratada e
  // pode DERRUBAR a instância inteira (mata todas as requisições em voo).
  p.on("error", (e) => console.error("[pg] erro em conexão ociosa do pool:", e.message));
  return p;
}

export function pool(): Pool {
  if (!bancoConfigurado) {
    throw new Error("Banco não configurado: defina DATABASE_URL (ou PGHOST/PGDATABASE) no .env");
  }
  if (!global.__pgPool) global.__pgPool = criarPool();
  return global.__pgPool;
}

// Atalho de query tipada. Uso: const linhas = await query<Tipo>('select ...', [x])
export async function query<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const r = await pool().query<T>(sql, params as never[]);
  return r.rows;
}

// Query que espera 0 ou 1 linha.
export async function queryUm<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<T | null> {
  const linhas = await query<T>(sql, params);
  return linhas[0] ?? null;
}

// Função de query dentro de uma transação (mesma assinatura do query() global).
export type QueryFn = <T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params?: unknown[],
) => Promise<T[]>;

// Roda várias queries numa TRANSAÇÃO (tudo ou nada). Uma conexão só, com
// begin/commit; se algo lançar, faz rollback. Uso:
//   await transacao(async (q) => { await q("insert ..."); await q("insert ..."); });
export async function transacao<T>(fn: (q: QueryFn) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query("begin");
    const q: QueryFn = async (sql, params = []) => {
      const r = await client.query(sql, params as never[]);
      return r.rows as never;
    };
    const out = await fn(q);
    await client.query("commit");
    return out;
  } catch (e) {
    try {
      await client.query("rollback");
    } catch {
      // se o rollback falhar, a conexão será descartada no release
    }
    throw e;
  } finally {
    client.release();
  }
}
