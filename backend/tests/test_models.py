from models import (
    Assignment,
    DiscussionReply,
    DiscussionThread,
    Role,
    Section,
    Submission,
    SystemSetting,
    User,
)


def test_phase_one_models_expose_expected_tables():
    assert Role.__tablename__ == "roles"
    assert User.__tablename__ == "users"
    assert Section.__tablename__ == "sections"
    assert Assignment.__tablename__ == "assignments"
    assert DiscussionThread.__tablename__ == "discussion_threads"
    assert DiscussionReply.__tablename__ == "discussion_replies"
    assert Submission.__tablename__ == "submissions"
    assert SystemSetting.__tablename__ == "system_settings"
