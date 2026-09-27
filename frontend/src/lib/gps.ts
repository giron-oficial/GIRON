import { useEffect, useRef, useState } from 'react'

// Pega a localizacao pelo GPS esperando ate 1 minuto pra melhorar a precisao (RN-42).
// Libera quando chegar a 15 m ou menos, ou quando der 1 minuto. Guarda a leitura mais precisa.
export type Leitura = { latitude: number; longitude: number; precisao: number }
export type EstadoGps = 'parado' | 'buscando' | 'pronto' | 'negado' | 'indisponivel'

export function useGps() {
  const [estado, setEstado] = useState<EstadoGps>('parado')
  const [melhor, setMelhor] = useState<Leitura | null>(null)
  const [segundos, setSegundos] = useState(0)
  const vigia = useRef<number | null>(null)
  const relogio = useRef<number | null>(null)

  const parar = () => {
    if (vigia.current !== null) navigator.geolocation.clearWatch(vigia.current)
    if (relogio.current !== null) window.clearInterval(relogio.current)
    vigia.current = relogio.current = null
  }

  useEffect(() => parar, [])

  function iniciar() {
    if (!('geolocation' in navigator)) return setEstado('indisponivel')
    parar()
    setMelhor(null)
    setSegundos(0)
    setEstado('buscando')
    let atual: Leitura | null = null
    const inicio = Date.now()
    relogio.current = window.setInterval(() => {
      const s = Math.floor((Date.now() - inicio) / 1000)
      setSegundos(s)
      if (s >= 60) { parar(); setEstado(atual ? 'pronto' : 'indisponivel') }
    }, 1000)
    vigia.current = navigator.geolocation.watchPosition(
      (p) => {
        const l = { latitude: p.coords.latitude, longitude: p.coords.longitude, precisao: Math.round(p.coords.accuracy) }
        if (!atual || l.precisao < atual.precisao) { atual = l; setMelhor(l) }
        if (l.precisao <= 15) { parar(); setEstado('pronto') }
      },
      (e) => { parar(); setEstado(e.code === e.PERMISSION_DENIED ? 'negado' : 'indisponivel') },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 60000 },
    )
  }

  return { estado, melhor, segundos, iniciar, usarAssim: () => { parar(); if (melhor) setEstado('pronto') } }
}
