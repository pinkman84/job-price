import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AppLayout } from './components/AppLayout'
import Login from './pages/Login'
import JobsList from './pages/JobsList'
import JobForm from './pages/JobForm'
import JobDetail from './pages/JobDetail'
import ClientsList from './pages/ClientsList'
import MaterialsList from './pages/MaterialsList'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<JobsList />} />
            <Route path="/jobs/new" element={<JobForm />} />
            <Route path="/jobs/:id" element={<JobDetail />} />
            <Route path="/jobs/:id/edit" element={<JobForm />} />
            <Route path="/clients" element={<ClientsList />} />
            <Route path="/materials" element={<MaterialsList />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
