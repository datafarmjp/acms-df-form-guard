# Changelog

## 0.1.3

- Added `tools/release.sh` for ZIP packaging and GitHub Release publishing.
- Added `tools/release-json.php` and `RELEASE_MANIFEST.txt` for release metadata and package file control.
- Updated README with release packaging instructions.

## Unreleased

## 0.1.2

- Switched the admin app screen from system theme copy to `InjectTemplate` on `admin-main`.
- Added conditional rendering for `app_df-form-guard` only.
- Added legacy managed admin template archive handling.

## 0.1.1

- Fixed injected form settings restoration by adding a form settings JSON POST.
- Kept reference entry IDs visible after saving from the form ID edit screen.

## 0.1.0

- Added initial PoC implementation.
- Added form-level FormGuard settings via the form ID edit screen.
- Added form-level reference entry IDs as OK-decision context for AI classification.
- Added OpenAI connection settings and AI connection check.
- Added `beforeSendAutoReply` hook classification and administrator email suppression.
- Added managed POST wrappers for `extension/acms/POST/`.
