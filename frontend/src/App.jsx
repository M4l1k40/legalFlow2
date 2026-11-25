import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import ClientLayout from './layouts/ClientLayout';
import LawyerLayout from './layouts/LawyerLayout';
import SecretaryLayout from './layouts/SecretaryLayout';
import AdminLayout from './layouts/AdminLayout';
import LoginPage from './pages/LoginPage';
import PageNotFound from './pages/PageNotFound';
import DocumentsPage from './pages/DocumentsPage';
import SettingsPage from './pages/SettingsPage';
import ClientJudicialPage from './pages/client/ClientJudicialPage';
import ClientPaymentsPage from './pages/client/ClientPaymentsPage';
import ClientAppointmentsPage from './pages/client/ClientAppointmentsPage';
import SecretaryLawyersPage from './pages/secretary/SecretaryLawyersPage';
import OfficeCasesPage from './pages/shared/OfficeCasesPage';
import { ThemeProvider } from './context/ThemeContext';
import ClientDashboardPage from './pages/client/ClientDashboardPage';
import ClientProfilePage from './pages/client/ClientProfilePage';
import ClientCasesPage from './pages/client/ClientCasesPage';
import LawyerDashboardPage from './pages/lawyer/LawyerDashboardPage';
import LawyerClientsPage from './pages/lawyer/LawyerClientsPage';
import LawyerCasesPage from './pages/lawyer/LawyerCasesPage';
import LawyerConsultationsPage from './pages/lawyer/LawyerConsultationsPage';
import ClientConsultationsPage from './pages/client/ClientConsultationsPage';
import OfficeConsultationsPage from './pages/secretary/OfficeConsultationsPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import SecretaryDashboardPage from './pages/secretary/SecretaryDashboardPage';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import NotificationsPage from './pages/NotificationsPage';
import LawyerAppointmentsPage from './pages/lawyer/LawyerAppointmentsPage';
import LawyerDeadlinesPage from './pages/lawyer/LawyerDeadlinesPage';
import LawyerInvoicesPage from './pages/lawyer/LawyerInvoicesPage';
import LawyerJudicialPage from './pages/lawyer/LawyerJudicialPage';

export default function App() {
  return (
    <ThemeProvider>
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<LoginPage />} />

            <Route element={<ProtectedRoute allowedRoles={['client']} />}>
              <Route path="/client" element={<ClientLayout />}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<ClientDashboardPage />} />
                <Route path="profile" element={<ClientProfilePage />} />
                <Route path="cases" element={<ClientCasesPage />} />
                <Route path="consultations" element={<ClientConsultationsPage />} />
                <Route path="documents" element={<DocumentsPage eyebrow="Mes documents" description="Les pièces que le cabinet a partagées avec vous." />} />
                <Route path="judicial" element={<ClientJudicialPage />} />
                <Route path="payments" element={<ClientPaymentsPage />} />
                <Route path="appointments" element={<ClientAppointmentsPage />} />
                <Route path="notifications" element={<NotificationsPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>
            </Route>

            <Route element={<ProtectedRoute allowedRoles={['lawyer', 'admin']} />}>
              <Route path="/lawyer" element={<LawyerLayout />}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<LawyerDashboardPage />} />
                <Route path="clients" element={<LawyerClientsPage />} />
                <Route path="cases" element={<LawyerCasesPage />} />
                <Route path="judicial" element={<LawyerJudicialPage />} />
                <Route path="deadlines" element={<LawyerDeadlinesPage />} />
                <Route path="invoices" element={<LawyerInvoicesPage />} />
                <Route path="appointments" element={<LawyerAppointmentsPage />} />
                <Route path="documents" element={<DocumentsPage eyebrow="Espace avocat" canUpload canDelete />} />
                <Route path="consultations" element={<LawyerConsultationsPage />} />
                <Route path="notifications" element={<NotificationsPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>
            </Route>

            <Route element={<ProtectedRoute allowedRoles={['secretary', 'admin']} />}>
              <Route path="/secretary" element={<SecretaryLayout />}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<SecretaryDashboardPage />} />
                <Route path="lawyers" element={<SecretaryLawyersPage />} />
                <Route path="clients" element={<LawyerClientsPage />} />
                <Route path="cases" element={<OfficeCasesPage eyebrow="Espace secrétariat" />} />
                <Route path="consultations" element={<OfficeConsultationsPage />} />
                <Route path="appointments" element={<LawyerAppointmentsPage />} />
                <Route path="documents" element={<DocumentsPage eyebrow="Espace secrétariat" canUpload />} />
                <Route path="payments" element={<LawyerInvoicesPage canCreate={false} />} />
                <Route path="notifications" element={<NotificationsPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>
            </Route>

            <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<AdminDashboardPage />} />
                <Route path="users" element={<AdminUsersPage />} />
                <Route path="lawyers" element={<AdminUsersPage initialRole="LAWYER" />} />
                <Route path="secretaries" element={<AdminUsersPage initialRole="SECRETARY" />} />
                <Route path="clients" element={<LawyerClientsPage />} />
                <Route path="cases" element={<OfficeCasesPage eyebrow="Administration" />} />
                <Route path="consultations" element={<OfficeConsultationsPage />} />
                <Route path="billing" element={<LawyerInvoicesPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>
            </Route>

            <Route path="*" element={<PageNotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
    </ThemeProvider>
  );
}
