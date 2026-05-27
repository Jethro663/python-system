import { BarChart3 } from "lucide-react";

const TEACHER_ACCENTS = ["sky", "teal", "amber", "rose"];

export function TeacherPageShell({
  badge = "Teacher Workspace",
  title,
  description,
  metrics = [],
  actions = null,
  icon: Icon = BarChart3,
  headerMeta = null,
  children,
}) {
  return (
    <div className="teacher-page">
      <section className="teacher-figma-header">
        <div className="teacher-figma-header__copy">
          <div className="teacher-figma-header__icon">
            <Icon size={20} />
          </div>
          <div>
            <p className="teacher-figma-header__badge">{badge}</p>
            <h1 className="teacher-figma-header__title">{title}</h1>
            <p className="teacher-figma-header__description">{description}</p>
            {headerMeta ? <div className="teacher-figma-header__meta">{headerMeta}</div> : null}
          </div>
        </div>
        {actions ? <div className="teacher-figma-header__actions">{actions}</div> : null}
      </section>

      {metrics.length ? (
        <section className="teacher-figma-metric-grid">
          {metrics.map((metric, index) => (
            <article
              className="teacher-figma-stat"
              data-accent={TEACHER_ACCENTS[index % TEACHER_ACCENTS.length]}
              key={metric.label}
            >
              <p className="teacher-figma-stat__label">{metric.label}</p>
              <div className="teacher-figma-stat__value">{metric.value}</div>
              {metric.caption ? <p className="teacher-figma-stat__caption">{metric.caption}</p> : null}
            </article>
          ))}
        </section>
      ) : null}

      <section className="page-stack">{children}</section>
    </div>
  );
}

export function TeacherSectionCard({
  eyebrow,
  title,
  description,
  actions = null,
  action = null,
  children,
}) {
  const resolvedAction = actions || action;
  return (
    <section className="teacher-section-card teacher-figma-card">
      <div className="teacher-section-card__header">
        <div>
          {eyebrow ? <p className="teacher-section-card__eyebrow">{eyebrow}</p> : null}
          <h2 className="teacher-section-card__title">{title}</h2>
          {description ? <p className="teacher-section-card__description">{description}</p> : null}
        </div>
        {resolvedAction ? <div className="teacher-section-card__actions">{resolvedAction}</div> : null}
      </div>
      {children}
    </section>
  );
}
