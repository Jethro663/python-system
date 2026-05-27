import { useEffect, useMemo, useState } from "react";
import { BookOpenText, CalendarRange, GraduationCap, Users } from "lucide-react";

import { AdminPageShell, AdminSectionCard } from "../components/admin/AdminPageShell";
import { adminApi } from "../lib/api";

const SECTION_FORM = {
  name: "",
  grade_level: "Grade 10",
  school_year: "2026-2027",
  schedule_text: "",
  adviser_user_id: "",
  teacher_assignments: [{ teacher_user_id: "", subject_name: "Mathematics" }],
};

function createSectionEditForm(section) {
  return {
    name: section.name || "",
    grade_level: section.grade_level || "",
    school_year: section.school_year || "",
    schedule_text: section.schedule_text || "",
    adviser_user_id: section.adviser_user_id ? String(section.adviser_user_id) : "",
    teacher_assignments:
      section.teacher_assignments?.length
        ? section.teacher_assignments.map((assignment) => ({
            teacher_user_id: assignment.teacher_user_id ? String(assignment.teacher_user_id) : "",
            subject_name: assignment.subject_name || "Mathematics",
          }))
        : [{ teacher_user_id: "", subject_name: "Mathematics" }],
    status: section.status || "active",
  };
}

function normalizeTeacherAssignments(assignments) {
  return (assignments || [])
    .filter((assignment) => assignment.teacher_user_id && assignment.subject_name.trim())
    .map((assignment) => ({
      teacher_user_id: Number(assignment.teacher_user_id),
      subject_name: assignment.subject_name.trim(),
    }));
}

function getTeacherName(teachers, teacherId) {
  return teachers.find((teacher) => String(teacher.id) === String(teacherId))?.full_name || "Unassigned";
}

function TeacherAssignmentFields({ assignments, teachers, onChange }) {
  return (
    <div className="admin-assignment-stack">
      {assignments.map((assignment, index) => (
        <div className="admin-assignment-card" key={`${index}-${assignment.teacher_user_id}-${assignment.subject_name}`}>
          <div className="admin-assignment-card__header">
            <strong>Teacher Mapping {index + 1}</strong>
            <span>Route a subject lane to a teacher before the section goes live.</span>
          </div>

          <div className="review-grid">
            <label className="field">
              <span>Teacher assignment</span>
              <select
                value={assignment.teacher_user_id}
                onChange={(event) =>
                  onChange(
                    assignments.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, teacher_user_id: event.target.value } : item
                    )
                  )
                }
              >
                <option value="">No teacher mapping</option>
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.full_name}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Subject mapping</span>
              <input
                value={assignment.subject_name}
                onChange={(event) =>
                  onChange(
                    assignments.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, subject_name: event.target.value } : item
                    )
                  )
                }
              />
            </label>
          </div>

          <div className="action-row">
            <button
              className="secondary-button"
              type="button"
              onClick={() =>
                onChange(
                  assignments.filter((_, itemIndex) => itemIndex !== index).length
                    ? assignments.filter((_, itemIndex) => itemIndex !== index)
                    : [{ teacher_user_id: "", subject_name: "Mathematics" }]
                )
              }
            >
              Remove mapping
            </button>
          </div>
        </div>
      ))}

      <button
        className="secondary-button"
        type="button"
        onClick={() =>
          onChange([...assignments, { teacher_user_id: "", subject_name: "Mathematics" }])
        }
      >
        Add teacher mapping
      </button>
    </div>
  );
}

function SectionSpotlight({ section, teachers }) {
  if (!section) {
    return <p className="empty-state">Select a section to review its current setup.</p>;
  }

  const mappings = section.teacher_assignments || [];

  return (
    <div className="admin-spotlight-card">
      <div className="admin-spotlight-card__header">
        <div>
          <p className="admin-spotlight-card__eyebrow">Selected Section</p>
          <h3>{section.name}</h3>
          <p>{section.grade_level} / {section.school_year}</p>
        </div>
        <span className={`admin-status-chip admin-status-chip--${section.status || "inactive"}`}>
          {section.status || "inactive"}
        </span>
      </div>

      <div className="admin-spotlight-grid">
        <div>
          <strong>Schedule</strong>
          <span>{section.schedule_text || "Schedule not set yet"}</span>
        </div>
        <div>
          <strong>Adviser</strong>
          <span>{getTeacherName(teachers, section.adviser_user_id)}</span>
        </div>
        <div>
          <strong>Teacher lanes</strong>
          <span>{mappings.length ? `${mappings.length} mapped subjects` : "No mapped subjects"}</span>
        </div>
        <div>
          <strong>Workflow note</strong>
          <span>Archive older sections once the school year rolls over.</span>
        </div>
      </div>

      <div className="admin-tag-list">
        {mappings.length ? (
          mappings.map((assignment, index) => (
            <span className="admin-tag-chip" key={`${assignment.subject_name}-${index}`}>
              {assignment.subject_name} / {getTeacherName(teachers, assignment.teacher_user_id)}
            </span>
          ))
        ) : (
          <span className="admin-tag-chip">No teacher mappings yet</span>
        )}
      </div>
    </div>
  );
}

export default function AdminSectionsPage() {
  const [sections, setSections] = useState([]);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(SECTION_FORM);
  const [selectedSectionId, setSelectedSectionId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [saving, setSaving] = useState(false);
  const [actionMessage, setActionMessage] = useState("");

  const loadData = async () => {
    try {
      const [sectionsData, usersData] = await Promise.all([adminApi.sections(), adminApi.users()]);
      const loadedSections = sectionsData.sections || [];
      setSections(loadedSections);
      setUsers(usersData.users || []);
      if (selectedSectionId) {
        const nextSection = loadedSections.find((section) => section.id === selectedSectionId);
        if (nextSection) {
          setEditForm(createSectionEditForm(nextSection));
        }
      }
    } catch (loadError) {
      setError(loadError.message);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const teachers = useMemo(() => users.filter((user) => user.role === "teacher"), [users]);

  const filteredSections = useMemo(() => {
    if (statusFilter === "all") {
      return sections;
    }
    return sections.filter((section) => section.status === statusFilter);
  }, [sections, statusFilter]);

  const selectedSection =
    sections.find((section) => section.id === selectedSectionId) || filteredSections[0] || null;

  useEffect(() => {
    if (selectedSection && selectedSection.id !== selectedSectionId) {
      setSelectedSectionId(selectedSection.id);
    }
    if (selectedSection) {
      setEditForm(createSectionEditForm(selectedSection));
    } else {
      setEditForm(null);
    }
  }, [selectedSectionId, selectedSection]);

  const handleSectionAction = async (callback, message) => {
    setSaving(true);
    setError("");
    setActionMessage("");
    try {
      await callback();
      setActionMessage(message);
      await loadData();
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminPageShell
      badge="Manage Sections"
      title="Section directory and lifecycle control"
      description="This is the admin-side setup surface for class containers, adviser mapping, teacher assignment, and archive state."
      meta={
        <>
          <span>{sections.length} total sections</span>
          <span>{filteredSections.length} in current filter</span>
          <span>{teachers.length} available teachers</span>
        </>
      }
      metrics={[
        { label: "Sections", value: sections.length || "-", caption: "All section records" },
        { label: "Filtered", value: filteredSections.length || "-", caption: "Rows in the current status filter" },
        {
          label: "Active",
          value: sections.filter((section) => section.status === "active").length,
          caption: "Current live sections",
        },
        {
          label: "Archived",
          value: sections.filter((section) => section.status === "archived").length,
          caption: "Historical sections",
        },
      ]}
    >
      <div className="page-grid page-grid--admin">
        <AdminSectionCard
          eyebrow="Manage Sections"
          title="Section directory"
          description="Review current section records, then drill into schedule, adviser coverage, and mapped subject lanes."
          actions={
            <select className="table-search" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
          }
        >
          <div className="admin-section-directory-grid">
            {filteredSections.map((section) => (
              <article
                key={section.id}
                className={`admin-section-directory-card ${section.id === selectedSectionId ? "admin-section-directory-card--selected" : ""}`}
                onClick={() => {
                  setSelectedSectionId(section.id);
                  setEditForm(createSectionEditForm(section));
                  setActionMessage("");
                }}
              >
                <div className="admin-section-directory-card__header">
                  <div>
                    <p className="admin-section-directory-card__eyebrow">
                      {section.grade_level} / {section.school_year}
                    </p>
                    <strong>{section.name}</strong>
                  </div>
                  <span className={`admin-status-chip admin-status-chip--${section.status || "inactive"}`}>
                    {section.status || "inactive"}
                  </span>
                </div>
                <div className="admin-section-directory-card__metrics">
                  <div>
                    <strong>Schedule</strong>
                    <span>{section.schedule_text || "Schedule not set"}</span>
                  </div>
                  <div>
                    <strong>Mapped lanes</strong>
                    <span>
                      {section.teacher_assignments?.length
                        ? section.teacher_assignments.map((assignment) => assignment.subject_name).join(", ")
                        : "Unassigned"}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </AdminSectionCard>

        <AdminSectionCard
          eyebrow="Selection Context"
          title="Setup snapshot"
          description="Keep the currently selected section in view while adjusting mappings or planning rollover."
        >
          <SectionSpotlight section={selectedSection} teachers={teachers} />
        </AdminSectionCard>

        <AdminSectionCard
          eyebrow="Create Section"
          title="Adviser and teacher mapping"
          description="Create a section record, define its schedule lane, and attach initial subject coverage."
        >
          <form
            className="form-grid"
            onSubmit={async (event) => {
              event.preventDefault();
              setSaving(true);
              setError("");
              setActionMessage("");
              try {
                await adminApi.createSection({
                  name: form.name,
                  grade_level: form.grade_level,
                  school_year: form.school_year,
                  schedule_text: form.schedule_text,
                  adviser_user_id: form.adviser_user_id ? Number(form.adviser_user_id) : null,
                  teacher_assignments: normalizeTeacherAssignments(form.teacher_assignments),
                });
                setForm(SECTION_FORM);
                setActionMessage("Section created.");
                await loadData();
              } catch (saveError) {
                setError(saveError.message);
              } finally {
                setSaving(false);
              }
            }}
          >
            <div className="admin-form-callout-grid">
              <article className="admin-mini-callout">
                <Users size={18} />
                <div>
                  <strong>Teacher coverage</strong>
                  <span>Map multiple subject lanes before the class opens to teachers.</span>
                </div>
              </article>
              <article className="admin-mini-callout">
                <CalendarRange size={18} />
                <div>
                  <strong>Schedule note</strong>
                  <span>Use a readable schedule string so it carries cleanly into teacher views.</span>
                </div>
              </article>
            </div>

            {[
              ["name", "Section name"],
              ["grade_level", "Grade level"],
              ["school_year", "School year"],
              ["schedule_text", "Schedule"],
            ].map(([key, label]) => (
              <label className="field" key={key}>
                <span>{label}</span>
                <input value={form[key]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} />
              </label>
            ))}

            <label className="field">
              <span>Adviser</span>
              <select
                value={form.adviser_user_id}
                onChange={(event) => setForm((current) => ({ ...current, adviser_user_id: event.target.value }))}
              >
                <option value="">No adviser</option>
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.full_name}
                  </option>
                ))}
              </select>
            </label>

            <TeacherAssignmentFields
              assignments={form.teacher_assignments}
              teachers={teachers}
              onChange={(teacher_assignments) => setForm((current) => ({ ...current, teacher_assignments }))}
            />

            {error ? <div className="form-error">{error}</div> : null}
            {actionMessage ? <div className="form-success">{actionMessage}</div> : null}

            <button className="primary-button" type="submit" disabled={saving}>
              {saving ? "Saving..." : "Create section"}
            </button>
          </form>
        </AdminSectionCard>

        <AdminSectionCard
          eyebrow="Section Lifecycle"
          title="Edit mappings and archive old sections"
          description="Manage adviser assignment, subject coverage, and archive state for the selected section."
        >
          {selectedSection && editForm ? (
            <form
              className="form-grid"
              onSubmit={async (event) => {
                event.preventDefault();
                await handleSectionAction(
                  () =>
                    adminApi.updateSection(selectedSection.id, {
                      name: editForm.name,
                      grade_level: editForm.grade_level,
                      school_year: editForm.school_year,
                      schedule_text: editForm.schedule_text,
                      adviser_user_id: editForm.adviser_user_id ? Number(editForm.adviser_user_id) : null,
                      status: editForm.status,
                      teacher_assignments: normalizeTeacherAssignments(editForm.teacher_assignments),
                    }),
                  "Section updated."
                );
              }}
            >
              <div className="admin-form-callout-grid">
                <article className="admin-mini-callout">
                  <BookOpenText size={18} />
                  <div>
                    <strong>Mapping review</strong>
                    <span>Keep subject labels consistent so teacher dashboards stay readable.</span>
                  </div>
                </article>
                <article className="admin-mini-callout">
                  <GraduationCap size={18} />
                  <div>
                    <strong>Year rollover</strong>
                    <span>Archive finished sections instead of overwriting prior school-year records.</span>
                  </div>
                </article>
              </div>

              {[
                ["name", "Section name"],
                ["grade_level", "Grade level"],
                ["school_year", "School year"],
                ["schedule_text", "Schedule"],
              ].map(([key, label]) => (
                <label className="field" key={key}>
                  <span>{label}</span>
                  <input
                    value={editForm[key]}
                    onChange={(event) => setEditForm((current) => ({ ...current, [key]: event.target.value }))}
                  />
                </label>
              ))}

              <label className="field">
                <span>Adviser</span>
                <select
                  value={editForm.adviser_user_id}
                  onChange={(event) => setEditForm((current) => ({ ...current, adviser_user_id: event.target.value }))}
                >
                  <option value="">No adviser</option>
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.full_name}
                    </option>
                  ))}
                </select>
              </label>

              <TeacherAssignmentFields
                assignments={editForm.teacher_assignments}
                teachers={teachers}
                onChange={(teacher_assignments) => setEditForm((current) => ({ ...current, teacher_assignments }))}
              />

              <label className="field">
                <span>Status</span>
                <select
                  value={editForm.status}
                  onChange={(event) => setEditForm((current) => ({ ...current, status: event.target.value }))}
                >
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </select>
              </label>

              {error ? <div className="form-error">{error}</div> : null}
              {actionMessage ? <div className="form-success">{actionMessage}</div> : null}

              <div className="action-row">
                <button className="primary-button" type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Save changes"}
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  disabled={saving || selectedSection.status === "archived"}
                  onClick={() =>
                    handleSectionAction(
                      () =>
                        adminApi.updateSection(selectedSection.id, {
                          ...editForm,
                          adviser_user_id: editForm.adviser_user_id ? Number(editForm.adviser_user_id) : null,
                          status: "archived",
                          teacher_assignments: normalizeTeacherAssignments(editForm.teacher_assignments),
                        }),
                      "Section archived."
                    )
                  }
                >
                  Archive
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  disabled={saving || selectedSection.status === "active"}
                  onClick={() =>
                    handleSectionAction(
                      () =>
                        adminApi.updateSection(selectedSection.id, {
                          ...editForm,
                          adviser_user_id: editForm.adviser_user_id ? Number(editForm.adviser_user_id) : null,
                          status: "active",
                          teacher_assignments: normalizeTeacherAssignments(editForm.teacher_assignments),
                        }),
                      "Section reactivated."
                    )
                  }
                >
                  Reactivate
                </button>
              </div>
            </form>
          ) : (
            <p className="empty-state">Select a section to edit mappings or archive it.</p>
          )}
        </AdminSectionCard>
      </div>
    </AdminPageShell>
  );
}
