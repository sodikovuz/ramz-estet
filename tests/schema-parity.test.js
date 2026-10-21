import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const schema = await readFile(new URL('../tgcloud/schema.js', import.meta.url), 'utf8');
const sourceSchema = await readFile(new URL('../schema.sql', import.meta.url), 'utf8');
const settingsSource = await readFile(new URL('../lib/api/_settings.js', import.meta.url), 'utf8');
const groupsSource = await readFile(new URL('../lib/api/_groups.js', import.meta.url), 'utf8');

test('Serverless schema declares core giveaway and state tables', () => {
  for (const name of [
    "table('giveaways'", "table('telegram_giveaway_participants'", "table('giveaway_viewers'",
    "table('giveaway_winners'", "table('giveaway_state'", "table('admin_sessions'",
    "table('giveaway_notify_log'", "table('startapp_tokens'", "table('audit_logs'"
  ]) assert.ok(schema.includes(name), `missing declaration: ${name}`);
});

test('Serverless schema includes tables created dynamically by helper modules', () => {
  for (const name of [
    "table('bot_settings'", "table('bot_message_cleanup'", "table('telegram_processed_updates'",
    "table('bot_ui_state'", "table('telegram_chats'", "table('giveaway_chats'",
    "table('giveaway_chat_posts'", "table('giveaway_inline_posts'"
  ]) assert.ok(schema.includes(name), `missing declaration: ${name}`);
  assert.match(settingsSource, /CREATE TABLE IF NOT EXISTS bot_settings/);
  assert.match(settingsSource, /CREATE TABLE IF NOT EXISTS bot_message_cleanup/);
  assert.match(settingsSource, /CREATE TABLE IF NOT EXISTS telegram_processed_updates/);
  assert.match(settingsSource, /CREATE TABLE IF NOT EXISTS bot_ui_state/);
  assert.match(groupsSource, /CREATE TABLE IF NOT EXISTS giveaway_inline_posts/);
});

test('schema mapping retains critical migration-sensitive fields and uniqueness', () => {
  for (const field of [
    "panel_token", "duration_ms", "participant_user_ids", "first_name",
    "token_hash", "expires_at", "delete_at", "update_id", "inline_message_id"
  ]) assert.ok(schema.includes(field), `missing schema field: ${field}`);
  assert.match(schema, /unique\('winners_round_uq'\)\.on\(t\.giveawayId, t\.round\)/);
  assert.match(schema, /unique\('participants_pk'\)\.on\(t\.giveawayId, t\.userId\)/);
});

test('the source schema includes the base giveaway and participant definitions', () => {
  assert.match(sourceSchema, /CREATE TABLE IF NOT EXISTS giveaways/);
  assert.match(sourceSchema, /CREATE TABLE IF NOT EXISTS telegram_giveaway_participants/);
  assert.match(sourceSchema, /CREATE TABLE IF NOT EXISTS giveaway_winners/);
});
