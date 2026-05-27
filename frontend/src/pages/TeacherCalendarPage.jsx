import { useEffect, useMemo, useState } from "react";
import { CalendarClock, ClipboardCheck, Clock3, NotebookPen } from "lucide-react";

import { TeacherPageShell, TeacherSectionCard } from "../components/teacher/TeacherPageShell";
import { teacherApi } from "../lib/api";

const EMPTY_FORM = {
  section_id: "",
  title: "",
  start_at: "",
  end_at: "",
  event_type: "deadline",
  description: "",
};

function toDatetimeLocal(value) {
  if (!value) {
    return "";
  }
  return new Date(value).toISOString().slice(0, 16);
}

function createEventEditForm(event) {
  return {
    section_id: event.section_id ? String(event.section_id) : "",
    title: event.title || "",
    start_at: toDatetimeLocal(event.start_at),
    end_at: toDatetimeLocal(event.end_at),
    event_type: event.event_type || "deadline",
    description: event.description || "",
  };
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

export default function TeacherCalendarPage() {
  const [sections, setSections] = useState([]);
  const [events, setEvents] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  const loadCalendar = async () => {
    try {
      const response = await teacherApi.calendar();
      const loadedSections = response.sections || [];
      const loadedEvents = response.events || [];
      setSections(loadedSections);
      setEvents(loadedEvents);
      if (!form.section_id && loadedSections[0]) {
        setForm((current) => ({ ...current, section_id: String(loadedSections[0].id) }));
      }
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
    loadCalendar();
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

  const eventSummary = useMemo(() => ({
    assessments: events.filter((event) => event.event_type === "assessment").length,
    deadlines: events.filter((event) => event.event_type === "deadline").length,
  }), [events]);

  return (
    <TeacherPageShell
      badge="Teacher Calendar"
      title="Class deadlines and schedules"
      description="This page now follows the same card and action structure as the reference teacher surfaces while keeping the current Flask calendar flow."
      icon={CalendarClock}
      headerMeta={
        <>
          <span>{events.length} tracked events</span>
          <span>{eventSummary.deadlines} deadlines</span>
          <span>{eventSummary.assessments} assessments</span>
        </>
      }
      metrics={[
        { label: "Tracked Events", value: events.length || "-", caption: "Across your assigned classes" },
        { label: "Available Sections", value: sections.length || "-", caption: "Classes you can schedule against" },
        { label: "Deadlines", value: eventSummary.deadlines, caption: "Active deadline markers" },
        { label: "Assessments", value: eventSummary.assessments, caption: "Assessment windows currently tracked" },
      ]}
    >
      {error ? <div className="form-error">{error}</div> : null}
      {success ? <div className="form-success">{success}</div> : null}

      <TeacherSectionCard
        eyebrow="Schedule Feed"
        title="Current calendar items"
        description="Review upcoming deadlines, assessments, and meetings linked to your classes."
        action={<span className="admin-tag-chip">Live calendar</span>}
      >
        <div className="teacher-calendar-grid">
          {events.map((event) => (
            <article
              className={`teacher-calendar-card ${event.id === selectedEventId ? "teacher-calendar-card--selected" : ""}`}
              key={event.id}
              onClick={() => {
                setSelectedEventId(event.id);
                setEditForm(createEventEditForm(event));
                setSuccess("");
              }}
            >
              <div className="teacher-calendar-card__hero">
                <div>
                  <p className="teacher-calendar-card__eyebrow">{event.section_name || event.section_id || "Class-wide"}</p>
                  <strong>{event.title}</strong>
                </div>
                <span className="teacher-record-pill teacher-record-pill--pending">{event.event_type}</span>
              </div>
              <div className="teacher-calendar-card__metrics">
                <div>
                  <strong>Start</strong>
                  <span>{formatDateTime(event.start_at)}</span>
                </div>
                <div>
                  <strong>End</strong>
                  <span>{formatDateTime(event.end_at)}</span>
                </div>
              </div>
              <p className="teacher-calendar-card__note">
                {event.description || "No added description for this class event yet."}
              </p>
            </article>
          ))}
        </div>
      </TeacherSectionCard>

      <TeacherSectionCard
        eyebrow="Create Event"
        title="Add a deadline or class event"
        description="Use the same teacher shell to create assessment windows, review sessions, and meeting reminders."
      >
        <form
          className="teacher-filter-grid"
          onSubmit={async (event) => {
            event.preventDefault();
            setSaving(true);
            setError("");
            setSuccess("");
            try {
              await teacherApi.createCalendarEvent(form);
              setForm((current) => ({ ...EMPTY_FORM, section_id: current.section_id }));
              setSuccess("Calendar event created.");
              await loadCalendar();
            } catch (saveError) {
              setError(saveError.message);
            } finally {
              setSaving(false);
            }
          }}
        >
          <div className="teacher-calendar-callout-grid">
            <article className="admin-mini-callout">
              <CalendarClock size={18} />
              <div>
                <strong>Planning lane</strong>
                <span>Use this for deadlines, reviews, and assessment windows students should see in advance.</span>
              </div>
            </article>
            <article className="admin-mini-callout">
              <ClipboardCheck size={18} />
              <div>
                <strong>Assessment rhythm</strong>
                <span>Reserve assessment markers for work that should also reinforce your results and intervention flow.</span>
              </div>
            </article>
          </div>

          <label className="field">
            <span>Section</span>
            <select value={form.section_id} onChange={(event) => setForm((current) => ({ ...current, section_id: event.target.value }))}>
              {sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Title</span>
            <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
          </label>
          <label className="field">
            <span>Start</span>
            <input type="datetime-local" value={form.start_at} onChange={(event) => setForm((current) => ({ ...current, start_at: event.target.value }))} />
          </label>
          <label className="field">
            <span>End</span>
            <input type="datetime-local" value={form.end_at} onChange={(event) => setForm((current) => ({ ...current, end_at: event.target.value }))} />
          </label>
          <label className="field">
            <span>Event type</span>
            <select value={form.event_type} onChange={(event) => setForm((current) => ({ ...current, event_type: event.target.value }))}>
              <option value="deadline">Deadline</option>
              <option value="review">Review</option>
              <option value="meeting">Meeting</option>
              <option value="assessment">Assessment</option>
            </select>
          </label>
          <label className="field">
            <span>Description</span>
            <input value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
          </label>
          <button className="primary-button" type="submit" disabled={saving}>
            {saving ? "Saving..." : "Create event"}
          </button>
        </form>
      </TeacherSectionCard>

      <TeacherSectionCard
        eyebrow="Update Event"
        title="Selected class event"
        description="Adjust deadlines and meetings without recreating them."
      >
        {selectedEvent && editForm ? (
          <form
            className="teacher-filter-grid"
            onSubmit={async (event) => {
              event.preventDefault();
              setSaving(true);
              setError("");
              setSuccess("");
              try {
                await teacherApi.updateCalendarEvent(selectedEvent.id, editForm);
                setSuccess("Calendar event updated.");
                await loadCalendar();
              } catch (saveError) {
                setError(saveError.message);
              } finally {
                setSaving(false);
              }
            }}
          >
            <div className="teacher-calendar-callout-grid">
              <article className="admin-mini-callout">
                <Clock3 size={18} />
                <div>
                  <strong>Timing changes</strong>
                  <span>Editing this event changes what the class sees in its schedule surface.</span>
                </div>
              </article>
              <article className="admin-mini-callout">
                <NotebookPen size={18} />
                <div>
                  <strong>Description note</strong>
                  <span>Use the description for concrete teacher instructions, not vague reminders.</span>
                </div>
              </article>
            </div>

            <label className="field">
              <span>Section</span>
              <select value={editForm.section_id} onChange={(event) => setEditForm((current) => ({ ...current, section_id: event.target.value }))}>
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Title</span>
              <input value={editForm.title} onChange={(event) => setEditForm((current) => ({ ...current, title: event.target.value }))} />
            </label>
            <label className="field">
              <span>Start</span>
              <input type="datetime-local" value={editForm.start_at} onChange={(event) => setEditForm((current) => ({ ...current, start_at: event.target.value }))} />
            </label>
            <label className="field">
              <span>End</span>
              <input type="datetime-local" value={editForm.end_at} onChange={(event) => setEditForm((current) => ({ ...current, end_at: event.target.value }))} />
            </label>
            <label className="field">
              <span>Event type</span>
              <select value={editForm.event_type} onChange={(event) => setEditForm((current) => ({ ...current, event_type: event.target.value }))}>
                <option value="deadline">Deadline</option>
                <option value="review">Review</option>
                <option value="meeting">Meeting</option>
                <option value="assessment">Assessment</option>
              </select>
            </label>
            <label className="field">
              <span>Description</span>
              <input value={editForm.description} onChange={(event) => setEditForm((current) => ({ ...current, description: event.target.value }))} />
            </label>
            <button className="primary-button" type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save event changes"}
            </button>
          </form>
        ) : (
          <p className="empty-state">Select a calendar row to edit it.</p>
        )}
      </TeacherSectionCard>
    </TeacherPageShell>
  );
}
