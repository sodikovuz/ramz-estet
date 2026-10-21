# Moderation primitive — integration status

`tgcloud/lib/moderation.js` is a runtime-compatible, dependency-free implementation of the existing targeted group moderation rule:

- Only the configured target chat is eligible.
- Both message text and photo/document captions are checked.
- Matching is case-insensitive for `bounty`, `баунти` and `баунтий`.
- It asks Telegram to delete the exact matching message and reports success only after the API call resolves.
- The target chat ID is an explicit trusted argument; it is never derived from update-controlled data.

## Important integration note

This helper is deliberately not wired as the sole `handlers/message.js` implementation yet. That handler also owns the existing admin conversation flow, settings, group registration and cleanup queue. Replacing it with a moderation-only handler would silently break those features. During the complete port, call `moderateBountyMessage(message, configuredChatId, api)` from the full message handler, then continue through the original dispatch logic for non-matching updates.

## Verification required before activation

- Test target and non-target group IDs.
- Test text, caption, mixed case, and messages without text/caption.
- Test a nonmatching message to ensure it proceeds to the rest of the bot flow.
- Test missing delete permissions and Telegram API errors.
- Confirm the target chat ID matches the intended production group before enabling the rule in the test bot.
