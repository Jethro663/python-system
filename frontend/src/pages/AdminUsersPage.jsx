import { useEffect, useMemo, useState } from "react";
import { Users } from "lucide-react";

import { AdminPageShell, AdminSectionCard } from "../components/admin/AdminPageShell";
import { adminApi } from "../lib/api";

const EMPTY_FORM = {
  role: "student",
  school_id: "",
  first_name: "",
  last_name: "",
  email: "",
  password: "Student123!",
  status: "active",
  grade_level: "",
  guardian_name: "",
  guardian_contact: "",
  department: "",
  phone: "",
};

function createEditForm(user) {
  return {
    school_id: user.school_id || "",
    first_name: user.first_name || "",
    last_name: user.last_name || "",
    email: user.email || "",
    status: user.status || "active",
    grade_level: user.grade_level || "",
    guardian_name: user.guardian_name || "",
    guardian_contact: user.guardian_contact || "",
    department: user.department || "",
    phone: user.phone || "",
  };
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [actionMessage, setActionMessage] = useState("");

  const loadUsers = async () => {
    try {
      const data = await adminApi.users({
        q: search.trim() || undefined,
        role: roleFilter === "all" ? undefined : roleFilter,
        status: statusFilter === "all" ? undefined : statusFilter,
      });
      const loadedUsers = data.users || [];
      setUsers(loadedUsers);
      if (selectedUserId) {
        const nextSelectedUser = loadedUsers.find((user) => user.id === selectedUserId);
        if (nextSelectedUser) {
          setEditForm(createEditForm(nextSelectedUser));
        }
      }
    } catch (usersError) {
      setError(usersError.message);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [roleFilter, statusFilter]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return users;
    return users.filter((user) =>
      [user.full_name, user.email, user.school_id, user.role, user.status]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query))
    );
  }, [search, users]);

  const roleCounts = useMemo(
    () => ({
      total: users.length,
      filtered: filteredUsers.length,
      teachers: users.filter((user) => user.role === "teacher").length,
      students: users.filter((user) => user.role === "student").length,
      admins: users.filter((user) => user.role === "admin").length,
    }),
    [filteredUsers.length, users]
  );

  const selectedUser =
    users.find((user) => user.id === selectedUserId) || filteredUsers[0] || null;

  useEffect(() => {
    if (selectedUser && selectedUser.id !== selectedUserId) {
      setSelectedUserId(selectedUser.id);
    }
    if (selectedUser) {
      setEditForm(createEditForm(selectedUser));
    } else {
      setEditForm(null);
    }
  }, [selectedUserId, selectedUser]);

  const handleUserAction = async (callback, message) => {
    setSaving(true);
    setError("");
    setActionMessage("");
    try {
      await callback();
      setActionMessage(message);
      await loadUsers();
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminPageShell
      badge="Manage Users"
      title="Account directory and lifecycle control"
      description="This is the admin control room for account creation, role-specific metadata, and access status before class-level work begins."
      icon={Users}
      meta={
        <>
          <span>{roleCounts.total} total accounts</span>
          <span>{roleCounts.filtered} in current view</span>
          <span>{roleCounts.teachers} teachers / {roleCounts.students} students</span>
        </>
      }
      metrics={[
        { label: "Total Users", value: roleCounts.total, caption: "All portal accounts" },
        { label: "Filtered", value: roleCounts.filtered, caption: "Rows matching the current query" },
        { label: "Teachers", value: roleCounts.teachers, caption: "Instruction-side accounts" },
        { label: "Students", value: roleCounts.students, caption: "Learner accounts" },
        { label: "Admins", value: roleCounts.admins, caption: "System-level accounts" },
      ]}
    >
      <div className="page-grid page-grid--admin">
        <AdminSectionCard
          eyebrow="Manage Users"
          title="Account directory"
          description="Search and select accounts before editing lifecycle state or profile details."
          actions={
            <div className="action-row">
              <input
                className="table-search"
                placeholder="Search by name, email, ID, role, or status"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <select className="table-search" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
                <option value="all">All roles</option>
                <option value="admin">Admin</option>
                <option value="teacher">Teacher</option>
                <option value="student">Student</option>
              </select>
              <select className="table-search" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="inactive">Inactive</option>
              </select>
              <button className="secondary-button" type="button" onClick={() => loadUsers()}>
                Search
              </button>
            </div>
          }
        >
          <div className="admin-user-directory-grid">
            {filteredUsers.map((user) => (
              <article
                key={user.id}
                className={`admin-user-directory-card ${user.id === selectedUserId ? "admin-user-directory-card--selected" : ""}`}
                onClick={() => {
                  setSelectedUserId(user.id);
                  setEditForm(createEditForm(user));
                  setActionMessage("");
                }}
              >
                <div className="admin-user-row">
                  <div className={`admin-user-row__avatar admin-user-row__avatar--${user.role}`}>
                    {user.full_name
                      ?.split(" ")
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((part) => part[0])
                      .join("")
                      .toUpperCase() || "U"}
                  </div>
                  <div className="admin-user-row__copy">
                    <strong>{user.full_name}</strong>
                    <span>{user.email}</span>
                  </div>
                </div>
                <div className="admin-user-directory-card__meta">
                  <span>{user.school_id || "No school ID"}</span>
                  <span className={`pill pill--${user.role}`}>{user.role}</span>
                </div>
                <div className="admin-user-directory-card__footer">
                  <span className={`admin-status-chip admin-status-chip--${user.status}`}>
                    {user.status}
                  </span>
                  <span>{user.department || user.grade_level || "General account"}</span>
                </div>
              </article>
            ))}
          </div>
        </AdminSectionCard>

        <AdminSectionCard
          eyebrow="Create User"
          title="Role-specific account form"
          description="Seed a student, teacher, or admin record with the exact metadata each role needs."
        >

        <form
          className="form-grid"
          onSubmit={async (event) => {
            event.preventDefault();
            setSaving(true);
            setError("");
            setActionMessage("");
            try {
              await adminApi.createUser(form);
              setForm({
                ...EMPTY_FORM,
                password: form.role === "admin" ? "Admin123!" : "Student123!",
                role: form.role,
              });
              setActionMessage("User created.");
              await loadUsers();
            } catch (saveError) {
              setError(saveError.message);
            } finally {
              setSaving(false);
            }
          }}
        >
          <label className="field">
            <span>Role</span>
            <select
              value={form.role}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  role: event.target.value,
                  password:
                    event.target.value === "admin"
                      ? "Admin123!"
                      : event.target.value === "teacher"
                        ? "Teacher123!"
                        : "Student123!",
                }))
              }
            >
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
              <option value="admin">Admin</option>
            </select>
          </label>

          {[
            ["school_id", "School ID"],
            ["first_name", "First name"],
            ["last_name", "Last name"],
            ["email", "Email"],
            ["password", "Password"],
          ].map(([key, label]) => (
            <label className="field" key={key}>
              <span>{label}</span>
              <input
                type={key === "password" ? "password" : "text"}
                value={form[key]}
                onChange={(event) =>
                  setForm((current) => ({ ...current, [key]: event.target.value }))
                }
              />
            </label>
          ))}

          {form.role === "teacher" ? (
            <>
              <label className="field">
                <span>Department</span>
                <input
                  value={form.department}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, department: event.target.value }))
                  }
                />
              </label>
              <label className="field">
                <span>Phone</span>
                <input
                  value={form.phone}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, phone: event.target.value }))
                  }
                />
              </label>
            </>
          ) : null}

          {form.role === "student" ? (
            <>
              <label className="field">
                <span>Grade level</span>
                <input
                  value={form.grade_level}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, grade_level: event.target.value }))
                  }
                />
              </label>
              <label className="field">
                <span>Guardian name</span>
                <input
                  value={form.guardian_name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      guardian_name: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="field">
                <span>Guardian contact</span>
                <input
                  value={form.guardian_contact}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      guardian_contact: event.target.value,
                    }))
                  }
                />
              </label>
            </>
          ) : null}

          {error ? <div className="form-error">{error}</div> : null}
          {actionMessage ? <div className="form-success">{actionMessage}</div> : null}

          <button className="primary-button" type="submit" disabled={saving}>
            {saving ? "Saving..." : "Create user"}
          </button>
        </form>
        </AdminSectionCard>

        <AdminSectionCard
          eyebrow="User Lifecycle"
          title="Edit, suspend, reactivate, and reset access"
          description="The selected record becomes the current operations surface for status and profile changes."
        >

        {selectedUser && editForm ? (
          <div className="admin-user-lifecycle">
            <div className="admin-user-lifecycle__hero">
              <div className={`admin-user-lifecycle__avatar admin-user-lifecycle__avatar--${selectedUser.role}`}>
                {selectedUser.full_name
                  ?.split(" ")
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join("")
                  .toUpperCase() || "U"}
              </div>
              <div className="admin-user-lifecycle__copy">
                <strong>{selectedUser.full_name}</strong>
                <span>{selectedUser.email}</span>
                <div className="admin-user-lifecycle__meta">
                  <span className={`pill pill--${selectedUser.role}`}>{selectedUser.role}</span>
                  <span className={`admin-status-chip admin-status-chip--${selectedUser.status}`}>
                    {selectedUser.status}
                  </span>
                </div>
              </div>
            </div>

            <form
              className="form-grid"
              onSubmit={async (event) => {
                event.preventDefault();
                await handleUserAction(
                  () => adminApi.updateUser(selectedUser.id, editForm),
                  "User record updated."
                );
              }}
            >
              <label className="field">
                <span>Role</span>
                <input value={selectedUser.role} disabled />
              </label>

              {[
                ["school_id", "School ID"],
                ["first_name", "First name"],
                ["last_name", "Last name"],
                ["email", "Email"],
              ].map(([key, label]) => (
                <label className="field" key={key}>
                  <span>{label}</span>
                  <input
                    value={editForm[key]}
                    onChange={(event) =>
                      setEditForm((current) => ({ ...current, [key]: event.target.value }))
                    }
                  />
                </label>
              ))}

              <label className="field">
                <span>Status</span>
                <select
                  value={editForm.status}
                  onChange={(event) =>
                    setEditForm((current) => ({ ...current, status: event.target.value }))
                  }
                >
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>

              {selectedUser.role === "teacher" ? (
                <>
                  <label className="field">
                    <span>Department</span>
                    <input
                      value={editForm.department}
                      onChange={(event) =>
                        setEditForm((current) => ({
                          ...current,
                          department: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Phone</span>
                    <input
                      value={editForm.phone}
                      onChange={(event) =>
                        setEditForm((current) => ({ ...current, phone: event.target.value }))
                      }
                    />
                  </label>
                </>
              ) : null}

              {selectedUser.role === "student" ? (
                <>
                  <label className="field">
                    <span>Grade level</span>
                    <input
                      value={editForm.grade_level}
                      onChange={(event) =>
                        setEditForm((current) => ({
                          ...current,
                          grade_level: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Guardian name</span>
                    <input
                      value={editForm.guardian_name}
                      onChange={(event) =>
                        setEditForm((current) => ({
                          ...current,
                          guardian_name: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Guardian contact</span>
                    <input
                      value={editForm.guardian_contact}
                      onChange={(event) =>
                        setEditForm((current) => ({
                          ...current,
                          guardian_contact: event.target.value,
                        }))
                      }
                    />
                  </label>
                </>
              ) : null}

              {error ? <div className="form-error">{error}</div> : null}
              {actionMessage ? <div className="form-success">{actionMessage}</div> : null}

              <div className="action-row">
                <button className="primary-button" type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Save changes"}
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  disabled={saving || selectedUser.status === "suspended"}
                  onClick={() =>
                    handleUserAction(
                      () => adminApi.updateUserStatus(selectedUser.id, { status: "suspended" }),
                      "User suspended."
                    )
                  }
                >
                  Suspend
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  disabled={saving || selectedUser.status === "inactive"}
                  onClick={() =>
                    handleUserAction(
                      () => adminApi.updateUserStatus(selectedUser.id, { status: "inactive" }),
                      "User archived."
                    )
                  }
                >
                  Archive
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  disabled={saving || selectedUser.status === "active"}
                  onClick={() =>
                    handleUserAction(
                      () => adminApi.updateUserStatus(selectedUser.id, { status: "active" }),
                      "User reactivated."
                    )
                  }
                >
                  Reactivate
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    handleUserAction(
                      () =>
                        adminApi.resetUserPassword(selectedUser.id, {
                          password:
                            selectedUser.role === "admin"
                              ? "Admin123!"
                              : selectedUser.role === "teacher"
                                ? "Teacher123!"
                                : "Student123!",
                        }),
                      "Password reset to the role default."
                    )
                  }
                >
                  Reset password
                </button>
                {selectedUser.status === "inactive" ? (
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      const confirmed = window.confirm(
                        `Delete ${selectedUser.full_name}? This permanently removes the account.`
                      );
                      if (!confirmed) return;
                      handleUserAction(async () => {
                        await adminApi.deleteUser(selectedUser.id);
                        setSelectedUserId(null);
                        setEditForm(null);
                      }, "User deleted.");
                    }}
                  >
                    Delete user
                  </button>
                ) : null}
              </div>
            </form>
          </div>
        ) : (
          <p className="empty-state">Select a user from the directory to manage lifecycle actions.</p>
        )}
        </AdminSectionCard>
      </div>
    </AdminPageShell>
  );
}
