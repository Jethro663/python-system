from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required, login_user, logout_user

from models import User
from services.audit import write_audit_log


auth_bp = Blueprint("auth", __name__)


@auth_bp.post("/login")
def login():
    payload = request.get_json(silent=True) or {}
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password) or user.status != "active":
        return jsonify({"message": "Invalid credentials."}), 401

    login_user(user)
    write_audit_log(
        user_id=user.id,
        action="auth.login",
        entity_type="user",
        entity_id=user.id,
        meta_json={"email": user.email},
    )
    return jsonify({"authenticated": True, "user": user.to_dict()})


@auth_bp.post("/logout")
@login_required
def logout():
    write_audit_log(
        user_id=current_user.id,
        action="auth.logout",
        entity_type="user",
        entity_id=current_user.id,
        meta_json={"email": current_user.email},
    )
    logout_user()
    return jsonify({"authenticated": False})


@auth_bp.get("/me")
def me():
    if not current_user.is_authenticated:
        return jsonify({"authenticated": False, "user": None}), 200

    return jsonify({"authenticated": True, "user": current_user.to_dict()})
