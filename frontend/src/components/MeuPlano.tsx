import { useEffect, useState } from 'react'
import { carregarBarra, resumoGuardado, type ResumoBarra } from '../lib/barra'
import { dataBr, reais } from '../lib/formatos'
import { EMAIL_SUPORTE } from '../lib/marca'
import { Grupo, Linha } from './Ajustes'

// "Meu plano" nas Configurações: a financeira VÊ o plano e o que está ligado (robô do Telegram, WhatsApp automático)
// e PEDE pra ativar. Quem liga e desliga é só o dono do GIRON, no Painel do Dono.

function Selo({ ligado }: { ligado: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${ligado ? 'bg-sucesso/15 text-sucesso' : 'bg-superficie-2 text-suave'}`}>
      <span className={`size-1.5 rounded-full ${ligado ? 'bg-sucesso' : 'bg-suave/60'}`} />
      {ligado ? 'Ligado' : 'Desligado'}
    </span>
  )
}

function pedir(empresa: string, recurso: string) {
  const assunto = `Quero ativar: ${recurso}`
  const corpo = `Olá! Sou da ${empresa} e quero ativar o ${recurso} no meu GIRON.`
  return `mailto:${EMAIL_SUPORTE}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`
}

export default function MeuPlano() {
  const [r, setR] = useState<ResumoBarra | null>(resumoGuardado)
  useEffect(() => {
    carregarBarra().then(setR).catch(() => {})
  }, [])
  if (!r) return null

  const plano = r.testeGratisAte
    ? { titulo: 'Teste grátis', dica: r.testeFaltam === 0 ? 'Termina hoje' : `Faltam ${r.testeFaltam} ${r.testeFaltam === 1 ? 'dia' : 'dias'} (até ${dataBr(r.testeGratisAte)})` }
    : { titulo: `${reais(r.mensalidade)} por mês`, dica: r.proximaMensalidade ? `Próximo vencimento: ${dataBr(r.proximaMensalidade.vencimento)}` : 'Plano ativo' }
  const ativar = (recurso: string) => (
    <a href={pedir(r.nome, recurso)} className="verde inline-flex h-10 items-center rounded-xl px-3.5 text-sm font-bold">
      Quero ativar
    </a>
  )

  return (
    <div>
      <Grupo icone="moeda" titulo="Meu plano" descricao="Pra ativar algo, toque em Quero ativar" cor="text-sucesso bg-sucesso/15">
        <Linha titulo={plano.titulo} dica={plano.dica} />
        <Linha
          titulo="Robô do Telegram"
          dica={r.robo ? 'Em construção: chega em breve' : 'Consulte e lance tudo pelo Telegram'}
        >
          {r.robo ? <Selo ligado /> : ativar('robô do Telegram')}
        </Linha>
        <Linha
          titulo="WhatsApp automático"
          dica={
            r.whatsapp
              ? r.testeGratisAte
                ? 'No teste: 5 mensagens grátis'
                : 'O sistema cobra sozinho'
              : 'O sistema cobra seus clientes sozinho'
          }
        >
          {r.whatsapp ? <Selo ligado /> : ativar('WhatsApp automático')}
        </Linha>
        <Linha titulo="Suporte" dica={`GIRON · ${EMAIL_SUPORTE}`} />
      </Grupo>
    </div>
  )
}
