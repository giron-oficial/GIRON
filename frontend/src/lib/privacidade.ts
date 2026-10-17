// Filtro de privacidade do analytics (sem dependência externa, pra ser testável).
// Garante que nome, CPF, telefone, e-mail, valores e identificadores nunca saiam do app.

// Nomes de propriedade que nunca podem sair do app (em qualquer nível)
const PROIBIDAS = /cpf|rg|telefone|phone|celular|whats|nome|name|email|e-mail|valor|capital|juro|parcela|pix|chave|senha|password|token|endere|address|cep|latitude|longitude|gps|mensagem|message|texto/i
// Chaves técnicas do próprio PostHog que precisam passar inteiras, senão o servidor rejeita o evento
// (token = chave pública do projeto; distinct_id = id interno do usuário)
const SISTEMA = /^(token|distinct_id|\$lib_rate_limit_remaining_tokens)$/
// Chaves que carregam endereço de página e precisam ser limpas (checadas ANTES das proibidas,
// porque "$pathname" contém "name" e seria apagada por engano)
const CHAVES_URL = /url|pathname|referrer|\$host$/i
// Padrões que denunciam dado pessoal dentro de um texto
const PARECE_CPF = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/
const PARECE_TELEFONE = /\(?\b\d{2}\)?\s?9?\d{4}-?\d{4}\b/
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi
const NUMERO_NO_CAMINHO = /\/\d+(?=\/|$)/g
const LINK_CADASTRO = /^\/c\/[^/]+/

// Tira identificadores e parâmetros de um endereço de página
export function limparEndereco(valor: unknown): unknown {
  if (typeof valor !== 'string') return valor
  if (!valor.includes('/')) return valor.replace(UUID, ':id') // ex.: $host, $referring_domain
  try {
    const url = new URL(valor, window.location.origin)
    const caminho = url.pathname.replace(LINK_CADASTRO, '/c/:codigo').replace(UUID, ':id').replace(NUMERO_NO_CAMINHO, '/:n')
    // sem ?parâmetros nem #âncora; se veio só o caminho (ex.: $pathname), devolve só o caminho
    return valor.startsWith('/') ? caminho : url.origin + caminho
  } catch {
    return undefined
  }
}

// Passa por todas as propriedades do evento tirando o que não pode sair
export function limparPropriedades(props: Record<string, unknown>): Record<string, unknown> {
  const limpo: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(props)) {
    if (SISTEMA.test(k)) {
      limpo[k] = v
    } else if (CHAVES_URL.test(k)) {
      limpo[k] = limparEndereco(v)
    } else if (PROIBIDAS.test(k)) {
      continue
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      limpo[k] = limparPropriedades(v as Record<string, unknown>)
    } else if (typeof v === 'string' && (PARECE_CPF.test(v) || PARECE_TELEFONE.test(v))) {
      continue
    } else {
      limpo[k] = v
    }
  }
  return limpo
}

// Procura texto com cara de CPF/telefone só dentro dos VALORES que são texto.
// Números (ex.: $time, o relógio do evento) não contam: 1792238631.4 parecia um telefone e derrubava tudo.
function temDadoPessoal(valor: unknown): boolean {
  if (typeof valor === 'string') return PARECE_CPF.test(valor) || PARECE_TELEFONE.test(valor)
  if (Array.isArray(valor)) return valor.some(temDadoPessoal)
  if (valor && typeof valor === 'object') return Object.values(valor).some(temDadoPessoal)
  return false
}

// Última barreira: se ainda sobrou algo com cara de CPF/telefone, o evento inteiro é descartado
export function barreiraFinal<T extends { properties?: Record<string, unknown> } | null>(evento: T): T | null {
  if (!evento) return evento
  if (temDadoPessoal(evento.properties ?? {})) return null
  return evento
}

