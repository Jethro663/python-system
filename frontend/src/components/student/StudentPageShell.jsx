import { Sparkles } from "lucide-react";

const STUDENT_ACCENTS = ["sun", "leaf", "ocean", "plum"];

export function StudentPageShell({
  badge = "Student Space",
  title,
  description,
  metrics = [],
  actions = null,
  icon: Icon = Sparkles,
  meta = null,
  children,
}) {
  return (
    <div className="student-page student-page-shell">
      <section className="student-panel student-play-panel student-hero-card">
        <div className="student-hero-card__glow student-hero-card__glow--left" />
        <div className="student-hero-card__glow student-hero-card__glow--right" />
        <div className="student-hero-card__content">
          <div className="student-hero-card__copy">
            <div className="student-kicker">
              <Icon size={14} />
              <span>{badge}</span>
            </div>
            <div>
              <h1 className="student-hero-card__title">{title}</h1>
              <p className="student-hero-card__description">{description}</p>
              {meta ? <div className="student-hero-card__meta">{meta}</div> : null}
            </div>
          </div>
          {actions ? <div className="student-hero-card__actions">{actions}</div> : null}
        </div>

        {metrics.length ? (
          <div className="student-stat-grid">
            {metrics.map((metric, index) => (
              <article
                className="student-stat-card"
                data-accent={STUDENT_ACCENTS[index % STUDENT_ACCENTS.length]}
                key={metric.label}
              >
                <p className="student-stat-card__label">{metric.label}</p>
                <div className="student-stat-card__value">{metric.value}</div>
                {metric.caption ? <p className="student-stat-card__caption">{metric.caption}</p> : null}
              </article>
            ))}
          </div>
        ) : null}
      </section>

      <section className="page-stack">{children}</section>
    </div>
  );
}

export function StudentSectionCard({
  eyebrow,
  title,
  description,
  actions = null,
  action = null,
  children,
}) {
  const resolvedAction = actions || action;
  return (
    <section className="student-section-card">
      <div className="student-section-card__header">
        <div>
          {eyebrow ? <p className="student-section-card__eyebrow">{eyebrow}</p> : null}
          <h2 className="student-section-card__title">{title}</h2>
          {description ? <p className="student-section-card__description">{description}</p> : null}
        </div>
        {resolvedAction ? <div className="student-section-card__actions">{resolvedAction}</div> : null}
      </div>
      {children}
    </section>
  );
}
