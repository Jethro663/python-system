import { useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, ShieldCheck, Upload, Users } from "lucide-react";

import { AdminPageShell, AdminSectionCard } from "../components/admin/AdminPageShell";
import { adminApi } from "../lib/api";

export default function AdminRosterImportPage() {
  const [sections, setSections] = useState([]);
  const [sectionId, setSectionId] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [working, setWorking] = useState(false);

  useEffect(() => {
    adminApi
      .sections()
      .then((data) => setSections(data.sections || []))
      .catch((sectionsError) => setError(sectionsError.message));
  }, []);

  const selectedSection = useMemo(
    () => sections.find((section) => String(section.id) === String(sectionId)) || null,
    [sections, sectionId]
  );

  return (
    <AdminPageShell
      badge="Roster Import"
      title="CSV-first student intake"
      description="This is the translated capstone priority path: preview, validate, then commit roster rows into user and enrollment data."
      metrics={[
        { label: "Sections", value: sections.length || "-", caption: "Available import targets" },
        { label: "Preview Rows", value: preview?.summary.total_rows ?? "-", caption: "Rows loaded in the current preview" },
        { label: "Valid", value: preview?.summary.valid_rows ?? "-", caption: "Rows ready for commit" },
        { label: "Duplicates", value: preview?.summary.duplicate_rows ?? "-", caption: "Rows already present in the system" },
      ]}
    >
      <div className="page-grid page-grid--admin">
        <AdminSectionCard
          eyebrow="Roster Import"
          title="Upload and preview a section roster"
          description="Select a target section, preview the CSV payload, then commit the valid rows."
        >
          <div className="admin-form-callout-grid">
            <article className="admin-mini-callout">
              <FileSpreadsheet size={18} />
              <div>
                <strong>Preview first</strong>
                <span>Validate every row before any user or enrollment records are created.</span>
              </div>
            </article>
            <article className="admin-mini-callout">
              <ShieldCheck size={18} />
              <div>
                <strong>Duplicate guard</strong>
                <span>Existing learners stay visible in preview so roster imports do not silently overwrite them.</span>
              </div>
            </article>
          </div>

          <div className="form-grid">
            <label className="field">
              <span>Target section</span>
              <select value={sectionId} onChange={(event) => setSectionId(event.target.value)}>
                <option value="">Select a section</option>
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.name} - {section.grade_level}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Roster CSV</span>
              <input
                type="file"
                accept=".csv"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
              />
            </label>

            {error ? <div className="form-error">{error}</div> : null}
            {success ? <div className="form-success">{success}</div> : null}

            <button
              className="primary-button"
              disabled={!sectionId || !file || working}
              onClick={async () => {
                const formData = new FormData();
                formData.append("section_id", sectionId);
                formData.append("file", file);
                setWorking(true);
                setError("");
                setSuccess("");
                try {
                  const data = await adminApi.previewRoster(formData);
                  setPreview(data);
                  setSuccess("Roster preview loaded.");
                } catch (previewError) {
                  setError(previewError.message);
                } finally {
                  setWorking(false);
                }
              }}
            >
              {working ? "Previewing..." : "Preview import"}
            </button>
          </div>
        </AdminSectionCard>

        <AdminSectionCard
          eyebrow="Selected Target"
          title="Import spotlight"
          description="Keep the target section and current preview health visible before committing an enrollment batch."
        >
          <div className="admin-spotlight-card">
            <div className="admin-spotlight-card__header">
              <div>
                <p className="admin-spotlight-card__eyebrow">Current Section</p>
                <h3>{selectedSection?.name || "No section selected"}</h3>
                <p>{selectedSection ? `${selectedSection.grade_level} • ${selectedSection.school_year}` : "Pick a section to scope the import."}</p>
              </div>
              <span className="admin-tag-chip">
                {preview ? `${preview.summary.valid_rows}/${preview.summary.total_rows} valid` : "Awaiting preview"}
              </span>
            </div>

            <div className="admin-spotlight-grid">
              <div>
                <strong>Schedule</strong>
                <span>{selectedSection?.schedule_text || "Schedule not set"}</span>
              </div>
              <div>
                <strong>CSV chosen</strong>
                <span>{file?.name || "No file chosen yet"}</span>
              </div>
              <div>
                <strong>Import stage</strong>
                <span>{preview ? "Validation complete. Ready to commit when satisfied." : "Upload a CSV and inspect the rows first."}</span>
              </div>
              <div>
                <strong>Failure mode</strong>
                <span>Validation errors remain visible so the admin can fix the sheet before commit.</span>
              </div>
            </div>
          </div>
        </AdminSectionCard>

        {preview ? (
          <AdminSectionCard
            eyebrow="Preview Result"
            title="Import summary"
            description="Validate totals, duplicates, and row-level values before committing the roster."
            actions={
              <div className="stats-inline">
                <span>{preview.summary.total_rows} rows</span>
                <span>{preview.summary.valid_rows} valid</span>
                <span>{preview.summary.duplicate_rows} duplicates</span>
                <span>{preview.summary.error_rows} errors</span>
              </div>
            }
          >
            <div className="admin-roster-summary-grid">
              <article className="admin-roster-summary-card">
                <Users size={18} />
                <div>
                  <strong>{preview.summary.total_rows}</strong>
                  <span>rows captured from the uploaded roster file</span>
                </div>
              </article>
              <article className="admin-roster-summary-card">
                <Upload size={18} />
                <div>
                  <strong>{preview.summary.valid_rows}</strong>
                  <span>rows ready to become students and enrollments</span>
                </div>
              </article>
            </div>

            <div className="admin-roster-preview-grid">
              {preview.rows.map((row) => (
                <article className="admin-roster-preview-card" key={`${row.school_id}-${row.email}`}>
                  <div className="admin-roster-preview-card__header">
                    <div>
                      <p className="admin-roster-preview-card__eyebrow">{row.school_id}</p>
                      <strong>{row.first_name} {row.last_name}</strong>
                    </div>
                    <span className={`admin-status-chip ${row.duplicate ? "admin-status-chip--suspended" : "admin-status-chip--active"}`}>
                      {row.duplicate ? "Duplicate" : "Clear"}
                    </span>
                  </div>
                  <div className="admin-roster-preview-card__metrics">
                    <div>
                      <strong>Email</strong>
                      <span>{row.email}</span>
                    </div>
                    <div>
                      <strong>Grade level</strong>
                      <span>{row.grade_level || "-"}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            {preview.validation_errors?.length ? (
              <div className="form-error">
                {preview.validation_errors.map((item) => item.message).join(" | ")}
              </div>
            ) : null}

            <button
              className="primary-button"
              disabled={working || preview.summary.valid_rows === 0}
              onClick={async () => {
                setWorking(true);
                setError("");
                setSuccess("");
                try {
                  await adminApi.importRoster({
                    section_id: Number(sectionId),
                    rows: preview.rows,
                  });
                  setPreview(null);
                  setFile(null);
                  setSuccess("Roster import committed.");
                } catch (importError) {
                  setError(importError.message);
                } finally {
                  setWorking(false);
                }
              }}
            >
              {working ? "Importing..." : "Commit import"}
            </button>
          </AdminSectionCard>
        ) : null}
      </div>
    </AdminPageShell>
  );
}
