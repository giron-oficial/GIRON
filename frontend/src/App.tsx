import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './lib/auth'
import { AuthProvider } from './lib/AuthProvider'
import ClienteFicha from './pages/ClienteFicha'
import ClienteNovo from './pages/ClienteNovo'
import Clientes from './pages/Clientes'
import Inicio from './pages/Inicio'
import LinkCadastro from './pages/LinkCadastro'
import Login from './pages/Login'
import Status from './pages/Status'

function Protegida({ children }: { children: ReactNode }) {
  const { session, carregando } = useAuth()
  if (carregando) return null
  return session ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/c/:codigo" element={<LinkCadastro />} />
          <Route path="/status" element={<Status />} />
          <Route path="/" element={<Protegida><Inicio /></Protegida>} />
          <Route path="/clientes" element={<Protegida><Clientes /></Protegida>} />
          <Route path="/clientes/novo" element={<Protegida><ClienteNovo /></Protegida>} />
          <Route path="/clientes/:id" element={<Protegida><ClienteFicha /></Protegida>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
