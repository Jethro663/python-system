from extensions import db
from models import AuditLog


def write_audit_log(user_id, action, entity_type, entity_id=None, meta_json=None):
    entry = AuditLog(
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        meta_json=meta_json or {},
    )
    db.session.add(entry)
    db.session.commit()
    return entry
