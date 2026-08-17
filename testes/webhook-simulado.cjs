// Simula uma mensagem chegando pelo webhook do WhatsApp, ASSINADA como a Meta
// assina. Roda dentro do container, onde o APP_SECRET vive.
//
// É o único jeito de testar automaticamente o caminho de produção inteiro:
// webhook -> IA -> gravação da conversa -> peça de cardápio virando mensagem.
// O /testar não serve pra isso porque ele não grava conversa de propósito.
const crypto = require("crypto");

// SEMPRE um número fictício por padrão. Usei o número real do dono uma vez pra
// provar que a peça entra no chat, e o cardápio chegou no WhatsApp dele do nada.
// Hoje nem precisa: a peça é gravada ANTES do envio, então o teste funciona
// mesmo com o envio falhando.
const TELEFONE = process.argv[2] || "5511999990000";
const TEXTO = process.argv[3] || "me manda o cardapio de bolos";
// O env do container ainda aponta pro numero VELHO; o numero de verdade esta
// no tenant. Usar o env aqui faz o teste enviar pelo id morto e falhar por um
// motivo que a producao nao tem.
const PHONE_ID = process.argv[4] || "1158046037400127";

const corpo = JSON.stringify({
  object: "whatsapp_business_account",
  entry: [
    {
      id: "0",
      changes: [
        {
          value: {
            messaging_product: "whatsapp",
            metadata: { display_phone_number: "0", phone_number_id: PHONE_ID },
            contacts: [{ profile: { name: "QA Automatizado" }, wa_id: TELEFONE }],
            messages: [
              {
                from: TELEFONE,
                id: "wamid.qa" + Date.now() + Math.floor(Math.random() * 1000),
                timestamp: String(Math.floor(Date.now() / 1000)),
                type: "text",
                text: { body: TEXTO },
              },
            ],
          },
          field: "messages",
        },
      ],
    },
  ],
});

const segredo = process.env.WHATSAPP_APP_SECRET || "";
const assinatura = "sha256=" + crypto.createHmac("sha256", segredo).update(corpo).digest("hex");

fetch("http://localhost:3000/api/whatsapp", {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-hub-signature-256": assinatura },
  body: corpo,
})
  .then((r) => r.text().then((t) => console.log("webhook respondeu " + r.status + " " + t.slice(0, 40))))
  .catch((e) => console.log("falhou: " + e.message));
