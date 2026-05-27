# Python System Database Design

## Goal

Define the real development database approach for the Python System backend using a MySQL-first relational schema derived from `Nexora-Python-Final-Project-Checklist.docx`.

This design makes SQLAlchemy models and migrations the source of truth. A local SQLite file such as `backend/database.db` may exist for temporary development, but it is not the authoritative schema artifact.

## Decision

Use:

- Flask app factory structure
- Flask-SQLAlchemy for models and session management
- Flask-Migrate/Alembic for schema migrations
- MySQL as the real development database

Do not use:

- hand-written schema directly inside `backend/database.db` as the primary source of truth
- SQLite-only table design that will later need to be translated to MySQL
- direct ad hoc schema edits outside migrations

## Why This Approach

This project is already large enough that raw SQL in a local `.db` file will create drift quickly. The checklist also defines a relational system with many connected tables, role-scoped behavior, and future changes around grading, interventions, reports, and AI outputs. Versioned models plus migrations are the safest baseline.

## Architecture

The backend data layer should be split into four responsibilities:

1. App configuration initializes database settings from environment variables.
2. SQLAlchemy models define entities, relationships, constraints, and indexes.
3. Alembic migrations create and evolve the schema.
4. Seed routines insert baseline roles, system settings, and demo-safe development data.

Recommended backend structure:

- `backend/app.py`: app factory, config loading, extension initialization
- `backend/extensions.py`: shared extension instances such as `db`, `migrate`, and optionally `login_manager`
- `backend/models.py`: initial model exports or model registry
- `backend/models/`: optional later split by domain if the file grows too large
- `backend/migrations/`: Alembic migration history
- `backend/config.py`: environment-aware database configuration
- `backend/seeds/`: baseline seed scripts

## Database Authority

Authority order:

1. SQLAlchemy models
2. Migration files
3. Live MySQL schema
4. Optional local SQLite development file

`backend/database.db` should be treated as disposable local state if used at all. It should not be manually edited and should not be considered the canonical schema.

## Initial Domain Model

The first migration should cover the checklist MVP tables first and leave optional AI/discussion detail tables available for a second pass if needed. However, the schema should be designed so optional tables can be added without breaking the core LMS flow.

### Core Identity Tables

- `roles`
  - columns: `id`, `name`, `created_at`, `updated_at`
  - constraints: unique `name`
- `users`
  - columns: `id`, `school_id`, `role_id`, `first_name`, `last_name`, `email`, `password_hash`, `status`, `last_login_at`, `created_at`, `updated_at`
  - constraints: unique `school_id`, unique `email`
  - relationship: many users belong to one role
- `teacher_profiles`
  - columns: `id`, `user_id`, `department`, `phone`, `created_at`, `updated_at`
  - constraints: unique `user_id`
- `student_profiles`
  - columns: `id`, `user_id`, `grade_level`, `guardian_name`, `guardian_contact`, `created_at`, `updated_at`
  - constraints: unique `user_id`

### Academic Structure Tables

- `sections`
  - columns: `id`, `name`, `grade_level`, `school_year`, `adviser_user_id`, `status`, `created_at`, `updated_at`
- `section_teachers`
  - columns: `id`, `section_id`, `teacher_user_id`, `subject_name`, `created_at`, `updated_at`
  - constraints: unique composite on `section_id`, `teacher_user_id`, `subject_name`
- `enrollments`
  - columns: `id`, `student_user_id`, `section_id`, `status`, `enrolled_at`, `created_at`, `updated_at`
  - constraints: unique composite on `student_user_id`, `section_id`
- `subjects`
  - columns: `id`, `code`, `name`, `grade_level`, `created_at`, `updated_at`
  - optional in first migration if not yet needed by UI flows

### Teaching Content Tables

- `modules`
  - columns: `id`, `section_id`, `teacher_user_id`, `title`, `description`, `file_path`, `published_at`, `created_at`, `updated_at`
- `assignments`
  - columns: `id`, `section_id`, `teacher_user_id`, `title`, `type`, `instructions`, `due_at`, `status`, `published_at`, `created_at`, `updated_at`
- `assignment_questions`
  - columns: `id`, `assignment_id`, `question_text`, `question_type`, `choices_json`, `answer_key`, `points`, `sort_order`, `created_at`, `updated_at`

### Submission and Grading Tables

- `submissions`
  - columns: `id`, `assignment_id`, `student_user_id`, `submitted_at`, `status`, `raw_score`, `final_score`, `feedback`, `graded_at`, `created_at`, `updated_at`
  - constraints: unique composite on `assignment_id`, `student_user_id`
- `submission_answers`
  - columns: `id`, `submission_id`, `assignment_question_id`, `answer_text`, `uploaded_file_path`, `awarded_score`, `created_at`, `updated_at`
  - optional in first migration if the first milestone only stores whole-submission results
- `grades`
  - columns: `id`, `section_id`, `assignment_id`, `student_user_id`, `score`, `percentage`, `remarks`, `created_at`, `updated_at`
  - constraints: unique composite on `assignment_id`, `student_user_id`
- `interventions`
  - columns: `id`, `student_user_id`, `section_id`, `assignment_id`, `trigger_score`, `status`, `teacher_note`, `created_at`, `updated_at`, `resolved_at`

### Communication and Support Tables

- `announcements`
  - columns: `id`, `author_user_id`, `section_id`, `title`, `body`, `published_at`, `visibility`, `created_at`, `updated_at`
- `calendar_events`
  - columns: `id`, `title`, `section_id`, `start_at`, `end_at`, `event_type`, `description`, `created_at`, `updated_at`
- `resources`
  - columns: `id`, `uploader_user_id`, `section_id`, `title`, `category`, `file_path`, `visibility`, `created_at`, `updated_at`

### Platform Tables

- `audit_logs`
  - columns: `id`, `user_id`, `action`, `entity_type`, `entity_id`, `meta_json`, `created_at`
- `system_settings`
  - columns: `id`, `setting_key`, `setting_value`, `created_at`, `updated_at`
  - constraints: unique `setting_key`

### Optional AI-Lite Tables

- `generated_quizzes`
  - columns: `id`, `teacher_user_id`, `source_text`, `output_json`, `created_at`
- `pdf_extractions`
  - columns: `id`, `module_id`, `extracted_text`, `summary_text`, `created_at`
- `ai_jobs`
  - columns: `id`, `job_type`, `status`, `input_ref`, `output_ref`, `created_at`, `updated_at`

These tables should be added only after the core LMS loop is working unless the implementation cost stays low.

## Relationship Rules

Initial enforced relationships:

- one `role` to many `users`
- one `user` to zero-or-one `teacher_profile`
- one `user` to zero-or-one `student_profile`
- one `section` to many `enrollments`
- one `section` to many `section_teachers`
- one `teacher` to many `modules`
- one `teacher` to many `assignments`
- one `assignment` to many `assignment_questions`
- one `assignment` to many `submissions`
- one `submission` to many `submission_answers`
- one graded result below 74 percent may create one active intervention for the same `student_user_id`, `section_id`, and `assignment_id`

Recommended integrity rules:

- use foreign keys on all relationship columns
- use composite uniqueness where duplicate mappings would corrupt workflow
- use nullable foreign keys only when the business rule genuinely allows an unscoped record

## Data Type Guidance

Use MySQL-compatible types from day one:

- IDs: integer primary keys initially; UUIDs can be deferred
- names/titles/status fields: bounded strings
- rich text fields: `TEXT`
- scores and percentages: fixed precision decimal, not float
- timestamps: timezone-consistent `DateTime` strategy applied across all tables
- `choices_json`, `meta_json`, `output_json`: JSON type where MySQL support is available; text fallback only if tooling forces it

For scoring fields:

- `raw_score`: decimal
- `final_score`: decimal
- `score`: decimal
- `percentage`: decimal

This avoids float rounding noise in grading and intervention rules.

## Status Enums

Prefer constrained string enums in application code first, with database-level enums only if the team wants stricter database enforcement later.

Expected status families:

- user status: `active`, `suspended`, `inactive`
- section status: `active`, `archived`
- assignment status: `draft`, `published`, `closed`
- submission status: `draft`, `submitted`, `reviewed`, `graded`
- intervention status: `open`, `in_progress`, `resolved`

## Indexing Strategy

First-pass indexes should cover:

- `users.email`
- `users.school_id`
- `users.role_id`
- `sections.school_year`
- `section_teachers.section_id`
- `section_teachers.teacher_user_id`
- `enrollments.student_user_id`
- `enrollments.section_id`
- `modules.section_id`
- `assignments.section_id`
- `assignments.teacher_user_id`
- `submissions.assignment_id`
- `submissions.student_user_id`
- `grades.student_user_id`
- `grades.assignment_id`
- `interventions.student_user_id`
- `audit_logs.user_id`
- `audit_logs.created_at`

## File Storage Boundary

The database should store file metadata and relative file paths only. It should not store PDF binaries or uploaded documents directly in table blobs for the MVP.

Store in the database:

- original filename if needed later
- normalized relative storage path
- content category
- uploader or owner reference

Store on disk:

- uploaded modules
- assignment files
- resource files
- roster imports
- export outputs

## Migration Plan

Phase 1 migration scope:

- roles
- users
- teacher_profiles
- student_profiles
- sections
- section_teachers
- enrollments
- modules
- assignments
- assignment_questions
- submissions
- grades
- interventions
- announcements
- calendar_events
- resources
- audit_logs
- system_settings

Phase 2 migration scope:

- subjects
- submission_answers
- discussion tables
- AI-lite tables

## Seed Data Plan

Initial seed set should include:

- roles: `admin`, `teacher`, `student`
- baseline system settings:
  - `active_school_year`
  - `active_quarter`
  - `mastery_threshold`
  - `upload_limit_mb`
- one admin account for bootstrap access
- optional demo teacher, student, section, and enrollment set for early UI work

## Application Logic Boundaries

The schema should support, but not fully encode, the following rules:

- role-based access belongs mainly in application logic
- intervention creation is triggered by grading logic when percentage is below `mastery_threshold`
- remedial visibility is derived from intervention or low-grade state, not duplicated unnecessarily across many tables
- reports should read from normalized transactional tables first, not from denormalized summary tables in the first version

## Better Than Writing Directly Into `database.db`

The better real-development approach is:

1. define models
2. configure MySQL connection from environment
3. initialize migration tooling
4. generate the first migration
5. apply the migration to MySQL
6. optionally allow SQLite only as a local compatibility mode

This is better than directly creating tables in `backend/database.db` because:

- schema changes become traceable
- MySQL mismatches are caught early
- constraints live in code and migrations together
- onboarding is simpler for future contributors
- the database can be recreated reliably in any environment

## Risks

- if development starts on SQLite-only behavior, MySQL incompatibilities may appear later
- if JSON and enum handling are inconsistent, migrations will drift
- if `models.py` becomes a monolith too early, maintenance cost will rise
- if files are stored in the database instead of on disk, the MVP will become harder to manage

## Recommendation

Proceed with a MySQL-first schema implementation and keep `backend/database.db` non-authoritative. If a local SQLite path is still useful, wire it as a development fallback through config rather than building the project around it.

## Implementation Entry Criteria

Before implementation starts, the next step should produce:

- Flask app factory initialization
- `db` and `migrate` extension setup
- initial SQLAlchemy models for the phase 1 tables
- migration bootstrap
- environment configuration for MySQL and optional SQLite fallback

