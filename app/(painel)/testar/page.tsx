"use client";

// ============================================================================
//  CHAT DE TESTE — o dono conversa com a IA no navegador, sem precisar do
//  WhatsApp, pra validar se a IA fecha o pedido sozinha. Usa o cérebro REAL
//  (rota /api/testar-ia -> responder() da produção). Se a IA fechar o pedido,
//  ele cai na Fila de Aprovação de verdade.
// ============================================================================

import { useEffect, useRef, useState } from "react";
import { Bot, SendHorizontal, Trash2, Info, User, Paperclip, X } from "lucide-react";

type Msg = { de: "cliente" | "ia"; texto: string; imagem?: string };
type BotaoDaFala = { id: string; titulo: string };

export default function TestarIA() {
  const [mensagens, setMensagens] = useState<Msg[]>([]);
  const [texto, setTexto] = useState("");
  const [digitando, setDigitando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Os mesmos botoes que o WhatsApp mostraria. Sem eles a tela de teste nao
  // exercita metade da conversa (pagamento, fechar, base da festa).
  const [botoes, setBotoes] = useState<BotaoDaFala[]>([]);
  // Foto de referência anexada à PRÓXIMA mensagem (data URL pra preview + envio).
  const [anexo, setAnexo] = useState<{ dataUrl: string; mime: string } | null>(null);
  // LIMPAR A TELA TEM QUE LIMPAR O BANCO TAMBEM.
  //
  // O botao zerava so o React. A montagem e o pedido da conversa anterior
  // ficavam no banco, e o cerebro LE do banco: o dono via a tela vazia e a IA
  // continuava com o pedido velho montado.
  //
  // A rota ja sabe limpar (`reiniciar: true`), e so as baterias automatizadas
  // mandavam esse sinal. A tela nunca mandou.
  //
  // O sinal viaja com a PROXIMA mensagem porque a rota recusa corpo sem
  // mensagem antes de chegar no trecho que limpa. E o mesmo jeito que o
  // `qa-painel.cjs` e o `qa-conversa.cjs` ja usam.
  //
  // Achado na leitura do `app/`, 28/08/2026.
  const [precisaReiniciar, setPrecisaReiniciar] = useState(false);
  const fim = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fim.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [mensagens.length, digitando]);

  function usarArquivo(file: File | null | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErro("Anexe uma imagem (a foto de referência do bolo, por exemplo).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAnexo({ dataUrl: String(reader.result), mime: file.type });
    reader.onerror = () => setErro("Não consegui ler essa imagem. Tente outra.");
    reader.readAsDataURL(file);
  }
  function escolherArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    usarArquivo(e.target.files?.[0]);
    e.target.value = ""; // permite reanexar o mesmo arquivo depois
  }
  // Colar (Ctrl+V) uma imagem — funciona mesmo se o navegador bloquear o diálogo de arquivo.
  function colarImagem(e: React.ClipboardEvent) {
    const item = Array.from(e.clipboardData?.items || []).find((i) => i.type.startsWith("image/"));
    if (item) usarArquivo(item.getAsFile());
  }
  // Arrastar a imagem pra dentro do chat.
  function soltarImagem(e: React.DragEvent) {
    e.preventDefault();
    usarArquivo(e.dataTransfer?.files?.[0]);
  }

  async function enviar(toque?: BotaoDaFala) {
    const t = toque ? String(toque.titulo || toque.id) : texto.trim();
    if ((!t && !anexo && !toque) || digitando) return;
    setErro(null);

    // Conversa completa (incluindo a nova mensagem) vai pro cerebro real, igual
    // ao webhook: a ultima mensagem e a pergunta nova do cliente.
    const conversa: Msg[] = [...mensagens, { de: "cliente", texto: t, imagem: anexo?.dataUrl }];
    setMensagens(conversa);
    setTexto("");
    setBotoes([]);
    const anexoEnviar = anexo;
    setAnexo(null);
    setDigitando(true);
    // O sinal vale por uma mensagem so: depois dela a conversa e a de agora.
    const reiniciarAgora = precisaReiniciar;
    setPrecisaReiniciar(false);

    try {
      const r = await fetch("/api/testar-ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mensagens: conversa.map((m) => ({ de: m.de, texto: m.texto })),
          imagem: anexoEnviar?.dataUrl,
          imagemMime: anexoEnviar?.mime,
          reiniciar: reiniciarAgora,
          botaoId: toque ? toque.id : null,
        }),
      });
      const dados = await r.json().catch(() => ({}));
      if (r.status === 401) {
        setErro("Sua sessão expirou. Recarregue a página e entre de novo.");
      } else if (dados.erro) {
        setErro(dados.erro);
      } else if (dados.resposta) {
        // texto + as peças de cardápio que a IA mandou (uma mensagem por imagem,
        // igual chega no WhatsApp do cliente).
        const extras: Msg[] = ((dados.cardapios as string[] | undefined) ?? []).map((url) => ({
          de: "ia" as const,
          texto: "",
          imagem: url,
        }));
        setMensagens((m) => [...m, { de: "ia", texto: dados.resposta }, ...extras]);
        const daFala = Array.isArray(dados.botoes) ? dados.botoes : [];
        setBotoes(
          daFala
            .filter((b: BotaoDaFala) => b && typeof b.id === "string" && typeof b.titulo === "string")
            .slice(0, 3),
        );
        if (dados.aviso) setErro(dados.aviso);
      } else {
        setErro("A IA não devolveu resposta. Tente de novo.");
      }
    } catch {
      setErro("Falha de conexão ao falar com a IA. Tente de novo.");
    } finally {
      setDigitando(false);
    }
  }

  function limpar() {
    setMensagens([]);
    setErro(null);
    setTexto("");
    setAnexo(null);
    setBotoes([]);
    // E o banco tambem, na proxima mensagem: sem isto o pedido da conversa
    // anterior continua montado e a IA responde em cima dele.
    setPrecisaReiniciar(true);
  }

  return (
    <div className="px-6 py-6 h-screen flex flex-col" onDrop={soltarImagem} onDragOver={(e) => e.preventDefault()}>
      {/* cabeçalho */}
      <div className="flex items-center justify-between gap-3 mb-3 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-[0.2em] text-dourado font-semibold">
            Chat de teste
          </span>
        </div>
        {mensagens.length > 0 && (
          <button
            onClick={limpar}
            className="press inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-full border border-white/15 text-cream/70 hover:text-cream hover:bg-white/10 transition-colors"
          >
            <Trash2 size={13} /> Limpar conversa
          </button>
        )}
      </div>

      {/* aviso discreto */}
      <div
        className="shrink-0 mb-3 rounded-[12px] px-4 py-2.5 flex items-start gap-2.5 text-[12.5px] leading-relaxed"
        style={{ background: "rgba(224,138,60,0.10)", border: "1px solid rgba(224,138,60,0.22)" }}
      >
        <Info size={15} className="shrink-0 mt-0.5" style={{ color: "var(--brand-cobre-l)" }} />
        <div className="text-cream/80">
          Este chat usa a mesma IA que atende no WhatsApp. Se o pedido fechar (pelo botao de
          confirmar, nunca sozinho), ele cai na Fila de Aprovacao, do mesmo jeito que aconteceria
          com um cliente de verdade.
        </div>
      </div>

      {/* janela do chat */}
      <div className="glass rounded-[20px] flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-8 py-5">
          {mensagens.length === 0 && !digitando ? (
            <div className="h-full grid place-items-center text-center">
              <div>
                <div
                  className="mx-auto w-14 h-14 rounded-2xl grid place-items-center mb-3 grad-cobre text-vinho-d"
                >
                  <Bot size={26} />
                </div>
                <div className="tracking-tight-apple text-xl font-bold text-cream">
                  Converse como se fosse um cliente
                </div>
                <p className="text-sm text-cream/60 mt-1 max-w-sm mx-auto">
                  Escreva uma mensagem abaixo (ex: &quot;quero 100 salgados pra sábado&quot;) e veja
                  se a IA atende. Fechar o pedido e o botao da equipe no painel.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col max-w-3xl mx-auto">
              {mensagens.map((m, i) => {
                const isCliente = m.de === "cliente";
                return (
                  <div
                    key={i}
                    className={"flex items-end gap-2.5 mt-3 " + (isCliente ? "justify-end" : "justify-start")}
                  >
                    {!isCliente && (
                      <div className="shrink-0 grid place-items-center text-vinho-d grad-cobre" style={{ width: 34, height: 34, borderRadius: 10 }}>
                        <Bot size={19} />
                      </div>
                    )}
                    <div className="max-w-[72%]">
                      <div
                        className={
                          "rounded-[14px] px-3.5 py-2 text-[13.5px] leading-[1.5] whitespace-pre-line " +
                          (isCliente ? "text-white rounded-br-[4px]" : "text-[#4a1020] rounded-bl-[4px]")
                        }
                        style={
                          isCliente
                            ? { background: "linear-gradient(135deg,#96741a,#e7cf94)", boxShadow: "0 4px 14px rgba(187,146,31,0.28)" }
                            : { background: "rgba(255,255,255,0.92)", boxShadow: "0 3px 12px rgba(0,0,0,0.16)" }
                        }
                      >
                        {m.imagem && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={m.imagem}
                            alt="Foto de referência anexada"
                            className="rounded-[10px] mb-1.5 max-h-44 w-auto object-cover block"
                          />
                        )}
                        {m.texto}
                      </div>
                    </div>
                    {isCliente && (
                      <div className="shrink-0 grid place-items-center text-white" style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#6e1f30,#491020)" }}>
                        <User size={18} />
                      </div>
                    )}
                  </div>
                );
              })}

              {digitando && (
                <div className="flex items-end gap-2.5 mt-3 justify-start">
                  <div className="shrink-0 grid place-items-center text-vinho-d grad-cobre" style={{ width: 34, height: 34, borderRadius: 10 }}>
                    <Bot size={19} />
                  </div>
                  <div
                    className="rounded-[14px] rounded-bl-[4px] px-4 py-3 flex items-center gap-1.5"
                    style={{ background: "rgba(255,255,255,0.92)", boxShadow: "0 3px 12px rgba(0,0,0,0.16)" }}
                  >
                    <span className="sr-only">IA digitando</span>
                    {[0, 1, 2].map((n) => (
                      <span
                        key={n}
                        className="w-1.5 h-1.5 rounded-full bg-[#96741a]/60 animate-bounce"
                        style={{ animationDelay: `${n * 0.15}s` }}
                      />
                    ))}
                  </div>
                </div>
              )}
              <div ref={fim} />
            </div>
          )}
        </div>

        {botoes.length > 0 && !digitando && (
          <div className="px-4 pb-2 flex flex-wrap gap-2 justify-center">
            {botoes.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => enviar(b)}
                className="press rounded-full px-3.5 py-1.5 text-[13px] font-medium text-[#3d1219]"
                style={{ background: "linear-gradient(135deg,#96741a,#e7cf94)" }}
              >
                {b.titulo}
              </button>
            ))}
          </div>
        )}

        {erro && (
          <div
            className="mx-4 mb-2 rounded-[12px] px-4 py-2.5 text-[12.5px] leading-relaxed"
            style={{ background: "rgba(168,91,82,0.14)", border: "1px solid rgba(168,91,82,0.3)", color: "#f2c4bd" }}
          >
            {erro}
          </div>
        )}

        {/* composer */}
        <div className="px-3 pb-3 pt-2 border-t border-white/10" style={{ background: "rgba(255,255,255,0.04)" }}>
          {/* preview do anexo (foto de referência da próxima mensagem) */}
          {anexo && (
            <div className="max-w-3xl mx-auto mb-2 flex items-center gap-2.5 rounded-[12px] px-2.5 py-2 w-fit" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={anexo.dataUrl} alt="Prévia do anexo" className="w-11 h-11 rounded-[8px] object-cover shrink-0" />
              <span className="text-[12px] text-cream/70">Foto de referência anexada</span>
              <button
                onClick={() => setAnexo(null)}
                className="press w-6 h-6 grid place-items-center rounded-full text-cream/60 hover:text-cream hover:bg-white/10"
                aria-label="Remover anexo"
              >
                <X size={14} />
              </button>
            </div>
          )}
          <div className="flex items-center gap-2 max-w-3xl mx-auto">
            <label
              className={"press relative w-10 h-10 rounded-full grid place-items-center text-cream/70 hover:text-cream bg-white/10 hover:bg-white/[0.16] shrink-0 cursor-pointer " + (digitando ? "opacity-45 pointer-events-none" : "")}
              aria-label="Anexar foto"
              title="Anexar foto de referência"
            >
              <Paperclip size={18} />
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={escolherArquivo}
                disabled={digitando}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                title="Anexar foto de referência"
              />
            </label>
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") enviar();
              }}
              onPaste={colarImagem}
              disabled={digitando}
              placeholder="Escreva (ou cole/arraste uma foto)..."
              className="flex-1 bg-white/10 rounded-full px-4 py-2.5 text-[13.5px] text-cream placeholder:text-cream/40 focus:outline-none focus:ring-2 focus:ring-cobre/25 disabled:opacity-60"
            />
            <button
              onClick={enviar}
              disabled={(!texto.trim() && !anexo) || digitando}
              className="grad-cobre press w-11 h-11 rounded-full grid place-items-center text-vinho-d shrink-0 disabled:opacity-45 disabled:cursor-default"
              aria-label="Enviar"
            >
              <SendHorizontal size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
