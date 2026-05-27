import { ShieldCheck } from "lucide-react";

const ADMIN_ACCENTS = ["crimson", "amber", "sky", "forest"];

export function AdminPageShell({
  badge = "Admin Workspace",
  title,
  description,
  metrics = [],
  actions = null,
  icon: Icon = ShieldCheck,
  meta = null,
  children,
}) {
  return (
    <div className="admin-page">
      <section className="admin-page-header">
        <div className="admin-page-header__copy">
          <div className="admin-page-header__icon">
            <Icon size={20} />
          </div>
          <div>
            <p className="admin-page-header__eyebrow">{badge}</p>
            <h1 className="admin-page-header__title">{title}</h1>
            <p className="admin-page-header__description">{description}</p>
            {meta ? <div className="admin-page-header__meta">{meta}</div> : null}
          </div>
        </div>
        {actions ? <div className="admin-page-header__actions">{actions}</div> : null}
      </section>

      {metrics.length ? (
        <section className="admin-stat-grid">
          {metrics.map((metric, index) => (
            <article
              className="admin-stat-card"
              data-accent={ADMIN_ACCENTS[index % ADMIN_ACCENTS.length]}
              key={metric.label}
            >
              <p className="admin-stat-card__label">{metric.label}</p>
              <div className="admin-stat-card__value">{metric.value}</div>
              {metric.caption ? <p className="admin-stat-card__caption">{metric.caption}</p> : null}
            </article>
          ))}
        </section>
      ) : null}

      <section className="page-stack">{children}</section>
    </div>
  );
}

export function AdminSectionCard({
  eyebrow,
  title,
  description,
  actions = null,
  action = null,
  children,
}) {
  const resolvedAction = actions || action;
  return (
    <section className="admin-section-card">
      <div className="admin-section-card__header">
        <div>
          {eyebrow ? <p className="admin-section-card__eyebrow">{eyebrow}</p> : null}
          <h2 className="admin-section-card__title">{title}</h2>
          {description ? <p className="admin-section-card__description">{description}</p> : null}
        </div>
        {resolvedAction ? <div className="admin-section-card__actions">{resolvedAction}</div> : null}
      </div>
      {children}
    </section>
  );
}
