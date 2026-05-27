const JSON_HEADERS = {
  "Content-Type": "application/json",
};

async function parseResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      typeof data === "object" && data?.message
        ? data.message
        : `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return data;
}

export async function apiFetch(path, options = {}) {
  const response = await fetch(path, {
    credentials: "include",
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : JSON_HEADERS),
      ...(options.headers || {}),
    },
  });

  return parseResponse(response);
}

export const authApi = {
  me() {
    return apiFetch("/api/auth/me");
  },
  login(payload) {
    return apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  logout() {
    return apiFetch("/api/auth/logout", {
      method: "POST",
    });
  },
};

export const adminApi = {
  dashboard() {
    return apiFetch("/api/admin/dashboard");
  },
  users(params = {}) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        search.set(key, value);
      }
    }
    const query = search.toString();
    return apiFetch(`/api/admin/users${query ? `?${query}` : ""}`);
  },
  profile() {
    return apiFetch("/api/admin/profile");
  },
  updateProfile(payload) {
    return apiFetch("/api/admin/profile", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },
  changeProfilePassword(payload) {
    return apiFetch("/api/admin/profile/password", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  students() {
    return apiFetch("/api/admin/students");
  },
  audit() {
    return apiFetch("/api/admin/audit");
  },
  calendar() {
    return apiFetch("/api/admin/calendar");
  },
  createCalendarEvent(payload) {
    return apiFetch("/api/admin/calendar", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  updateCalendarEvent(eventId, payload) {
    return apiFetch(`/api/admin/calendar/${eventId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },
  reports() {
    return apiFetch("/api/admin/reports");
  },
  resources() {
    return apiFetch("/api/admin/resources");
  },
  createResource(payload) {
    return apiFetch("/api/admin/resources", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  updateResource(resourceId, payload) {
    return apiFetch(`/api/admin/resources/${resourceId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },
  uploadFile(formData) {
    return apiFetch("/api/admin/uploads", {
      method: "POST",
      body: formData,
    });
  },
  createUser(payload) {
    return apiFetch("/api/admin/users", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  updateUser(userId, payload) {
    return apiFetch(`/api/admin/users/${userId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },
  updateUserStatus(userId, payload) {
    return apiFetch(`/api/admin/users/${userId}/status`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  resetUserPassword(userId, payload) {
    return apiFetch(`/api/admin/users/${userId}/reset-password`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  sections() {
    return apiFetch("/api/admin/sections");
  },
  settings() {
    return apiFetch("/api/admin/system-settings");
  },
  updateSettings(payload) {
    return apiFetch("/api/admin/system-settings", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },
  runAcademicTransition(payload) {
    return apiFetch("/api/admin/academic-transition", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  createSection(payload) {
    return apiFetch("/api/admin/sections", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  updateSection(sectionId, payload) {
    return apiFetch(`/api/admin/sections/${sectionId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },
  previewRoster(formData) {
    return apiFetch("/api/admin/rosters/preview", {
      method: "POST",
      body: formData,
    });
  },
  importRoster(payload) {
    return apiFetch("/api/admin/rosters/import", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};

export const teacherApi = {
  dashboard() {
    return apiFetch("/api/teacher/dashboard");
  },
  profile() {
    return apiFetch("/api/teacher/profile");
  },
  updateProfile(payload) {
    return apiFetch("/api/teacher/profile", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },
  changeProfilePassword(payload) {
    return apiFetch("/api/teacher/profile/password", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  classes() {
    return apiFetch("/api/teacher/classes");
  },
  roster() {
    return apiFetch("/api/teacher/roster");
  },
  classRoster(sectionId) {
    return apiFetch(`/api/teacher/classes/${sectionId}/roster`);
  },
  addStudentToRoster(sectionId, payload) {
    return apiFetch(`/api/teacher/classes/${sectionId}/roster`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  calendar() {
    return apiFetch("/api/teacher/calendar");
  },
  createCalendarEvent(payload) {
    return apiFetch("/api/teacher/calendar", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  updateCalendarEvent(eventId, payload) {
    return apiFetch(`/api/teacher/calendar/${eventId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },
  resources() {
    return apiFetch("/api/teacher/resources");
  },
  createResource(payload) {
    return apiFetch("/api/teacher/resources", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  updateResource(resourceId, payload) {
    return apiFetch(`/api/teacher/resources/${resourceId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },
  uploadFile(formData) {
    return apiFetch("/api/teacher/uploads", {
      method: "POST",
      body: formData,
    });
  },
  classWorkspace(sectionId) {
    return apiFetch(`/api/teacher/classes/${sectionId}`);
  },
  createModule(sectionId, payload) {
    return apiFetch(`/api/teacher/classes/${sectionId}/modules`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  updateModule(sectionId, moduleId, payload) {
    return apiFetch(`/api/teacher/classes/${sectionId}/modules/${moduleId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },
  createAssignment(sectionId, payload) {
    return apiFetch(`/api/teacher/classes/${sectionId}/assignments`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  updateAssignment(sectionId, assignmentId, payload) {
    return apiFetch(`/api/teacher/classes/${sectionId}/assignments/${assignmentId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },
  createAssignmentQuestion(sectionId, assignmentId, payload) {
    return apiFetch(`/api/teacher/classes/${sectionId}/assignments/${assignmentId}/questions`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  updateAssignmentQuestion(sectionId, assignmentId, questionId, payload) {
    return apiFetch(
      `/api/teacher/classes/${sectionId}/assignments/${assignmentId}/questions/${questionId}`,
      {
        method: "PUT",
        body: JSON.stringify(payload),
      }
    );
  },
  createAnnouncement(sectionId, payload) {
    return apiFetch(`/api/teacher/classes/${sectionId}/announcements`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  updateAnnouncement(sectionId, announcementId, payload) {
    return apiFetch(`/api/teacher/classes/${sectionId}/announcements/${announcementId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },
  createDiscussion(sectionId, payload) {
    return apiFetch(`/api/teacher/classes/${sectionId}/discussions`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  updateDiscussion(sectionId, threadId, payload) {
    return apiFetch(`/api/teacher/classes/${sectionId}/discussions/${threadId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },
  createDiscussionReply(sectionId, threadId, payload) {
    return apiFetch(`/api/teacher/classes/${sectionId}/discussions/${threadId}/replies`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  reviewSubmission(sectionId, submissionId, payload) {
    return apiFetch(`/api/teacher/classes/${sectionId}/submissions/${submissionId}/review`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  reports() {
    return apiFetch("/api/teacher/reports");
  },
  records() {
    return apiFetch("/api/teacher/records");
  },
  performance() {
    return apiFetch("/api/teacher/performance");
  },
  filteredReports(params = {}) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        search.set(key, value);
      }
    }
    const query = search.toString();
    return apiFetch(`/api/teacher/reports${query ? `?${query}` : ""}`);
  },
  async downloadReportsCsv(params = {}) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        search.set(key, value);
      }
    }
    const response = await fetch(`/api/teacher/reports/export${search.toString() ? `?${search}` : ""}`, {
      credentials: "include",
    });
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }
    return response.blob();
  },
};

export const studentApi = {
  dashboard() {
    return apiFetch("/api/student/dashboard");
  },
  classes() {
    return apiFetch("/api/student/classes");
  },
  classWorkspace(sectionId) {
    return apiFetch(`/api/student/classes/${sectionId}`);
  },
  submitAssignment(sectionId, assignmentId, payload) {
    return apiFetch(`/api/student/classes/${sectionId}/assignments/${assignmentId}/submit`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  results() {
    return apiFetch("/api/student/results");
  },
};
