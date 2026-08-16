"use client";

// ============================================================================
//  CAMPO DE TELEFONE (WhatsApp) — máscara brasileira + normalização única.
//
//  Padrão de ENTRADA em TODO o painel. Prefixo fixo "+55" (visual, não editável)
//  e o usuário digita só o número nacional: (DD) 9XXXX-XXXX = 11 dígitos.
//
//  - Aceita SÓ dígitos (ignora letras/símbolos) e LIMITA a 11 dígitos nacionais.
//  - Ao COLAR (com +55, espaços, traços, parênteses), limpa tudo e formata; se
//    veio com o código do país 55 na frente, remove antes de aplicar o limite.
//  - onChange devolve o valor NORMALIZADO pro backend no MESMO formato que o
//    código já usa (formatarTelefoneBR / linkWhatsapp / normalizarBR da Cloud
//    API): "55" + 11 dígitos = 13 dígitos (E.164 sem o "+"), ex "5549999999999".
//    Vazio -> "".
// ============================================================================

import { useState } from "react";

// national = só os 11 dígitos nacionais (DDD + número), sem o 55.

// Extrai os dígitos nacionais de um valor normalizado ("55"+national) OU cru.
// Regra usada tanto na digitação quanto na colagem: se depois de limpar sobrar
// mais de 11 dígitos E começar com 55, é porque veio o código do país -> tira.
function nacionalDe(entrada: string): string {
  let d = (entrada || "").replace(/\D/g, "");
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  return d.slice(0, 11);
}

// Formata os dígitos nacionais progressivamente: (49) 99999-9999.
function mascarar(nacional: string): string {
  const d = nacional.slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  let s = `(${d.slice(0, 2)}) ${d.slice(2, 7)}`;
  if (d.length > 7) s += `-${d.slice(7)}`;
  return s;
}

// ---- Helpers exportados (o formulário pai usa pra validar/normalizar) ----

// Valor pronto pro backend: "55"+11 dígitos, ou "" quando não há número.
export function normalizarTelefone(entrada: string): string {
  const nac = nacionalDe(entrada);
  return nac ? "55" + nac : "";
}

// true quando o número nacional está completo (11 dígitos: DDD + 9 + 8).
export function telefoneCompleto(valor: string): boolean {
  return nacionalDe(valor).length === 11;
}

export type CampoTelefoneProps = {
  value: string; // valor normalizado ("55"+national) ou "" ou cru (será normalizado)
  onChange: (valorNormalizado: string) => void;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string; // classes extras no wrapper
  // Esconde o aviso interno de "número incompleto" (o pai pode tratar sozinho).
  semAviso?: boolean;
};

export default function CampoTelefone({
  value,
  onChange,
  id,
  placeholder = "(49) 99999-9999",
  disabled,
  autoFocus,
  className = "",
  semAviso,
}: CampoTelefoneProps) {
  const [tocado, setTocado] = useState(false);
  const nacional = nacionalDe(value);
  const completo = nacional.length === 11;
  const incompleto = nacional.length > 0 && !completo;
  const erro = tocado && incompleto;

  function aoDigitar(bruto: string) {
    const nac = nacionalDe(bruto);
    onChange(nac ? "55" + nac : "");
  }

  return (
    <div className={className}>
      <div
        className={
          "flex items-center gap-2 rounded-[10px] bg-white/10 px-3 transition-colors " +
          (erro
            ? "ring-2 ring-[#e0574c]/60 border border-[#e0574c]/40"
            : "border border-transparent focus-within:ring-2 focus-within:ring-cobre/30")
        }
      >
        <span
          className="select-none text-[13.5px] font-medium text-cream/55"
          aria-hidden="true"
        >
          +55
        </span>
        <span className="h-5 w-px bg-white/15" aria-hidden="true" />
        <input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          value={mascarar(nacional)}
          onChange={(e) => aoDigitar(e.target.value)}
          onBlur={() => setTocado(true)}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          aria-invalid={erro || undefined}
          className="min-w-0 flex-1 bg-transparent py-2.5 text-[13.5px] text-cream placeholder:text-cream/40 focus:outline-none disabled:opacity-50"
        />
      </div>
      {!semAviso && erro && (
        <p className="mt-1 text-[11.5px] text-[#e8897f]">
          Número incompleto — precisa de DDD + 9 dígitos.
        </p>
      )}
    </div>
  );
}
