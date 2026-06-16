// Script de segurança — roda nos servidores do Netlify, nunca exposto ao cliente
// Valida o pedido na Nuvemshop e depois cria o aluno na Kiwify

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ mensagem: 'Método não permitido.' }) };
  }

  let dados;
  try {
    dados = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ mensagem: 'Dados inválidos.' }) };
  }

  const { nome, email, telefone, cpf, pedido } = dados;

  if (!nome || !email || !telefone || !cpf || !pedido) {
    return { statusCode: 400, body: JSON.stringify({ mensagem: 'Todos os campos são obrigatórios.' }) };
  }

  // ── Credenciais (configuradas nas variáveis de ambiente do Netlify) ──────────
  const NUVEMSHOP_STORE_ID   = process.env.NUVEMSHOP_STORE_ID;
  const NUVEMSHOP_ACCESS_TOKEN = process.env.NUVEMSHOP_ACCESS_TOKEN;
  const KIWIFY_API_KEY       = process.env.KIWIFY_API_KEY;
  const KIWIFY_PRODUCT_ID    = process.env.KIWIFY_PRODUCT_ID;

  // ── ETAPA 1: Validar pedido na Nuvemshop ────────────────────────────────────
  try {
    const respostaNuvem = await fetch(
      `https://api.nuvemshop.com.br/v1/${NUVEMSHOP_STORE_ID}/orders/${pedido}`,
      {
        headers: {
          'Authentication': `bearer ${NUVEMSHOP_ACCESS_TOKEN}`,
          'User-Agent': 'Canvense Portal (andersonsalgadostudio@gmail.com)',
          'Content-Type': 'application/json',
        }
      }
    );

    if (respostaNuvem.status === 404) {
      return {
        statusCode: 400,
        body: JSON.stringify({ mensagem: 'Pedido não encontrado. Verifique o número e tente novamente.' })
      };
    }

    if (!respostaNuvem.ok) {
      return {
        statusCode: 400,
        body: JSON.stringify({ mensagem: 'Não foi possível validar seu pedido. Tente novamente em instantes.' })
      };
    }

    const pedidoDados = await respostaNuvem.json();

    // Aceita pedidos pagos ou com pagamento aprovado
    const statusValidos = ['paid', 'open'];
    const statusPagamento = pedidoDados.payment_status;

    if (!statusValidos.includes(statusPagamento)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ mensagem: 'Este pedido ainda não foi confirmado como pago. Aguarde a confirmação do pagamento e tente novamente.' })
      };
    }

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ mensagem: 'Erro ao validar o pedido. Tente novamente.' })
    };
  }

  // ── ETAPA 2: Criar aluno na Kiwify ──────────────────────────────────────────
  try {
    const respostaKiwify = await fetch('https://api.kiwify.com.br/v1/subscribers', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${KIWIFY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        product_id: KIWIFY_PRODUCT_ID,
        name: nome,
        email: email,
        document: cpf.replace(/\D/g, ''),
        phone: telefone.replace(/\D/g, ''),
      })
    });

    if (!respostaKiwify.ok) {
      const erroKiwify = await respostaKiwify.json().catch(() => ({}));
      console.error('Erro Kiwify:', erroKiwify);
      return {
        statusCode: 500,
        body: JSON.stringify({ mensagem: 'Seu pedido foi validado, mas houve um erro ao liberar o acesso. Entre em contato com o suporte.' })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ mensagem: 'Acesso liberado com sucesso!' })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ mensagem: 'Erro ao liberar acesso. Tente novamente.' })
    };
  }
};
