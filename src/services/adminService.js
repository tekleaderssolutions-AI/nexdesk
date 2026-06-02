import { getAuthToken } from './authService';

const API_BASE = 'http://127.0.0.1:8000';

const getHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${getAuthToken()}`,
});

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: getHeaders(),
    ...options,
  });
  if (res.status === 204) return null;
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Request failed: ${res.status}`);
  }
  return res.json();
}

// ==================== ORGANIZATIONS ====================

export const getOrganizations = (skip = 0, limit = 100) =>
  request(`/admin/organizations?skip=${skip}&limit=${limit}`);

export const getOrganizationById = (id) =>
  request(`/admin/organizations/${id}`);

export const createOrganization = (payload) =>
  request('/admin/organizations', { method: 'POST', body: JSON.stringify(payload) });

export const updateOrganization = (id, payload) =>
  request(`/admin/organizations/${id}`, { method: 'PUT', body: JSON.stringify(payload) });

export const deleteOrganization = (id) =>
  request(`/admin/organizations/${id}`, { method: 'DELETE' });

// ==================== DEPARTMENTS ====================

export const getDepartments = (skip = 0, limit = 100) =>
  request(`/admin/departments?skip=${skip}&limit=${limit}`);

export const getDepartmentById = (id) =>
  request(`/admin/departments/${id}`);

export const createDepartment = (payload) =>
  request('/admin/departments', { method: 'POST', body: JSON.stringify(payload) });

export const updateDepartment = (id, payload) =>
  request(`/admin/departments/${id}`, { method: 'PUT', body: JSON.stringify(payload) });

export const deleteDepartment = (id) =>
  request(`/admin/departments/${id}`, { method: 'DELETE' });

// ==================== TEAMS ====================

export const getTeams = (skip = 0, limit = 100) =>
  request(`/admin/teams?skip=${skip}&limit=${limit}`);

export const getTeamsWithStats = (skip = 0, limit = 100) =>
  request(`/admin/teams/stats?skip=${skip}&limit=${limit}`);

export const getTeamById = (id) =>
  request(`/admin/teams/${id}`);

export const createTeam = (payload) =>
  request('/admin/teams', { method: 'POST', body: JSON.stringify(payload) });

export const updateTeam = (id, payload) =>
  request(`/admin/teams/${id}`, { method: 'PUT', body: JSON.stringify(payload) });

export const deleteTeam = (id) =>
  request(`/admin/teams/${id}`, { method: 'DELETE' });

// ==================== TEAM MEMBERS ====================

export const getTeamMembers = (skip = 0, limit = 100) =>
  request(`/admin/team-members?skip=${skip}&limit=${limit}`);

export const createTeamMember = (payload) =>
  request('/admin/team-members', { method: 'POST', body: JSON.stringify(payload) });

export const updateTeamMember = (id, payload) =>
  request(`/admin/team-members/${id}`, { method: 'PUT', body: JSON.stringify(payload) });

export const deleteTeamMember = (id) =>
  request(`/admin/team-members/${id}`, { method: 'DELETE' });

// ==================== MEMBER SKILLS (inline) ====================

export const getMemberSkills = (memberId) =>
  request(`/admin/team-members/${memberId}/skills`);

export const addMemberSkill = (memberId, payload) =>
  request(`/admin/team-members/${memberId}/skills`, { method: 'POST', body: JSON.stringify(payload) });

export const removeMemberSkill = (tmsId) =>
  request(`/admin/team-member-skills/${tmsId}`, { method: 'DELETE' });

// ==================== SKILLS ====================

export const getSkills = (skip = 0, limit = 100) =>
  request(`/admin/skills?skip=${skip}&limit=${limit}`);

export const getSkillById = (id) =>
  request(`/admin/skills/${id}`);

export const createSkill = (payload) =>
  request('/admin/skills', { method: 'POST', body: JSON.stringify(payload) });

export const updateSkill = (id, payload) =>
  request(`/admin/skills/${id}`, { method: 'PUT', body: JSON.stringify(payload) });

export const deleteSkill = (id) =>
  request(`/admin/skills/${id}`, { method: 'DELETE' });

// ==================== TEAM MEMBER SKILLS ====================

export const getTeamMemberSkills = (skip = 0, limit = 100) =>
  request(`/admin/team-member-skills?skip=${skip}&limit=${limit}`);

export const createTeamMemberSkill = (payload) =>
  request('/admin/team-member-skills', { method: 'POST', body: JSON.stringify(payload) });

export const updateTeamMemberSkill = (id, payload) =>
  request(`/admin/team-member-skills/${id}`, { method: 'PUT', body: JSON.stringify(payload) });

export const deleteTeamMemberSkill = (id) =>
  request(`/admin/team-member-skills/${id}`, { method: 'DELETE' });

// ==================== USERS ====================

export const getUsers = (skip = 0, limit = 100) =>
  request(`/admin/users?skip=${skip}&limit=${limit}`);

export const getUserById = (userId) =>
  request(`/admin/users/${userId}`);

export const createUser = (payload) =>
  request('/admin/users', { method: 'POST', body: JSON.stringify(payload) });

export const updateUser = (userId, payload) =>
  request(`/admin/users/${userId}`, { method: 'PUT', body: JSON.stringify(payload) });

export const activateUser = (userId) =>
  request(`/admin/users/${userId}/activate`, { method: 'PUT' });

export const deactivateUser = (userId) =>
  request(`/admin/users/${userId}/deactivate`, { method: 'PUT' });

export const resetPassword = (userId) =>
  request(`/admin/users/${userId}/reset-password`, { method: 'PUT' });
