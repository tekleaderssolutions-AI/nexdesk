import api from './api';

export const getMyCsatRecords = async () => {
  try {
    const r = await api.get('http://127.0.0.1:8000/csat');
    return { success: true, records: r.data };
  } catch {
    return { success: false, records: [] };
  }
};

export const submitCsatFeedback = async (ticketId, rating, isResolved, feedbackText) => {
  try {
    const r = await api.post(`http://127.0.0.1:8000/tickets/${ticketId}/csat`, {
      rating, is_resolved: isResolved, feedback_text: feedbackText || null,
    });
    return { success: true, record: r.data };
  } catch {
    return { success: false };
  }
};

export const analyzeTicket = async (subject, description) => {
  try {
    const response = await api.post('http://127.0.0.1:8000/tickets/analyze', { subject, description });
    return { success: true, ...response.data };
  } catch {
    return { success: false };
  }
};

export const createTicket = async ({ subject, description, category, priority, attachments }) => {
  try {
    const payload = {
      subject,
      description,
      // Backend currently accepts category_id; if no mapping exists, leave null.
      category_id: null,
      priority: priority?.split(' ')[0] || 'P3',
      attachments: attachments?.map((file) => ({
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        storage_path: file.name,
      })) || [],
    };

    const response = await api.post('http://127.0.0.1:8000/tickets', payload);
    return { success: true, ticket: response.data };
  } catch (error) {
    const message = error.response?.data?.detail || error.response?.data?.message || error.message || 'Unable to create ticket';
    return { success: false, message };
  }
};

export const fetchTickets = async (params = {}) => {
  try {
    const response = await api.get('http://127.0.0.1:8000/tickets', { params });
    return { success: true, tickets: response.data };
  } catch (error) {
    const message = error.response?.data?.detail || error.response?.data?.message || error.message || 'Unable to fetch tickets';
    return { success: false, message };
  }
};

export const getTicket = async (ticketId) => {
  try {
    const response = await api.get(`http://127.0.0.1:8000/tickets/${ticketId}`);
    return { success: true, ticket: response.data };
  } catch (error) {
    const message = error.response?.data?.detail || error.response?.data?.message || error.message || 'Unable to load ticket';
    return { success: false, message };
  }
};

export const getTicketRelationships = async (ticketId) => {
  try {
    const response = await api.get(`http://127.0.0.1:8000/tickets/${ticketId}/relationships`);
    return { success: true, relationships: response.data };
  } catch (error) {
    const message = error.response?.data?.detail || error.response?.data?.message || error.message || 'Unable to load relationships';
    return { success: false, message, relationships: [] };
  }
};

export const getTicketTimeline = async (ticketId) => {
  try {
    const response = await api.get(`http://127.0.0.1:8000/tickets/${ticketId}/timeline`);
    return { success: true, events: response.data };
  } catch (error) {
    const message = error.response?.data?.detail || error.message || 'Unable to load timeline';
    return { success: false, message, events: [] };
  }
};

export const fetchDashboardStats = async () => {
  try {
    const response = await api.get('http://127.0.0.1:8000/dashboard/stats');
    return { success: true, stats: response.data };
  } catch (error) {
    const message = error.response?.data?.detail || error.message || 'Unable to load stats';
    return { success: false, message, stats: null };
  }
};

export const fetchNotifications = async () => {
  try {
    const response = await api.get('http://127.0.0.1:8000/notifications');
    return { success: true, notifications: response.data };
  } catch (error) {
    return { success: false, notifications: [] };
  }
};

export const markNotificationsRead = async () => {
  try {
    await api.post('http://127.0.0.1:8000/notifications/read');
  } catch (_) {}
};

export const fetchDepartmentDashboardStats = async () => {
  try {
    const response = await api.get('http://127.0.0.1:8000/department/stats');
    return { success: true, stats: response.data };
  } catch (error) {
    const message = error.response?.data?.detail || error.message || 'Unable to load department stats';
    return { success: false, message, stats: null };
  }
};

export const fetchDepartments = async () => {
  try {
    const response = await api.get('http://127.0.0.1:8000/departments');
    return { success: true, departments: response.data };
  } catch (error) {
    return { success: false, departments: [] };
  }
};

export const fetchTeamsForDepartment = async (deptId) => {
  try {
    const response = await api.get(`http://127.0.0.1:8000/departments/${deptId}/teams`);
    return { success: true, teams: response.data };
  } catch (error) {
    return { success: false, teams: [] };
  }
};

export const getAISuggestion = async (ticketId) => {
  try {
    const response = await api.get(`http://127.0.0.1:8000/tickets/${ticketId}/ai-suggestion`);
    return { success: true, suggestion: response.data };
  } catch (error) {
    if (error.response?.status === 404) return { success: false, suggestion: null };
    const message = error.response?.data?.detail || error.message || 'Unable to load AI suggestion';
    return { success: false, message, suggestion: null };
  }
};

export const regenerateAISuggestion = async (ticketId) => {
  try {
    await api.post(`http://127.0.0.1:8000/tickets/${ticketId}/ai-suggestion/generate`);
    return { success: true };
  } catch (error) {
    return { success: false };
  }
};

export const fetchKBArticles = async ({ category, team, priority, search, limit = 50, offset = 0 } = {}) => {
  try {
    const params = { limit, offset };
    if (category) params.category = category;
    if (team) params.team = team;
    if (priority) params.priority = priority;
    if (search) params.search = search;
    const response = await api.get('http://127.0.0.1:8000/knowledge-base', { params });
    return { success: true, articles: response.data };
  } catch (error) {
    return { success: false, articles: [] };
  }
};

export const fetchKBMeta = async () => {
  try {
    const response = await api.get('http://127.0.0.1:8000/knowledge-base/meta');
    return { success: true, ...response.data };
  } catch (error) {
    return { success: false, categories: [], teams: [] };
  }
};

export const getMe = async () => {
  try {
    const response = await api.get('http://127.0.0.1:8000/me');
    return { success: true, user: response.data };
  } catch (error) {
    return { success: false, user: null };
  }
};

export const getTicketResolution = async (ticketId) => {
  try {
    const response = await api.get(`http://127.0.0.1:8000/tickets/${ticketId}/resolution`);
    return { success: true, resolution: response.data };
  } catch (error) {
    if (error.response?.status === 404) return { success: false, resolution: null };
    return { success: false, resolution: null };
  }
};

export const getResolutionConfidence = async (ticketId) => {
  try {
    const response = await api.get(`http://127.0.0.1:8000/tickets/${ticketId}/resolution-confidence`);
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, data: null };
  }
};

export const getTicketMessages = async (ticketId) => {
  try {
    const response = await api.get(`http://127.0.0.1:8000/tickets/${ticketId}/messages`);
    return { success: true, messages: response.data };
  } catch (error) {
    return { success: false, messages: [] };
  }
};

export const sendTicketMessage = async (ticketId, messageBody) => {
  try {
    const response = await api.post(`http://127.0.0.1:8000/tickets/${ticketId}/messages`, { message_body: messageBody });
    return { success: true, message: response.data };
  } catch (error) {
    const msg = error.response?.data?.detail || error.message || 'Failed to send message';
    return { success: false, message: msg };
  }
};

export const generateKBEmbeddings = async () => {
  try {
    const response = await api.post('http://127.0.0.1:8000/admin/kb-embeddings/generate');
    return { success: true, result: response.data };
  } catch (error) {
    const msg = error.response?.data?.detail || error.message || 'KB embedding generation failed';
    return { success: false, message: msg };
  }
};

export const runAutoResolveBackfill = async () => {
  try {
    const response = await api.post('http://127.0.0.1:8000/admin/backfill-auto-resolve');
    return { success: true, result: response.data };
  } catch (error) {
    const msg = error.response?.data?.detail || error.message || 'Backfill failed';
    return { success: false, message: msg };
  }
};

export const acceptAIResolution = async (ticketId) => {
  try {
    const response = await api.post(`http://127.0.0.1:8000/tickets/${ticketId}/accept-resolution`);
    return { success: true, ticket: response.data };
  } catch (error) {
    const msg = error.response?.data?.detail || error.message || 'Failed to accept resolution';
    return { success: false, message: msg };
  }
};

export const rejectAIResolution = async (ticketId) => {
  try {
    const response = await api.post(`http://127.0.0.1:8000/tickets/${ticketId}/reject-resolution`);
    return { success: true, ticket: response.data };
  } catch (error) {
    const msg = error.response?.data?.detail || error.message || 'Failed to reject resolution';
    return { success: false, message: msg };
  }
};

export const discoverActions = async (ticketId, { kb_confidence = 0, kb_title = '', kb_resolution = '' } = {}) => {
  try {
    const response = await api.post(`http://127.0.0.1:8000/tickets/${ticketId}/discover-actions`, { kb_confidence, kb_title, kb_resolution });
    return { success: true, result: response.data };
  } catch (error) {
    const msg = error.response?.data?.detail || error.message || 'Action discovery failed';
    return { success: false, message: msg };
  }
};

export const confirmAction = async (ticketId, resolved) => {
  try {
    const response = await api.post(`http://127.0.0.1:8000/tickets/${ticketId}/confirm-action`, { resolved });
    return { success: true, ticket: response.data };
  } catch (error) {
    const msg = error.response?.data?.detail || error.message || 'Failed to confirm action';
    return { success: false, message: msg };
  }
};

export const getActionExecution = async (ticketId) => {
  try {
    const response = await api.get(`http://127.0.0.1:8000/tickets/${ticketId}/action-execution`);
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, data: null };
  }
};

export const getAIResolutionData = async (ticketId) => {
  try {
    const response = await api.get(`http://127.0.0.1:8000/tickets/${ticketId}/ai-resolution`);
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, data: null };
  }
};

export const submitTeamAIAction = async (ticketId, action, editedSolution = null) => {
  try {
    const payload = { action };
    if (editedSolution) payload.edited_solution = editedSolution;
    const response = await api.post(`http://127.0.0.1:8000/tickets/${ticketId}/team-ai-action`, payload);
    return { success: true, ticket: response.data };
  } catch (error) {
    const msg = error.response?.data?.detail || error.message || 'Failed to submit AI action';
    return { success: false, message: msg };
  }
};

export const getConversations = async (ticketId) => {
  try {
    const response = await api.get(`http://127.0.0.1:8000/tickets/${ticketId}/conversations`);
    return { success: true, messages: response.data };
  } catch (error) {
    return { success: false, messages: [] };
  }
};

export const getTeamMembersWorkload = async () => {
  try {
    const r = await api.get('http://127.0.0.1:8000/team/members-workload');
    return { success: true, data: r.data };
  } catch {
    return { success: false, data: null };
  }
};

export const assignTicketToMember = async (ticketId, agentUserId) => {
  try {
    const r = await api.post(`http://127.0.0.1:8000/tickets/${ticketId}/assign-to-member`, { agent_user_id: agentUserId });
    return { success: true, result: r.data };
  } catch (error) {
    const msg = error.response?.data?.detail || error.message || 'Assignment failed';
    return { success: false, message: msg };
  }
};

export const getSLARules = async () => {
  try {
    const r = await api.get('http://127.0.0.1:8000/admin/sla-rules');
    return { success: true, rules: r.data };
  } catch {
    return { success: false, rules: [] };
  }
};

export const updateSLARule = async (ruleId, payload) => {
  try {
    const r = await api.put(`http://127.0.0.1:8000/admin/sla-rules/${ruleId}`, payload);
    return { success: true, rule: r.data };
  } catch {
    return { success: false };
  }
};

export const getTicketSLAStatus = async (ticketId) => {
  try {
    const r = await api.get(`http://127.0.0.1:8000/tickets/${ticketId}/sla-status`);
    return { success: true, sla: r.data };
  } catch {
    return { success: false, sla: null };
  }
};

export const sendConversationMessage = async (ticketId, message, attachmentUrl = null) => {
  try {
    const payload = { message };
    if (attachmentUrl) payload.attachment_url = attachmentUrl;
    const response = await api.post(`http://127.0.0.1:8000/tickets/${ticketId}/conversations`, payload);
    return { success: true, message: response.data };
  } catch (error) {
    const msg = error.response?.data?.detail || error.message || 'Failed to send message';
    return { success: false, message: msg };
  }
};

export const fetchAdminCSATAnalytics = async ({ days = 30, teamId = null, rating = null } = {}) => {
  try {
    const params = { days };
    if (teamId) params.team_id = teamId;
    if (rating) params.rating = rating;
    const r = await api.get('http://127.0.0.1:8000/admin/csat-analytics', { params });
    return { success: true, data: r.data };
  } catch {
    return { success: false, data: null };
  }
};

export const fetchAdminAnalytics = async ({ deptId = null, teamId = null, memberId = null, days = 90 } = {}) => {
  try {
    const params = { days };
    if (deptId) params.dept_id = deptId;
    if (teamId) params.team_id = teamId;
    if (memberId) params.member_id = memberId;
    const r = await api.get('http://127.0.0.1:8000/admin/analytics', { params });
    return { success: true, data: r.data };
  } catch {
    return { success: false, data: null };
  }
};

export const fetchOrgStructure = async () => {
  try {
    const r = await api.get('http://127.0.0.1:8000/admin/structure');
    return { success: true, data: r.data };
  } catch {
    return { success: false, data: { departments: [] } };
  }
};

export const updateTicketStatus = async (ticketId, status) => {
  try {
    const response = await api.put(`http://127.0.0.1:8000/tickets/${ticketId}/status`, { status });
    return { success: true, ticket: response.data };
  } catch (error) {
    const msg = error.response?.data?.detail || error.message || 'Failed to update status';
    return { success: false, message: msg };
  }
};
