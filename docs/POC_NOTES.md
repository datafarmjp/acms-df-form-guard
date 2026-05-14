# DF_FormGuard PoC Notes

## Shared References

Before changing release, public README, or admin app behavior, refer to:

- `../_shared/DF_EXTENSION_APP_GUIDELINES.md`
- `../_shared/DF_EXTENSION_APP_ADMIN_TEMPLATE_HOWTO.md`

## Hook Timing

`ACMS_POST_Form_Submit::post()` calls `beforeSendAutoReply` after validation and before both administrator email and auto-reply email are sent.

The PoC does not set the `$abort` flag because that would stop the whole form flow. Instead, when AI returns `NG`, it sets:

```php
$Mail->set('AdminFormSend', 'no');
```

The default form submission flow then continues, including auto-reply and `log_form` history persistence.

## Form Settings

The form ID edit template has an `Admin_InjectTemplate id="admin-form"` hook. DF_FormGuard injects `template/form-guard-field.html` there.

The standard `ACMS_POST_Form_Insert` and `ACMS_POST_Form_Update` modules save unknown fields listed in `form[]` into `form_data`, so DF_FormGuard stores per-form settings without schema changes.

Injected templates do not automatically receive the `Admin_Form_Edit` module's form variables. The form edit JavaScript therefore calls `FormGuardFormSettings` with the current `fmid` and restores the saved FormGuard settings from `form_data` after the page loads.

## Reference Entries

The PoC stores reference entry IDs in `df_form_guard_reference_eids` as a comma-separated form setting. The form edit UI uses the standard entry ID reference picker, and direct comma-separated EID editing is still possible from the edit toggle. `Services/ReferenceEntries.php` normalizes the IDs, loads public entries from `entry` and `fulltext`, and truncates the combined context before AI classification.

Reference entries are only OK-decision context. If a submission is merely unrelated to the selected entries, that alone should not make it `NG`.

## Known Limitations

- The PoC depends on synchronous AI classification during form submission.
- If OpenAI is slow, form submission waits until the configured timeout.
- The first implementation stores decision metadata in `log_form_data` as form fields, not in dedicated columns.
- Reference entries are loaded synchronously on each guarded form submission. Caching or vector search can be considered after this PoC.
