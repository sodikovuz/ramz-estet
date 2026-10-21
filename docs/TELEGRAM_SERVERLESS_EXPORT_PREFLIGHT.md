# Serverless migration export preflight

This checklist is a mandatory gate before importing data into Telegram Serverless. It is deliberately read-only: no database connection, import, deployment, or webhook changes are performed by this document.

## Before exporting

- Take a consistent snapshot from the source PostgreSQL database using an authorized operator.
- Keep the export outside Git and redact credentials, bot tokens, session tokens, and personal data from any sample fixtures.
- Record a row count for every table in the export, including runtime-created tables such as bot settings, message cleanup, processed updates, and UI state.
- Verify the exact source schema against the Serverless schema; do not assume the base SQL file contains every dynamically created column or table.

## Required data checks

- Every table mapped in tgcloud/schema.js has an export entry, even when its row count is zero.
- Primary keys and composite unique keys have no duplicates.
- Every giveaway_id reference points to an exported giveaway, except for rows explicitly documented as historical/orphaned and handled by an approved migration plan.
- Timestamp values are converted to the unit expected by the destination schema. The current Serverless schema uses Unix-second timestamp mode; do not copy PostgreSQL milliseconds or textual timestamps without conversion.
- Telegram IDs are preserved without precision loss. Do not route large identifiers through JavaScript Number if they can exceed the safe integer range.
- JSONB values are preserved as JSON values and are not accidentally double-encoded strings.
- Source and destination row counts are compared after a staging import, with table-specific exceptions documented.

## Cutover gate

Do not run tgcloud migrate, import production rows, change the Telegram webhook, or disable Vercel routes until the feature parity checklist is complete, staging acceptance tests pass, backups and rollback steps are verified, and the operator has explicit production authorization. A successful code push alone does not migrate database data.
