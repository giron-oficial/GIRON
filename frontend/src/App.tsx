import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Status from './pages/Status'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="*" element={<Status />} />
      </Routes>
    </BrowserRouter>
  )
}
