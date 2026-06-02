import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import adminUsers from '../data/adminUsers';
import sampleTeamMembers from '../data/teamMembers';
import sampleUsers from '../data/sampleUsers';
import {
  getCSATRecords,
  getStoredTeamMembers,
  getStoredUsers,
  getStoredUserSession,
  saveCSATRecords,
  saveTeamMembers,
  saveUsers,
  saveUserSession,
  backendLogin,
  backendChangePassword,
  saveAuthToken,
} from '../services/authService';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [users, setUsers] = useState([]);
  const [csatRecords, setCsatRecords] = useState([]);

  useEffect(() => {
    const storedUser = getStoredUserSession();
    const storedUsers = getStoredUsers();
    const storedTeam = getStoredTeamMembers();
    const storedCSAT = getCSATRecords();

    if (!storedUsers.length) {
      saveUsers(sampleUsers);
      setUsers(sampleUsers);
    } else {
      setUsers(storedUsers);
    }

    if (!storedTeam.length) {
      saveTeamMembers(sampleTeamMembers);
      setTeamMembers(sampleTeamMembers);
    } else {
      setTeamMembers(storedTeam);
    }

    setCsatRecords(storedCSAT);

    if (storedUser) {
      setUser(storedUser);
    }
  }, []);

  const login = async (email, password) => {
    const normalizedEmail = email.trim().toLowerCase();

    // Check if there is an overridden password in custom_passwords
    const customPasswords = JSON.parse(localStorage.getItem('custom_passwords') || '{}');
    const customPass = customPasswords[normalizedEmail];

    // Try backend auth first
    try {
      const res = await backendLogin(normalizedEmail, password);
      if (res.success) {
        const userObj = {
          id: res.user.id,
          role: res.user.role,
          email: res.user.email,
          full_name: res.user.full_name,
          token: res.token,
          password: customPass || password,
        };
        setUser(userObj);
        saveUserSession(userObj);
        saveAuthToken(res.token);
        return { success: true, user: userObj };
      }
    } catch (err) {
      // ignore and fallback to local auth
    }

    const admin = adminUsers.find((account) => {
      if (account.email !== normalizedEmail) return false;
      const expectedPass = customPass || account.password;
      return expectedPass === password;
    });
    if (admin) {
      const adminWithPass = { ...admin, password: customPass || admin.password };
      setUser(adminWithPass);
      saveUserSession(adminWithPass);
      return { success: true, user: adminWithPass };
    }

    const team = getStoredTeamMembers().find((member) => {
      if (member.email !== normalizedEmail) return false;
      const expectedPass = customPass || member.password;
      return expectedPass === password;
    });
    if (team) {
      const teamWithPass = { ...team, password: customPass || team.password };
      setUser(teamWithPass);
      saveUserSession(teamWithPass);
      return { success: true, user: teamWithPass };
    }

    const registeredUser = getStoredUsers().find((record) => {
      if (record.email !== normalizedEmail) return false;
      const expectedPass = customPass || record.password;
      return expectedPass === password;
    });
    if (registeredUser) {
      const userWithPass = { ...registeredUser, password: customPass || registeredUser.password };
      setUser(userWithPass);
      saveUserSession(userWithPass);
      return { success: true, user: userWithPass };
    }

    return { success: false, message: 'Invalid credentials. Please check your email and password.' };
  };

  const logout = () => {
    setUser(null);
    saveUserSession(null);
    navigate('/login');
  };

  const register = (profile) => {
    const normalizedEmail = profile.email.trim().toLowerCase();
    const existingAdmin = adminUsers.some((account) => account.email === normalizedEmail);
    const existingTeam = getStoredTeamMembers().some((member) => member.email === normalizedEmail);
    const existingUser = getStoredUsers().some((record) => record.email === normalizedEmail);

    if (existingAdmin || existingTeam || existingUser) {
      return { success: false, message: 'Email already exists. Use a different address.' };
    }

    const newUser = {
      id: `user_${Date.now()}`,
      role: 'USER',
      firstName: profile.firstName.trim(),
      lastName: profile.lastName.trim(),
      email: normalizedEmail,
      password: profile.password,
      department: 'Customer Experience',
    };

    const updatedUsers = [...getStoredUsers(), newUser];
    saveUsers(updatedUsers);
    setUsers(updatedUsers);

    return { success: true, user: newUser };
  };

  const createTeamMember = (payload) => {
    const normalizedEmail = payload.email.trim().toLowerCase();
    const existingTeam = getStoredTeamMembers().some((member) => member.email === normalizedEmail);
    const existingAdmin = adminUsers.some((account) => account.email === normalizedEmail);
    const existingUser = getStoredUsers().some((record) => record.email === normalizedEmail);

    if (existingTeam || existingAdmin || existingUser) {
      return { success: false, message: 'This team member email already exists.' };
    }

    const tempPassword = `team-${Math.random().toString(36).substring(2, 8)}`;
    const newTeamMember = {
      id: `team_${Date.now()}`,
      role: 'TEAM',
      firstName: payload.firstName.trim(),
      lastName: payload.lastName.trim(),
      email: normalizedEmail,
      password: tempPassword,
      department: payload.department || 'Operations',
      assignedZone: payload.assignedZone || 'Support Queue',
    };

    const updatedTeamMembers = [...getStoredTeamMembers(), newTeamMember];
    saveTeamMembers(updatedTeamMembers);
    setTeamMembers(updatedTeamMembers);

    return { success: true, teamMember: newTeamMember };
  };

  const submitCsat = (entry) => {
    const record = {
      id: `csat_${Date.now()}`,
      ...entry,
      createdAt: new Date().toISOString(),
    };
    const updatedRecords = [...getCSATRecords(), record];
    saveCSATRecords(updatedRecords);
    setCsatRecords(updatedRecords);
    return record;
  };

  const changePassword = async (currentPassword, newPassword, email = null) => {
    const targetEmail = (email || user?.email || '').trim().toLowerCase();
    if (!targetEmail) return { success: false, message: 'Email address is required.' };

    const backendResult = await backendChangePassword(targetEmail, currentPassword, newPassword);
    if (backendResult.success) {
      if (user && user.email.trim().toLowerCase() === targetEmail) {
        const updatedUser = { ...user, password: newPassword };
        setUser(updatedUser);
        saveUserSession(updatedUser);
      }
      return backendResult;
    }

    // Fall back to local auth storage if backend is unreachable or not available
    const customPasswords = JSON.parse(localStorage.getItem('custom_passwords') || '{}');
    let foundAccount = null;

    // 1. Check in admins
    const admin = adminUsers.find(a => a.email === targetEmail);
    if (admin) foundAccount = admin;

    // 2. Check in team members
    if (!foundAccount) {
      const team = getStoredTeamMembers().find(t => t.email === targetEmail);
      if (team) foundAccount = team;
    }

    // 3. Check in users
    if (!foundAccount) {
      const registeredUser = getStoredUsers().find(u => u.email === targetEmail);
      if (registeredUser) foundAccount = registeredUser;
    }

    if (!foundAccount) {
      return { success: false, message: 'No account found with this email address.' };
    }

    const activePassword = customPasswords[targetEmail] || foundAccount.password;

    if (activePassword !== currentPassword) {
      return { success: false, message: 'Current password does not match.' };
    }

    customPasswords[targetEmail] = newPassword;
    localStorage.setItem('custom_passwords', JSON.stringify(customPasswords));

    if (foundAccount.role === 'TEAM') {
      const storedTeam = getStoredTeamMembers();
      const updatedTeam = storedTeam.map(t => t.email === targetEmail ? { ...t, password: newPassword } : t);
      saveTeamMembers(updatedTeam);
      setTeamMembers(updatedTeam);
    } else if (foundAccount.role === 'USER') {
      const storedUsers = getStoredUsers();
      const updatedUsers = storedUsers.map(u => u.email === targetEmail ? { ...u, password: newPassword } : u);
      saveUsers(updatedUsers);
      setUsers(updatedUsers);
    }

    if (user && user.email.trim().toLowerCase() === targetEmail) {
      const updatedUser = { ...user, password: newPassword };
      setUser(updatedUser);
      saveUserSession(updatedUser);
    }

    return { success: true, message: 'Password updated successfully!' };
  };

  const value = useMemo(
    () => ({
      user,
      users,
      teamMembers,
      csatRecords,
      login,
      logout,
      register,
      createTeamMember,
      submitCsat,
      changePassword,
    }),
    [user, users, teamMembers, csatRecords]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
