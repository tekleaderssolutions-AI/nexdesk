const USERS_KEY = 'nextdesk_users';
const TEAM_MEMBERS_KEY = 'nextdesk_team_members';
const CURRENT_USER_KEY = 'nextdesk_current_user';
const CSAT_KEY = 'nextdesk_csat_records';
const TOKEN_KEY = 'nextdesk_auth_token';

export const getStoredUsers = () => {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY)) || [];
  } catch {
    return [];
  }
};

export const saveUsers = (users) => {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
};

export const getStoredTeamMembers = () => {
  try {
    return JSON.parse(localStorage.getItem(TEAM_MEMBERS_KEY)) || [];
  } catch {
    return [];
  }
};

export const saveTeamMembers = (members) => {
  localStorage.setItem(TEAM_MEMBERS_KEY, JSON.stringify(members));
};

export const getStoredUserSession = () => {
  try {
    return JSON.parse(localStorage.getItem(CURRENT_USER_KEY));
  } catch {
    return null;
  }
};

export const saveUserSession = (user) => {
  if (!user) {
    localStorage.removeItem(CURRENT_USER_KEY);
    return;
  }
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
};

export const getAuthToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const saveAuthToken = (token) => {
  if (!token) {
    localStorage.removeItem(TOKEN_KEY);
    return;
  }
  localStorage.setItem(TOKEN_KEY, token);
};

export const backendChangePassword = async (email, currentPassword, newPassword) => {
  try {
    const res = await fetch('http://127.0.0.1:8000/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, current_password: currentPassword, new_password: newPassword }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { success: false, message: payload.detail || payload.message || 'Unable to change password' };
    }
    return { success: true, message: payload.message || 'Password changed successfully' };
  } catch (err) {
    return { success: false, message: 'Backend unreachable' };
  }
};

export const backendLogin = async (email, password) => {
  try {
    const res = await fetch('http://127.0.0.1:8000/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      return { success: false, message: payload.detail || 'Login failed' };
    }
    const data = await res.json();
    const token = data.access_token;
    if (!token) return { success: false, message: 'No token returned' };
    saveAuthToken(token);

    const meRes = await fetch('http://127.0.0.1:8000/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!meRes.ok) return { success: false, message: 'Failed to fetch user info' };
    const user = await meRes.json();
    return { success: true, token, user };
  } catch (err) {
    return { success: false, message: 'Backend unreachable' };
  }
};

export const getCSATRecords = () => {
  try {
    return JSON.parse(localStorage.getItem(CSAT_KEY)) || [];
  } catch {
    return [];
  }
};

export const saveCSATRecords = (records) => {
  localStorage.setItem(CSAT_KEY, JSON.stringify(records));
};
