import { Outlet } from 'react-router-dom';
import Sidebar from '../components/common/Sidebar';
import Topbar from '../components/common/Topbar';

const userSections = [
  {
    title: 'Operations',
    links: [
      { label: 'Dashboard', path: '/user/dashboard' },
      { label: 'My Tickets', path: '/user/tickets', badge: '8' },
      { label: 'CSAT', path: '/user/csat' },
      { label: 'New Ticket', path: '/user/new' },
    ],
  },
  {
    title: 'Account',
    links: [
      { label: 'Profile', path: '/user/profile' },
    ],
  },
];

const switchLinks = [
  { label: 'Team Portal →', path: '/team/dashboard' },
  { label: 'Admin Portal →', path: '/admin/dashboard' },
];

function UserLayout() {
  return (
    <div className="layout user-theme">
      <Sidebar sections={userSections} portalLabel="USER PORTAL" switchLinks={switchLinks} />
      <div className="main">
        <Topbar portalLabel="USER PORTAL" />
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default UserLayout;
