import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './lib/auth'
import { AuthProvider } from './lib/AuthProvider'
import ClienteFicha from './pages/ClienteFicha'
import ClienteNovo from './pages/ClienteNovo'
import Clientes from './pages/Clientes'
import Configuracoes from './pages/Configuracoes'
import Calculadora from './pages/Calculadora'
import Contrato from './pages/Contrato'
import Contratos from './pages/Contratos'
import DonoFinanceira from './pages/DonoFinanceira'
import DonoPainel from './pages/DonoPainel'
import EmprestimoNovo from './pages/EmprestimoNovo'
import EsqueciSenha from './pages/EsqueciSenha'
import Extrato from './pages/Extrato'
import Inicio from './pages/Inicio'
import LinkCadastro from './pages/LinkCadastro'
import Login from './pages/Login'
import NovaSenha from './pages/NovaSenha'
import Relatorios from './pages/Relatorios'
import Status from './pages/Status'

// Telas da financeira (o dono do GIRON vai direto pro Painel do Dono)
function Protegida({ children }: { children: ReactNode }) {
  const { session, papel, carregando } = useAuth()
  if (carregando) return null
  if (!session) return <Navigate to="/login" replace />
  return papel === 'dono_giron' ? <Navigate to="/dono" replace /> : children
}

// Telas só do dono do GIRON
function SoDono({ children }: { children: ReactNode }) {
  const { session, papel, carregando } = useAuth()
  if (carregando) return null
  if (!session) return <Navigate to="/login" replace />
  return papel === 'dono_giron' ? children : <Navigate to="/" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/esqueci-senha" element={<EsqueciSenha />} />
          <Route path="/nova-senha" element={<NovaSenha />} />
          <Route path="/c/:codigo" element={<LinkCadastro />} />
          <Route path="/status" element={<Status />} />
          <Route path="/" element={<Protegida><Inicio /></Protegida>} />
          <Route path="/clientes" element={<Protegida><Clientes /></Protegida>} />
          <Route path="/clientes/novo" element={<Protegida><ClienteNovo /></Protegida>} />
          <Route path="/clientes/:id" element={<Protegida><ClienteFicha /></Protegida>} />
          <Route path="/clientes/:id/emprestimo" element={<Protegida><EmprestimoNovo /></Protegida>} />
          <Route path="/calculadora" element={<Protegida><Calculadora /></Protegida>} />
          <Route path="/relatorios" element={<Protegida><Relatorios /></Protegida>} />
          <Route path="/configuracoes" element={<Protegida><Configuracoes /></Protegida>} />
          <Route path="/contratos" element={<Protegida><Contratos /></Protegida>} />
          <Route path="/contratos/:id" element={<Protegida><Contrato /></Protegida>} />
          <Route path="/contratos/:id/extrato" element={<Protegida><Extrato /></Protegida>} />
          <Route path="/dono" element={<SoDono><DonoPainel /></SoDono>} />
          <Route path="/dono/:id" element={<SoDono><DonoFinanceira /></SoDono>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
