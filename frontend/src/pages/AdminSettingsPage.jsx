import { useEffect, useState } from "react";
import { GraduationCap, RefreshCcw, SlidersHorizontal } from "lucide-react";

import { AdminPageShell, AdminSectionCard } from "../components/admin/AdminPageShell";
import { adminApi } from "../lib/api";

export default function AdminSettingsPage() {
  const [form, setForm] = useState({
    active_school_year: "",
    active_quarter: "",
    mastery_threshold: "",
    upload_limit_mb: "",
  });
  const [transitionForm, setTransitionForm] = useState({
    next_school_year: "",
    next_quarter: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => {
    adminApi
      .settings()
      .then((data) => {
        const nextForm = {
          active_school_year: data.settings.active_school_year || "",
          active_quarter: data.settings.active_quarter || "",
          mastery_threshold: data.settings.mastery_threshold || "",
          upload_limit_mb: data.settings.upload_limit_mb || "",
        };
        setForm(nextForm);
        setTransitionForm({
          next_school_year: nextForm.active_school_year,
          next_quarter: nextForm.active_quarter,
        });
      })
      .catch((settingsError) => setError(settingsError.message));
  }, []);

  return (
    <AdminPageShell
      badge="System Settings"
      title="Academic and mastery defaults"
      description="This aligns to the checklist scope: active school year, active quarter, mastery threshold, and upload limits."
      icon={SlidersHorizontal}
      meta={
        <>
          <span>{form.active_school_year || "year not set"}</span>
          <span>{form.active_quarter || "quarter not set"}</span>
          <span>{form.mastery_threshold || "-"} mastery</span>
        </>
      }
      metrics={[
        { label: "Active School Year", value: form.active_school_year || "-", caption: "Current admin-wide year" },
        { label: "Active Quarter", value: form.active_quarter || "-", caption: "Current academic phase" },
        { label: "Mastery Threshold", value: form.mastery_threshold || "-", caption: "Passing percentage rule" },
        { label: "Upload Limit", value: form.upload_limit_mb ? `${form.upload_limit_mb} MB` : "-", caption: "Current file intake cap" },
      ]}
    >
      <div className="page-grid page-grid--admin">
        <AdminSectionCard
          eyebrow="System Settings"
          title="Academic and mastery defaults"
          description="The values here shape how the rest of the LMS behaves before teacher or student actions begin."
        >
          <form
            className="form-grid"
            onSubmit={async (event) => {
              event.preventDefault();
              setSaving(true);
              setError("");
              setSuccess("");
              try {
                const data = await adminApi.updateSettings(form);
                setForm({
                  active_school_year: data.settings.active_school_year || "",
                  active_quarter: data.settings.active_quarter || "",
                  mastery_threshold: data.settings.mastery_threshold || "",
                  upload_limit_mb: data.settings.upload_limit_mb || "",
                });
                setSuccess("System settings updated.");
              } catch (saveError) {
                setError(saveError.message);
              } finally {
                setSaving(false);
              }
            }}
          >
            <div className="admin-form-callout-grid">
              <article className="admin-mini-callout">
                <SlidersHorizontal size={18} />
                <div>
                  <strong>Platform defaults</strong>
                  <span>These values influence how the rest of the workflow behaves before class activity even starts.</span>
                </div>
              </article>
            </div>

            {[
              ["active_school_year", "Active school year"],
              ["active_quarter", "Active quarter"],
              ["mastery_threshold", "Mastery threshold"],
              ["upload_limit_mb", "Upload limit (MB)"],
            ].map(([key, label]) => (
              <label className="field" key={key}>
                <span>{label}</span>
                <input
                  value={form[key]}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, [key]: event.target.value }))
                  }
                />
              </label>
            ))}

            {error ? <div className="form-error">{error}</div> : null}
            {success ? <div className="form-success">{success}</div> : null}

            <button className="primary-button" type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save settings"}
            </button>
          </form>
        </AdminSectionCard>

      <AdminSectionCard
        eyebrow="Academic Transition"
        title="Archive the current quarter and reset flags"
        description="This simplified workflow moves the active quarter forward and clears open support flags for the new quarter."
        action={<span className="admin-tag-chip">Rollover</span>}
      >
          <div className="admin-spotlight-card">
            <div className="admin-spotlight-card__header">
              <div>
                <p className="admin-spotlight-card__eyebrow">Current Academic State</p>
                <h3>{form.active_school_year || "No school year set"}</h3>
                <p>{form.active_quarter || "No quarter set"}</p>
              </div>
              <span className="admin-tag-chip">{form.mastery_threshold || "-"} mastery</span>
            </div>
            <div className="admin-spotlight-grid">
              <div>
                <strong>Next year</strong>
                <span>{transitionForm.next_school_year || "Pending"}</span>
              </div>
              <div>
                <strong>Next quarter</strong>
                <span>{transitionForm.next_quarter || "Pending"}</span>
              </div>
              <div>
                <strong>Transition rule</strong>
                <span>Open support flags are reset when the academic state advances.</span>
              </div>
              <div>
                <strong>Use case</strong>
                <span>Run this when the school year or quarter boundary actually changes.</span>
              </div>
            </div>
          </div>

          <form
            className="form-grid"
            onSubmit={async (event) => {
              event.preventDefault();
              setTransitioning(true);
              setError("");
              setSuccess("");
              try {
                const data = await adminApi.runAcademicTransition(transitionForm);
                setForm((current) => ({
                  ...current,
                  active_school_year: data.settings.active_school_year || current.active_school_year,
                  active_quarter: data.settings.active_quarter || current.active_quarter,
                }));
                setTransitionForm({
                  next_school_year: data.settings.active_school_year || "",
                  next_quarter: data.settings.active_quarter || "",
                });
                setSuccess(
                  `Academic transition complete. Reset support flags: ${data.summary.reset_interventions}.`
                );
              } catch (transitionError) {
                setError(transitionError.message);
              } finally {
                setTransitioning(false);
              }
            }}
          >
            <div className="admin-form-callout-grid">
              <article className="admin-mini-callout">
                <GraduationCap size={18} />
                <div>
                  <strong>Academic rollover</strong>
                  <span>Advance the school state deliberately so historical sections and support cleanup stay coherent.</span>
                </div>
              </article>
              <article className="admin-mini-callout">
                <RefreshCcw size={18} />
                <div>
                  <strong>Reset effect</strong>
                  <span>This is the administrative checkpoint that clears open support flags for the new quarter.</span>
                </div>
              </article>
            </div>

            <label className="field">
              <span>Next school year</span>
              <input
                value={transitionForm.next_school_year}
                onChange={(event) =>
                  setTransitionForm((current) => ({
                    ...current,
                    next_school_year: event.target.value,
                  }))
                }
              />
            </label>

            <label className="field">
              <span>Next quarter</span>
              <input
                value={transitionForm.next_quarter}
                onChange={(event) =>
                  setTransitionForm((current) => ({
                    ...current,
                    next_quarter: event.target.value,
                  }))
                }
              />
            </label>

            {error ? <div className="form-error">{error}</div> : null}
            {success ? <div className="form-success">{success}</div> : null}

            <button className="primary-button" type="submit" disabled={transitioning}>
              {transitioning ? "Transitioning..." : "Run academic transition"}
            </button>
          </form>
        </AdminSectionCard>
      </div>
    </AdminPageShell>
  );
}
