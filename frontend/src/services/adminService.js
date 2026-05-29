import { getAuthToken } from './authService';

const API_BASE = 'http://127.0.0.1:8000';

const getHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${getAuthToken()}`,
});

// ==================== USERS ====================

export const getUsers = async (skip = 0, limit = 100) => {
  try {
    const res = await fetch(`${API_BASE}/admin/users?skip=${skip}&limit=${limit}`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch users');
    return await res.json();
  } catch (err) {
    console.error('getUsers error:', err);
    throw err;
  }
};

export const getUserById = async (userId) => {
  try {
    const res = await fetch(`${API_BASE}/admin/users/${userId}`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch user');
    return await res.json();
  } catch (err) {
    console.error('getUserById error:', err);
    throw err;
  }
};

export const createUser = async (payload) => {
  try {
    const res = await fetch(`${API_BASE}/admin/users`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.detail || 'Failed to create user');
    }
    return await res.json();
  } catch (err) {
    console.error('createUser error:', err);
    throw err;
  }
};

export const updateUser = async (userId, payload) => {
  try {
    const res = await fetch(`${API_BASE}/admin/users/${userId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to update user');
    return await res.json();
  } catch (err) {
    console.error('updateUser error:', err);
    throw err;
  }
};

export const activateUser = async (userId) => {
  try {
    const res = await fetch(`${API_BASE}/admin/users/${userId}/activate`, {
      method: 'PUT',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to activate user');
    return await res.json();
  } catch (err) {
    console.error('activateUser error:', err);
    throw err;
  }
};

export const deactivateUser = async (userId) => {
  try {
    const res = await fetch(`${API_BASE}/admin/users/${userId}/deactivate`, {
      method: 'PUT',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to deactivate user');
    return await res.json();
  } catch (err) {
    console.error('deactivateUser error:', err);
    throw err;
  }
};

export const resetPassword = async (userId) => {
  try {
    const res = await fetch(`${API_BASE}/admin/users/${userId}/reset-password`, {
      method: 'PUT',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to reset password');
    return await res.json();
  } catch (err) {
    console.error('resetPassword error:', err);
    throw err;
  }
};

// ==================== DEPARTMENTS ====================

export const getDepartments = async (skip = 0, limit = 100) => {
  try {
    const res = await fetch(`${API_BASE}/admin/departments?skip=${skip}&limit=${limit}`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch departments');
    return await res.json();
  } catch (err) {
    console.error('getDepartments error:', err);
    throw err;
  }
};

export const getDepartmentById = async (departmentId) => {
  try {
    const res = await fetch(`${API_BASE}/admin/departments/${departmentId}`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch department');
    return await res.json();
  } catch (err) {
    console.error('getDepartmentById error:', err);
    throw err;
  }
};

export const createDepartment = async (payload) => {
  try {
    const res = await fetch(`${API_BASE}/admin/departments`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to create department');
    return await res.json();
  } catch (err) {
    console.error('createDepartment error:', err);
    throw err;
  }
};
