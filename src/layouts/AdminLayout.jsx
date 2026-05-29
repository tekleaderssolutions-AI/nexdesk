import { Outlet } from 'react-router-dom';
import Sidebar from '../components/common/Sidebar';
import Topbar from '../components/common/Topbar';

const adminSections = [
  {
    title: 'Management',
    links: [
      { label: 'Dashboard', path: '/admin/dashboard' },
      { label: 'Users', path: '/admin/users' },
      { label: 'Teams', path: '/admin/teams' },
      { label: 'CSAT', path: '/admin/csat' },
      { label: 'Analytics', path: '/admin/analytics' },
      { label: 'Workflows', path: '/admin/workflows' },
      { label: 'Incidents', path: '/admin/incidents' },
    ],
  },
];

const switchLinks = [
  { label: 'User Portal →', path: '/user/dashboard' },
  { label: 'Team Portal →', path: '/team/dashboard' },
];

function AdminLayout() {
  return (
    <div className="layout admin-theme">
      <Sidebar sections={adminSections} portalLabel="ADMIN PORTAL" switchLinks={switchLinks} />
      <div className="main">
        <Topbar portalLabel="ADMIN PORTAL" />
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;
