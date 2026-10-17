// Analytics do GIRON (PostHog), com privacidade em primeiro lugar.
//
// Regras fixas deste arquivo:
// - Gravação de sessão (Session Replay) DESLIGADA: o app lida com dados financeiros de clientes.
// - Captura automática de cliques/textos DESLIGADA: só saem os eventos que a gente marca à mão.
// - Nunca sai nome, CPF, telefone, e-mail, valor de empréstimo, parcela, Pix, senha ou token.
// - Endereços de página saem sem identificadores (/clientes/:id em vez de /clientes/uuid) e sem parâmetros.
// - O usuário é identificado só pelo id interno do login (um código), nunca por e-mail.
// - Nas páginas públicas do cliente (/c/:codigo) o PostHog nem é iniciado, e qualquer evento que
//   aponte pra elas é derrubado antes de sair (vale também pro dono logado que abre o link).
//
// Eventos marcados à mão (todos só com categorias fechadas, nunca texto livre):
// - login_ok
// - cliente_criado
// - contrato_criado        { modalidade, sistema, origem: 'novo_emprestimo' | 'calculadora' }
// - contrato_convertido    { modalidade, sistema, origem: 'novo_emprestimo' }
// - pagamento_registrado, amortizacao_registrada, estorno_registrado
// - simulacao_enviada      { canal: 'copiar' | 'whatsapp' }
// - cobranca_enviada       { canal: 'whatsapp_inicio', situacao: 'vence_hoje' | 'vence_amanha' | 'atrasado' }
//                          { canal: 'extrato_imagem' | 'extrato_texto', modo: 'cliente' | 'empresa' }
// - link_cadastro_gerado   { origem: 'clientes' | 'calculadora' }
// - cadastro_avaliado      { resultado: 'aprovado' | 'reprovado' }
// - localizacao_solicitada
// - configuracoes_salvas
import posthog from 'posthog-js'
import { barreiraFinal, bloquearPaginaPublica, ehPaginaPublicaDoCliente, limparPropriedades } from './privacidade'

const chave = import.meta.env.VITE_POSTHOG_KEY as string | undefined
const host = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) || 'https://us.i.posthog.com'

let ativo = false

export function iniciarAnalytics() {
  if (ativo || !chave) return
  if (ehPaginaPublicaDoCliente(window.location.pathname)) return // página do cliente: não liga
  posthog.init(chave, {
    api_host: host,
    // o que sai sozinho: só a troca de tela (nome da rota, sem ids)
    capture_pageview: 'history_change',
    capture_pageleave: false,
    // tudo que grava comportamento fino fica desligado
    disable_session_recording: true,
    autocapture: false,
    capture_heatmaps: false,
    capture_dead_clicks: false,
    rageclick: false,
    capture_performance: false,
    capture_exceptions: false,
    disable_surveys: true,
    disable_web_experiments: true,
    // se algum dia alguém ligar a captura automática, o texto já sai mascarado
    mask_all_text: true,
    mask_all_element_attributes: true,
    // perfil de pessoa só depois do login, e só com o id interno
    person_profiles: 'identified_only',
    persistence: 'localStorage+cookie',
    sanitize_properties: (props) => limparPropriedades(props),
    before_send: (evento) => bloquearPaginaPublica(barreiraFinal(evento), window.location.pathname),
  })
  ativo = true
}

// Marca um evento do app. Só mande propriedades neutras (ex.: modalidade: 'mensal'). Nunca dados do cliente.
export function rastrear(evento: string, props?: Record<string, string | number | boolean | null>) {
  if (!ativo) return
  posthog.capture(evento, props)
}

// Identifica o usuário logado pelo id interno do login (não é e-mail nem nome)
export function identificarUsuario(idInterno: string) {
  if (!ativo) return
  posthog.identify(idInterno)
}

// Ao sair, esquece quem era
export function esquecerUsuario() {
  if (!ativo) return
  posthog.reset()
}
