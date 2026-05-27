import { useEffect, useMemo, useState } from "react";
import { CalendarClock, CalendarRange, NotebookPen } from "lucide-react";

import { AdminPageShell, AdminSectionCard } from "../components/admin/AdminPageShell";
import { adminApi } from "../lib/api";

const DEFAULT_EVENT = {
  title: "",
  section_id: "",
  start_at: "",
  end_at: "",
  event_type: "school",
  description: "",
};

function toDatetimeLocal(value) {
  if (!value) {
    return "";
  }
  return new Date(value).toISOString().slice(0, 16);
}

function formatDateTime(value) {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleString();
}

function createEventEditForm(event) {
  return {
    title: event.title || "",
    section_id: event.section_id ? String(event.section_id) : "",
    start_at: toDatetimeLocal(event.start_at),
    end_at: toDatetimeLocal(event.end_at),
    event_type: event.event_type || "school",
    description: event.description || "",
  };
}

function getEventTypeClass(type) {
  if (type === "assessment") return "admin-event-chip admin-event-chip--assessment";
  if (type === "section") return "admin-event-chip admin-event-chip--section";
  return "admin-event-chip admin-event-chip--school";
}

export default function AdminCalendarPage() {
  const [events, setEvents] = useState([]);
  const [sections, setSections] = useState([]);
  const [form, setForm] = useState(DEFAULT_EVENT);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    try {
      const [eventsData, sectionsData] = await Promise.all([adminApi.calendar(), adminApi.sections()]);
      const loadedEvents = eventsData.events || [];
      setEvents(loadedEvents);
      setSections(sectionsData.sections || []);
      if (selectedEventId) {
        const nextEvent = loadedEvents.find((event) => event.id === selectedEventId);
        if (nextEvent) {
          setEditForm(createEventEditForm(nextEvent));
        }
      }
    } catch (loadError) {
      setError(loadError.message);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const selectedEvent = events.find((event) => event.id === selectedEventId) || events[0] || null;

  useEffect(() => {
    if (selectedEvent && selectedEvent.id !== selectedEventId) {
      setSelectedEventId(selectedEvent.id);
    }
    if (selectedEvent) {
      setEditForm(createEventEditForm(selectedEvent));
    } else {
      setEditForm(null);
    }
  }, [selectedEventId, selectedEvent]);

  const eventSummary = useMemo(
    () => ({
      school: events.filter((event) => event.event_type === "school").length,
      assessment: events.filter((event) => event.event_type === "assessment").length,
      section: events.filter((event) => event.event_type === "section").length,
    }),
    [events]
  );

  return (
    <AdminPageShell
      badge="Manage School Calendar"
      title="School-wide and section events"
      description="Use this to track school activities, assessments, and section-linked dates before they surface to teacher and student views."
      metrics={[
        { label: "Events", value: events.length || "-", caption: "Calendar rows in scope" },
        { label: "School", value: eventSummary.school, caption: "School-wide date markers" },
        { label: "Assessment", value: eventSummary.assessment, caption: "Testing and deadline windows" },
        { label: "Section", value: eventSummary.section, caption: "Section-bound event entries" },
      ]}
    >
      <div className="page-grid page-grid--admin">
        <AdminSectionCard
          eyebrow="Manage School Calendar"
          title="Timeline directory"
          description="Review active timeline entries before creating or updating school and section events."
        >
          {error ? <div className="form-error">{error}</div> : null}
          {success ? <div className="form-success">{success}</div> : null}

          <div className="admin-calendar-grid">
            {events.map((event) => (
              <article
                className={`admin-calendar-card ${event.id === selectedEventId ? "admin-calendar-card--selected" : ""}`}
                key={event.id}
                onClick={() => {
                  setSelectedEventId(event.id);
                  setEditForm(createEventEditForm(event));
                  setSuccess("");
                }}
              >
                <div className="admin-calendar-card__header">
                  <div>
                    <p className="admin-calendar-card__eyebrow">
                      {event.section_name || event.section_id || "School-wide"}
                    </p>
                    <strong>{event.title}</strong>
                  </div>
                  <span className={getEventTypeClass(event.event_type)}>{event.event_type}</span>
                </div>
                <div className="admin-calendar-card__metrics">
                  <div>
                    <strong>Start</strong>
                    <span>{formatDateTime(event.start_at)}</span>
                  </div>
                  <div>
                    <strong>End</strong>
                    <span>{event.end_at ? formatDateTime(event.end_at) : "-"}</span>
                  </div>
                </div>
                <p className="admin-calendar-card__note">
                  {event.description || "No added description for this calendar entry yet."}
                </p>
              </article>
            ))}
          </div>
        </AdminSectionCard>

        <AdminSectionCard
          eyebrow="Selected Event"
          title="Planning spotlight"
          description="Keep the current event context visible while refining deadlines, school activities, or section-specific windows."
        >
          {selectedEvent ? (
            <div className="admin-spotlight-card">
              <div className="admin-spotlight-card__header">
                <div>
                  <p className="admin-spotlight-card__eyebrow">Selected Event</p>
                  <h3>{selectedEvent.title}</h3>
                  <p>{selectedEvent.section_name || selectedEvent.section_id || "School-wide"}</p>
                </div>
                <span className={getEventTypeClass(selectedEvent.event_type)}>{selectedEvent.event_type}</span>
              </div>

              <div className="admin-spotlight-grid">
                <div>
                  <strong>Starts</strong>
                  <span>{formatDateTime(selectedEvent.start_at)}</span>
                </div>
                <div>
                  <strong>Ends</strong>
                  <span>{formatDateTime(selectedEvent.end_at)}</span>
                </div>
                <div>
                  <strong>Visibility</strong>
                  <span>Teachers and students inherit this on their calendar surfaces.</span>
                </div>
                <div>
                  <strong>Planning note</strong>
                  <span>Use section-scoped rows for targeted assessment reminders.</span>
                </div>
              </div>

              <p className="admin-spotlight-card__note">
                {selectedEvent.description || "No additional description captured for this event."}
              </p>
            </div>
          ) : (
            <p className="empty-state">Select a calendar row to review its current planning context.</p>
          )}
        </AdminSectionCard>

        <AdminSectionCard
          eyebrow="Create Event"
          title="Assessment windows and school activities"
          description="Create school-wide or section-linked events using the same admin shell structure."
        >
          <form
            className="form-grid"
            onSubmit={async (event) => {
              event.preventDefault();
              setSaving(true);
              setError("");
              setSuccess("");
              try {
                await adminApi.createCalendarEvent({
                  ...form,
                  section_id: form.section_id ? Number(form.section_id) : null,
                });
                setForm(DEFAULT_EVENT);
                setSuccess("Calendar event created.");
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
                <CalendarRange size={18} />
                <div>
                  <strong>School cadence</strong>
                  <span>Use school-wide rows for assemblies, exams, and shared deadlines.</span>
                </div>
              </article>
              <article className="admin-mini-callout">
                <CalendarClock size={18} />
                <div>
                  <strong>Section targeting</strong>
                  <span>Choose a section only when the timing should not affect the whole campus.</span>
                </div>
              </article>
            </div>

            {[
              ["title", "Title", "text"],
              ["start_at", "Start", "datetime-local"],
              ["end_at", "End", "datetime-local"],
              ["description", "Description", "text"],
            ].map(([key, label, type]) => (
              <label className="field" key={key}>
                <span>{label}</span>
                <input
                  type={type}
                  value={form[key]}
                  onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
                />
              </label>
            ))}

            <label className="field">
              <span>Event type</span>
              <select
                value={form.event_type}
                onChange={(event) => setForm((current) => ({ ...current, event_type: event.target.value }))}
              >
                <option value="school">School</option>
                <option value="assessment">Assessment</option>
                <option value="section">Section</option>
              </select>
            </label>

            <label className="field">
              <span>Section</span>
              <select
                value={form.section_id}
                onChange={(event) => setForm((current) => ({ ...current, section_id: event.target.value }))}
              >
                <option value="">School-wide</option>
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.name}
                  </option>
                ))}
              </select>
            </label>

            <button className="primary-button" type="submit" disabled={saving}>
              {saving ? "Saving..." : "Create event"}
            </button>
          </form>
        </AdminSectionCard>

        <AdminSectionCard
          eyebrow="Update Event"
          title="Selected calendar entry"
          description="Adjust school or section events without recreating them."
        >
          {selectedEvent && editForm ? (
            <form
              className="form-grid"
              onSubmit={async (event) => {
                event.preventDefault();
                setSaving(true);
                setError("");
                setSuccess("");
                try {
                  await adminApi.updateCalendarEvent(selectedEvent.id, {
                    ...editForm,
                    section_id: editForm.section_id ? Number(editForm.section_id) : null,
                  });
                  setSuccess("Calendar event updated.");
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
                  <NotebookPen size={18} />
                  <div>
                    <strong>Edit carefully</strong>
                    <span>Updating a live calendar row changes the teacher and student planning surfaces too.</span>
                  </div>
                </article>
              </div>

              {[
                ["title", "Title", "text"],
                ["start_at", "Start", "datetime-local"],
                ["end_at", "End", "datetime-local"],
                ["description", "Description", "text"],
              ].map(([key, label, type]) => (
                <label className="field" key={key}>
                  <span>{label}</span>
                  <input
                    type={type}
                    value={editForm[key]}
                    onChange={(event) => setEditForm((current) => ({ ...current, [key]: event.target.value }))}
                  />
                </label>
              ))}

              <label className="field">
                <span>Event type</span>
                <select
                  value={editForm.event_type}
                  onChange={(event) => setEditForm((current) => ({ ...current, event_type: event.target.value }))}
                >
                  <option value="school">School</option>
                  <option value="assessment">Assessment</option>
                  <option value="section">Section</option>
                </select>
              </label>

              <label className="field">
                <span>Section</span>
                <select
                  value={editForm.section_id}
                  onChange={(event) => setEditForm((current) => ({ ...current, section_id: event.target.value }))}
                >
                  <option value="">School-wide</option>
                  {sections.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.name}
                    </option>
                  ))}
                </select>
              </label>

              <button className="primary-button" type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save event changes"}
              </button>
            </form>
          ) : (
            <p className="empty-state">Select a calendar row to edit it.</p>
          )}
        </AdminSectionCard>
      </div>
    </AdminPageShell>
  );
}
