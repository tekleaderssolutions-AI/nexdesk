import { Outlet } from 'react-router-dom';
import Sidebar from '../components/common/Sidebar';
import Topbar from '../components/common/Topbar';

const teamSections = [
  {
    title: 'Operations',
    links: [
      { label: 'Dashboard', path: '/team/dashboard' },
      { label: 'Ticket Queue', path: '/team/queue', badge: '14' },
      { label: 'Workspace', path: '/team/workspace' },
      { label: 'Incidents', path: '/team/incidents', badge: '3' },
      { label: 'AI Knowledge', path: '/team/knowledge' },
    ],
  },
];

const switchLinks = [
  { label: 'User Portal →', path: '/user/dashboard' },
  { label: 'Admin Portal →', path: '/admin/dashboard' },
];

function TeamLayout() {
  return (
    <div className="layout team-theme">
      <Sidebar sections={teamSections} portalLabel="TEAM PORTAL" switchLinks={switchLinks} />
      <div className="main">
        <Topbar portalLabel="TEAM PORTAL" />
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default TeamLayout;
