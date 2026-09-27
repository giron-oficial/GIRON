import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './lib/auth'
import { AuthProvider } from './lib/AuthProvider'
import Inicio from './pages/Inicio'
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
          <Route path="/status" element={<Status />} />
          <Route path="/" element={<Protegida><Inicio /></Protegida>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
