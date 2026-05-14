# DF_FormGuard Agent Notes

Before changing this plugin, read these shared documents first:

- `../_shared/DF_EXTENSION_APP_GUIDELINES.md`
- `../_shared/DF_EXTENSION_APP_ADMIN_TEMPLATE_HOWTO.md`
- `docs/POC_NOTES.md`

Release behavior should stay aligned with `DF_InputAssist` and `DF_Like`:

- GitHub Release notes use `変更内容`, `インストール`, and `注意`.
- `CHANGELOG.md` entries include anchors like `<a id="v0-1-3"></a>`.
- `tools/release.sh` runs `tools/release-check.sh` before packaging.
- The admin app template is injected with `InjectTemplate`; do not copy it to `themes/system/admin/app/`.
- Managed compatibility POST wrappers are listed as `@project` paths in `RELEASE_MANIFEST.txt`.
