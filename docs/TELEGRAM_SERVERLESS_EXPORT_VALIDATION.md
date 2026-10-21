# Read-only export validation

This preflight validator checks a sanitized JSON export before an authorized operator imports it into Telegram Serverless. It does not connect to PostgreSQL, write data, deploy code, or change the Telegram webhook.

## Input format

Provide JSON with `formatVersion: 1` and a `tables` object containing an array for each mapped table in `tgcloud/schema.js`. Use the exact source table names, include empty arrays for empty tables, and include all rows from a consistent snapshot. Do not commit production exports, personal data, tokens, or credentials to Git.

## Checks performed

- All mapped tables are present as arrays.
- Rows are objects and required primary/composite key fields are present.
- Primary/composite keys are unique within each table.
- Giveaway-related rows reference a giveaway that exists in the same export.
- Unknown additional tables are reported as warnings.
- Row counts are returned for comparison with a staging import.

## Tests

The pure validator tests run in GitHub Actions with Node's built-in test runner. The helper is designed for local validation of a sanitized export file; it does not include a database exporter or importer.

## Mandatory cutover gates

Before production migration, verify source/destination column parity (including dynamically created tables/columns), convert PostgreSQL timestamps to the destination schema's expected Unix-second representation, preserve JSONB values, and avoid lossy numeric conversion of Telegram identifiers. Test all features in staging, verify backups and rollback, and obtain explicit production authorization before importing data or changing the webhook. Pushing code does not migrate database data.
