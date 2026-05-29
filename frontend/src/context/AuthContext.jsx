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
        };
        setUser(userObj);
        saveUserSession(userObj);
        saveAuthToken(res.token);
        return { success: true, user: userObj };
      }
    } catch (err) {
      // ignore and fallback to local auth
    }

    const admin = adminUsers.find((account) => account.email === normalizedEmail && account.password === password);
    if (admin) {
      setUser(admin);
      saveUserSession(admin);
      return { success: true, user: admin };
    }

    const team = getStoredTeamMembers().find((member) => member.email === normalizedEmail && member.password === password);
    if (team) {
      setUser(team);
      saveUserSession(team);
      return { success: true, user: team };
    }

    const registeredUser = getStoredUsers().find((record) => record.email === normalizedEmail && record.password === password);
    if (registeredUser) {
      setUser(registeredUser);
      saveUserSession(registeredUser);
      return { success: true, user: registeredUser };
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
    }),
    [user, users, teamMembers, csatRecords]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
