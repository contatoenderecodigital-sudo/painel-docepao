// Perfil comercial do WhatsApp — o que o cliente vê ao tocar no nome do contato.
//
// Migrar pro Cloud API tira o aplicativo do celular, e com ele some o lugar
// onde a dona editava esses dados. O caminho oficial passa a ser o WhatsApp
// Manager da Meta: painel técnico, cheio de coisa que ela pode quebrar sem
// querer. Por isso o perfil é editado aqui dentro.
//
// Campos (nomes da API, mantidos como a Meta chama):
//   about       o "recado" curto embaixo do nome (139 caracteres)
//   description texto maior de apresentação (512)
//   vertical    categoria do negócio, de uma lista fechada da Meta
//   address, email, websites  o resto da ficha
//
// A FOTO não entra aqui: ela exige um upload em duas etapas (sessão + binário)
// contra o id do app, que este painel não conhece. Fica pro WhatsApp Manager
// até a gente trazer o id do app pra cá.

import { carregarCredsWhatsapp } from "@/lib/banco/negocios";

const BASE = "https://graph.facebook.com/v21.0";

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

const VAZIO: PerfilWhatsapp = {
  about: "",
  description: "",
  address: "",
  email: "",
  website: "",
  vertical: "UNDEFINED",
  fotoUrl: null,
};

export async function lerPerfil(negocioId: string): Promise<{ perfil: PerfilWhatsapp; erro: string | null }> {
  const { token, phoneId } = await carregarCredsWhatsapp(negocioId);
  if (!token || !phoneId) return { perfil: VAZIO, erro: "sem_conexao" };

  const campos = "about,address,description,email,profile_picture_url,websites,vertical";
  try {
    const r = await fetch(`${BASE}/${phoneId}/whatsapp_business_profile?fields=${campos}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const j = (await r.json()) as {
      data?: {
        about?: string;
        address?: string;
        description?: string;
        email?: string;
        profile_picture_url?: string;
        websites?: string[];
        vertical?: string;
      }[];
      error?: { message?: string };
    };
    if (!r.ok) return { perfil: VAZIO, erro: j.error?.message || `HTTP ${r.status}` };
    const d = j.data?.[0] ?? {};
    return {
      perfil: {
        about: d.about ?? "",
        description: d.description ?? "",
        address: d.address ?? "",
        email: d.email ?? "",
        website: d.websites?.[0] ?? "",
        vertical: d.vertical ?? "UNDEFINED",
        fotoUrl: d.profile_picture_url ?? null,
      },
      erro: null,
    };
  } catch (e) {
    return { perfil: VAZIO, erro: String(e).slice(0, 160) };
  }
}

export async function salvarPerfil(
  negocioId: string,
  p: Partial<PerfilWhatsapp>
): Promise<{ ok: boolean; erro: string | null }> {
  const { token, phoneId } = await carregarCredsWhatsapp(negocioId);
  if (!token || !phoneId) return { ok: false, erro: "Nenhum número conectado ainda." };

  // Só manda o que veio preenchido: campo vazio no formulário não deve apagar
  // o que já está lá por acidente.
  const corpo: Record<string, unknown> = { messaging_product: "whatsapp" };
  if (p.about !== undefined) corpo.about = p.about.slice(0, 139);
  if (p.description !== undefined) corpo.description = p.description.slice(0, 512);
  if (p.address !== undefined) corpo.address = p.address.slice(0, 256);
  if (p.email !== undefined) corpo.email = p.email.slice(0, 128);
  if (p.vertical !== undefined) corpo.vertical = p.vertical;
  if (p.website !== undefined) corpo.websites = p.website ? [p.website] : [];

  try {
    const r = await fetch(`${BASE}/${phoneId}/whatsapp_business_profile`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { error?: { message?: string } };
      return { ok: false, erro: j.error?.message || `A Meta recusou (HTTP ${r.status}).` };
    }
    return { ok: true, erro: null };
  } catch (e) {
    return { ok: false, erro: String(e).slice(0, 160) };
  }
}
