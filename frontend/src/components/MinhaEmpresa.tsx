import { useEffect, useRef, useState } from 'react'
import { Grupo, Linha } from './Ajustes'
import Icone from './Icone'
import { erroCaixa } from './estilo'
import { avisarMarcaMudou, prepararLogo, urlLogo } from '../lib/marca'
import { rastrear } from '../lib/analytics'
import { supabase } from '../lib/supabase'

// Marca do Fomentado (white-label): logo e nome da empresa que aparecem no menu do sistema.
// A logo grava na hora que escolhe o arquivo; o nome grava no botão "Salvar nome".

export default function MinhaEmpresa() {
  const [tenant, setTenant] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [logo, setLogo] = useState<string | null>(null)
  const [nome, setNome] = useState('')
  const [nomeSalvo, setNomeSalvo] = useState('')
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState('')
  const seletor = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase.from('fomentados').select('id, nome_empresa, logo_arquivo').maybeSingle().then(({ data }) => {
      setTenant(data?.id ?? null)
      setLogo(data?.logo_arquivo ?? null)
      setNome(data?.nome_empresa ?? ''); setNomeSalvo(data?.nome_empresa ?? '')
      setCarregando(false)
    })
  }, [])

  async function roda(acao: () => Promise<void>, ok: string) {
    if (!tenant) return setErro('Sua conta ainda não está ligada a uma empresa.')
    setErro(''); setAviso(''); setOcupado(true)
    try { await acao(); setAviso(ok); avisarMarcaMudou() } catch { setErro('Não foi possível salvar. Tente de novo.') } finally { setOcupado(false) }
  }
  const falhou = (r: { error: unknown }) => { if (r.error) throw r.error }

  const mandarLogo = (arquivo: File) => roda(async () => {
    const imagem = await prepararLogo(arquivo)
    const caminho = `${tenant}/logo-${Date.now()}.png`
    falhou(await supabase.storage.from('marcas').upload(caminho, imagem, { contentType: 'image/png' }))
    falhou(await supabase.from('fomentados').update({ logo_arquivo: caminho }).eq('id', tenant!))
    if (logo) await supabase.storage.from('marcas').remove([logo])
    setLogo(caminho)
    rastrear('logo_enviada')
  }, 'Logo salva.')

  const tirarLogo = () => roda(async () => {
    falhou(await supabase.from('fomentados').update({ logo_arquivo: null }).eq('id', tenant!))
    if (logo) await supabase.storage.from('marcas').remove([logo])
    setLogo(null)
  }, 'Logo tirada. O menu volta a mostrar as iniciais.')

  const salvarNome = () => roda(async () => {
    const texto = nome.trim()
    if (!texto) throw new Error('vazio')
    falhou(await supabase.from('fomentados').update({ nome_empresa: texto }).eq('id', tenant!))
    setNome(texto); setNomeSalvo(texto)
  }, 'Nome salvo.')

  const url = urlLogo(logo)
  const nomeMudou = nome.trim() !== nomeSalvo && nome.trim() !== ''

  return (
    <Grupo icone="maleta" titulo="Minha empresa" descricao="Sua logo e seu nome aparecem no menu do sistema">
      {carregando ? (
        <div className="m-4 h-20 animate-pulse rounded-xl bg-superficie-2" />
      ) : (
        <>
          <div className="flex items-center gap-4 px-4 py-4 lg:px-5">
            {url ? (
              <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-texto p-1.5">
                <img src={url} alt="Logo da empresa" className="size-full object-contain" />
              </span>
            ) : (
              <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl border border-dashed border-borda bg-superficie-2 text-suave">
                <Icone nome="imagem" tamanho={24} />
              </span>
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <p className="text-xs leading-snug text-suave">{url ? 'Essa é a logo que aparece no menu.' : 'Sem logo, o menu mostra as iniciais do nome.'} PNG ou JPG, até 2 MB.</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={ocupado} onClick={() => seletor.current?.click()} className="verde inline-flex h-10 items-center gap-1.5 rounded-xl px-4 text-sm font-extrabold disabled:opacity-60">
                  <Icone nome="imagem" tamanho={17} />
                  {ocupado ? 'Salvando…' : url ? 'Trocar logo' : 'Mandar logo'}
                </button>
                {url && (
                  <button type="button" disabled={ocupado} onClick={tirarLogo} className="h-10 rounded-xl bg-superficie-2 px-4 text-sm font-semibold text-suave hover:text-vencido disabled:opacity-60">
                    Tirar
                  </button>
                )}
              </div>
            </div>
            <input
              ref={seletor} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (!f) return
                if (f.size > 10 * 1024 * 1024) return setErro('Imagem muito grande. Escolha uma de até 10 MB.')
                mandarLogo(f)
              }}
            />
          </div>

          <Linha titulo="Nome da empresa" htmlFor="ne" empilha>
            <div className="flex gap-2">
              <input
                id="ne" value={nome} maxLength={60} onChange={(e) => { setNome(e.target.value); setAviso('') }}
                onKeyDown={(e) => e.key === 'Enter' && nomeMudou && salvarNome()} placeholder="Ex.: Fulano Crédito"
                className="h-12 min-w-0 flex-1 rounded-xl border border-borda bg-superficie-2 px-4 text-base font-semibold outline-none placeholder:font-normal placeholder:text-suave/60 focus:border-marca focus:ring-4 focus:ring-marca/15"
              />
              {nomeMudou && (
                <button type="button" disabled={ocupado} onClick={salvarNome} className="verde h-12 shrink-0 rounded-xl px-4 text-sm font-extrabold disabled:opacity-60">
                  Salvar nome
                </button>
              )}
            </div>
          </Linha>

          {aviso && (
            <p className="flex items-center gap-2 px-4 py-3 text-sm font-semibold text-marca lg:px-5">
              <Icone nome="certo" tamanho={17} />
              {aviso}
            </p>
          )}
        </>
      )}
      {erro && <p role="alert" className={`${erroCaixa} m-4 rounded-xl`}>{erro}</p>}
    </Grupo>
  )
}
