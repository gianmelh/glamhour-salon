import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './app/AppLayout'
import { AuthLayout } from './app/AuthLayout'
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage'
import { LegalPage } from './pages/auth/LegalPage'
import { LoginPage } from './pages/auth/LoginPage'
import { RegistrationPage } from './pages/auth/RegistrationPage'
import { SignUpPage } from './pages/auth/SignUpPage'
import { AppointmentDetailsPage } from './pages/app/AppointmentDetailsPage'
import { AppointmentsPage } from './pages/app/AppointmentsPage'
import { CalendarPage } from './pages/app/CalendarPage'
import { ClientsPage } from './pages/app/ClientsPage'
import { HomePage } from './pages/app/HomePage'
import { SalesPage } from './pages/app/SalesPage'
import { ServicesPage } from './pages/app/ServicesPage'
import { SettingsPage } from './pages/app/SettingsPage'
import { SharePage } from './pages/app/SharePage'
import { StaffPage } from './pages/app/StaffPage'
import { EntryPage } from './pages/onboarding/EntryPage'
import { IntroPage } from './pages/onboarding/IntroPage'
import { SetupPage } from './pages/onboarding/SetupPage'
import { WelcomePage } from './pages/onboarding/WelcomePage'

function App() {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route index element={<WelcomePage />} />
        <Route path="intro" element={<IntroPage />} />
        <Route path="entry" element={<EntryPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="signup" element={<SignUpPage />} />
        <Route path="terms" element={<LegalPage kind="terms" />} />
        <Route path="privacy" element={<LegalPage kind="privacy" />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="register" element={<RegistrationPage />} />
        <Route path="onboarding/:step" element={<SetupPage />} />
      </Route>

      <Route path="app" element={<AppLayout />}>
        <Route index element={<Navigate replace to="home" />} />
        <Route path="home" element={<HomePage />} />
        <Route path="appointments" element={<AppointmentsPage />} />
        <Route path="appointments/:appointmentId" element={<AppointmentDetailsPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="clients" element={<ClientsPage />} />
        <Route path="services" element={<ServicesPage />} />
        <Route path="staff" element={<StaffPage />} />
        <Route path="sales" element={<SalesPage />} />
        <Route path="share" element={<SharePage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<Navigate replace to="/" />} />
    </Routes>
  )
}

export default App
