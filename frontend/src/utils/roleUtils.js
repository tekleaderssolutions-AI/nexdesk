export const ROLE_ADMIN = 'ADMIN';
export const ROLE_TEAM = 'TEAM';
export const ROLE_USER = 'USER';

export const getRedirectForRole = (role) => {
  switch (role) {
    case ROLE_ADMIN:
      return '/admin/dashboard';
    case ROLE_TEAM:
      return '/team/dashboard';
    default:
      return '/user/dashboard';
  }
};

export const buildUserDisplayName = (profile) => {
  return `${profile.firstName || ''} ${profile.lastName || ''}`.trim();
};
