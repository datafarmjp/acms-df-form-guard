# DF_FormGuard

DF_FormGuard is an a-blog cms extension app that classifies form submissions with AI and suppresses administrator email for likely sales or spam messages while keeping the normal form history.

## PoC Behavior

- Per-form settings live in the form ID edit screen.
- Per-form reference entries can be added as OK-decision context.
- Shared OpenAI settings live in the DF_FormGuard app settings screen.
- The app uses the `beforeSendAutoReply` hook.
- `NG` decisions set `AdminFormSend` to `no`, so administrator email is suppressed.
- Form history is still saved by the normal a-blog cms flow.
- `ERROR` decisions send administrator email by default.

## Saved Form History Fields

- `df_form_guard_result`
- `df_form_guard_category`
- `df_form_guard_confidence`
- `df_form_guard_reason`
- `df_form_guard_admin_mail_blocked`
- `df_form_guard_checked_at`

## Reference Entries

Add public entries in the form ID edit screen with the standard entry ID reference picker. DF_FormGuard loads each selected entry's title and fulltext, then passes a shortened context block to AI.

Reference entries are used to make legitimate questions easier to classify as `OK`. They are not used to mark unrelated inquiries as `NG` by themselves.

## Debug

Enable debug in the app settings screen. Browser-side debug can also be enabled with:

```js
localStorage.setItem('DFFormGuardDebug', '1')
```

Debug output must not include API keys or full form body text.

## Notes

- This repository contains the plugin source under `extension/plugins/DF_FormGuard/`.
- Synced files such as `themes/system/admin/app/df-form-guard.html` and `extension/acms/POST/*` are generated from the plugin templates at install/update time.
