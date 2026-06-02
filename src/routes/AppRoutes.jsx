import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getRedirectForRole } from '../utils/roleUtils';
import AuthLayout from '../layouts/AuthLayout';
import UserLayout from '../layouts/UserLayout';
import TeamLayout from '../layouts/TeamLayout';
import AdminLayout from '../layouts/AdminLayout';
import Login from '../pages/auth/Login';
import UserDashboard from '../pages/user/UserDashboard';
import MyTickets from '../pages/user/MyTickets';
import TicketDetails from '../pages/user/TicketDetails';
import CSAT from '../pages/user/CSAT';
import Profile from '../pages/user/Profile';
import NewTicket from '../pages/user/NewTicket';
import TeamDashboard from '../pages/team/TeamDashboard';
import AssignedQueue from '../pages/team/AssignedQueue';
import TicketWorkspace from '../pages/team/TicketWorkspace';
import Incidents from '../pages/team/Incidents';
import KnowledgeBase from '../pages/team/KnowledgeBase';
import AdminDashboard from '../pages/admin/AdminDashboard';
import AdminUserList from '../pages/admin/AdminUserList';
import AdminUserForm from '../pages/admin/AdminUserForm';
import AdminTeams from '../pages/admin/AdminTeams';
import AdminAnalytics from '../pages/admin/AdminAnalytics';
import WorkflowControls from '../pages/admin/WorkflowControls';
import CSATAnalytics from '../pages/admin/CSATAnalytics';
import IncidentDashboard from '../pages/admin/IncidentDashboard';
import AdminOrganizations from '../pages/admin/AdminOrganizations';
import AdminDepartmentsPage from '../pages/admin/AdminDepartmentsPage';
import AdminTeamsPage from '../pages/admin/AdminTeamsPage';
import AdminTeamMembers from '../pages/admin/AdminTeamMembers';
import AdminTools from '../pages/admin/AdminTools';
import AdminAllTickets from '../pages/admin/AdminAllTickets';
import ForgotPassword from '../pages/auth/ForgotPassword';

function RoleProtectedRoute({ allowedRoles, children }) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const role = (user.role || '').toUpperCase();
  if (!allowedRoles.includes(role)) {
    return <Navigate to={getRedirectForRole(role)} replace />;
  }

  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<AuthLayout />}>
        <Route index element={<Login />} />
        <Route path="login" element={<Login />} />
        <Route path="forgot-password" element={<ForgotPassword />} />
      </Route>

      <Route
        path="/user"
        element={
          <RoleProtectedRoute allowedRoles={['USER']}>
            <UserLayout />
          </RoleProtectedRoute>
        }
      >
        <Route path="dashboard" element={<UserDashboard />} />
        <Route path="tickets" element={<MyTickets />} />
        <Route path="ticket/:id" element={<TicketDetails />} />
        <Route path="csat" element={<CSAT />} />
        <Route path="profile" element={<Profile />} />
        <Route path="new" element={<NewTicket />} />
      </Route>

      <Route
        path="/team"
        element={
          <RoleProtectedRoute allowedRoles={['TEAM']}>
            <TeamLayout />
          </RoleProtectedRoute>
        }
      >
        <Route path="dashboard" element={<TeamDashboard />} />
        <Route path="queue" element={<AssignedQueue />} />
        <Route path="ticket/:id" element={<TicketDetails />} />
        <Route path="workspace" element={<TicketWorkspace />} />
        <Route path="incidents" element={<Incidents />} />
        <Route path="knowledge" element={<KnowledgeBase />} />
      </Route>

      <Route
        path="/admin"
        element={
          <RoleProtectedRoute allowedRoles={['ADMIN']}>
            <AdminLayout />
          </RoleProtectedRoute>
        }
      >
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="users" element={<AdminUserList />} />
        <Route path="users/create" element={<AdminUserForm />} />
        <Route path="users/:userId" element={<AdminUserForm />} />
        <Route path="teams" element={<AdminTeams />} />
        <Route path="csat" element={<CSATAnalytics />} />
        <Route path="analytics" element={<AdminAnalytics />} />
        <Route path="workflows" element={<WorkflowControls />} />
        <Route path="incidents" element={<IncidentDashboard />} />
        <Route path="organizations" element={<AdminOrganizations />} />
        <Route path="departments" element={<AdminDepartmentsPage />} />
        <Route path="teams-manage" element={<AdminTeamsPage />} />
        <Route path="team-members" element={<AdminTeamMembers />} />
        <Route path="tools" element={<AdminTools />} />
        <Route path="all-tickets" element={<AdminAllTickets />} />
        <Route path="ticket/:id" element={<TicketDetails />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default AppRoutes;
