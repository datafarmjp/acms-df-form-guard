#!/usr/bin/env bash

set -u

PLUGIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MANIFEST="$PLUGIN_DIR/RELEASE_MANIFEST.txt"
ADMIN_TEMPLATE="$PLUGIN_DIR/template/admin/app/df-form-guard.html"
TOPICPATH_TEMPLATE="$PLUGIN_DIR/template/admin/topicpath/df-form-guard.html"
FORM_TEMPLATE="$PLUGIN_DIR/template/form-guard-field.html"
VERSION="${1:-0.1.7}"
FAILURES=0

case "$PLUGIN_DIR" in
  */extension/plugins/DF_FormGuard)
    PROJECT_ROOT="${PLUGIN_DIR%/extension/plugins/DF_FormGuard}"
    ;;
  *)
    PROJECT_ROOT=""
    ;;
esac

note() {
  printf '%s\n' "$*"
}

pass() {
  note "OK  $*"
}

skip() {
  note "SKIP $*"
}

fail() {
  note "NG  $*"
  FAILURES=$((FAILURES + 1))
}

run_check() {
  local label="$1"
  shift
  if "$@" >/tmp/df_form_guard_release_check.out 2>&1; then
    pass "$label"
  else
    fail "$label"
    sed 's/^/    /' /tmp/df_form_guard_release_check.out
  fi
}

contains() {
  local file="$1"
  local pattern="$2"
  grep -Fq "$pattern" "$file"
}

not_contains_regex() {
  local pattern="$1"
  shift
  ! rg -n "$pattern" "$@" >/tmp/df_form_guard_release_check.out 2>&1
}

php_bin() {
  if [ -x /Applications/MAMP/bin/php/php8.2.26/bin/php ]; then
    printf '%s\n' /Applications/MAMP/bin/php/php8.2.26/bin/php
    return 0
  fi
  command -v php
}

manifest_plugin_paths() {
  grep -Ev '^[[:space:]]*($|#|@project[[:space:]])' "$MANIFEST" | sed 's#^\./##'
}

manifest_project_paths() {
  grep -E '^@project[[:space:]]+' "$MANIFEST" | sed -E 's#^@project[[:space:]]+##; s#^\./##'
}

check_php_files() {
  local php
  php="$(php_bin)" || return 1

  find "$PLUGIN_DIR" \
    -path "$PLUGIN_DIR/.git" -prune -o \
    -name '*.php' -print0 |
    xargs -0 -n 1 "$php" -l >/tmp/df_form_guard_release_check.out 2>&1 || return 1

  if [ -n "$PROJECT_ROOT" ]; then
    find "$PROJECT_ROOT/extension/acms/POST" -maxdepth 1 \
      \( -name 'FormGuardSettings.php' -o -name 'FormGuardFormSettings.php' -o -name 'FormGuardAiConnectionCheck.php' \) \
      -print0 |
      xargs -0 -n 1 "$php" -l >>/tmp/df_form_guard_release_check.out 2>&1 || return 1
  fi
}

check_js_files() {
  if ! command -v node >/dev/null 2>&1; then
    skip "node command was not found; JS syntax check skipped"
    return 0
  fi
  node --check "$PLUGIN_DIR/assets/df-form-guard-admin.js" >/tmp/df_form_guard_release_check.out 2>&1 &&
    node --check "$PLUGIN_DIR/assets/df-form-guard-form.js" >>/tmp/df_form_guard_release_check.out 2>&1
}

check_no_unwanted_files() {
  local result
  result="$(find "$PLUGIN_DIR" \
    \( -name '.git' -o -name '.DS_Store' -o -name '*.map' -o -name '*.bak' -o -name '*.tmp' -o -name '*~' -o -name 'node_modules' -o -name 'vendor' \) \
    -print)"
  result="$(printf '%s\n' "$result" | grep -v "^$PLUGIN_DIR/.git$" || true)"
  if [ -n "$result" ]; then
    printf '%s\n' "$result" >/tmp/df_form_guard_release_check.out
    return 1
  fi
}

check_manifest() {
  local missing
  local extra
  local manifest_plugin
  local actual_plugin

  [ -f "$MANIFEST" ] || {
    printf '%s\n' "$MANIFEST is missing" >/tmp/df_form_guard_release_check.out
    return 1
  }

  missing="$(
    while IFS= read -r path; do
      [ -f "$PLUGIN_DIR/$path" ] || printf '%s\n' "$path"
    done <<EOF
$(manifest_plugin_paths)
EOF
  )"
  if [ -n "$missing" ]; then
    {
      printf '%s\n' "missing plugin manifest file(s):"
      printf '%s\n' "$missing"
    } >/tmp/df_form_guard_release_check.out
    return 1
  fi

  manifest_plugin="$(mktemp /tmp/df_form_guard_manifest_plugin.XXXXXX)"
  actual_plugin="$(mktemp /tmp/df_form_guard_actual_plugin.XXXXXX)"

  manifest_plugin_paths | sort >"$manifest_plugin"
  find "$PLUGIN_DIR" \
    -path "$PLUGIN_DIR/.git" -prune -o \
    -name '.gitignore' -prune -o \
    -type f -print |
    sed "s#^$PLUGIN_DIR/##" |
    sort >"$actual_plugin"

  extra="$(comm -13 "$manifest_plugin" "$actual_plugin")"
  rm -f "$manifest_plugin" "$actual_plugin"

  if [ -n "$extra" ]; then
    {
      printf '%s\n' "plugin file(s) not listed in RELEASE_MANIFEST.txt:"
      printf '%s\n' "$extra"
    } >/tmp/df_form_guard_release_check.out
    return 1
  fi
}

check_project_synced_files() {
  local missing

  if [ -z "$PROJECT_ROOT" ]; then
    skip "project synced file check skipped outside extension/plugins/DF_FormGuard"
    return 0
  fi

  missing="$(
    while IFS= read -r path; do
      [ -f "$PROJECT_ROOT/$path" ] || printf '%s\n' "$path"
    done <<EOF
$(manifest_project_paths)
EOF
  )"
  if [ -n "$missing" ]; then
    {
      printf '%s\n' "missing project synced file(s):"
      printf '%s\n' "$missing"
    } >/tmp/df_form_guard_release_check.out
    return 1
  fi
}

check_versions() {
  contains "$PLUGIN_DIR/ServiceProvider.php" "public \$version = '$VERSION';" &&
    contains "$PLUGIN_DIR/README.md" "現在のバージョン: \`$VERSION\`" &&
    contains "$ADMIN_TEMPLATE" "?v=$VERSION" &&
    contains "$FORM_TEMPLATE" "?v=$VERSION" &&
    contains "$ADMIN_TEMPLATE" "data-current-version=\"$VERSION\"" &&
    contains "$PLUGIN_DIR/CHANGELOG.md" "<a id=\"v${VERSION//./-}\"></a>"
}

check_shared_guidelines() {
  contains "$PLUGIN_DIR/AGENTS.md" "../_shared/DF_EXTENSION_APP_GUIDELINES.md" &&
    contains "$PLUGIN_DIR/AGENTS.md" "../_shared/DF_EXTENSION_APP_ADMIN_TEMPLATE_HOWTO.md" &&
    contains "$PLUGIN_DIR/README.md" "../_shared/DF_EXTENSION_APP_GUIDELINES.md"
}

check_admin_template() {
    contains "$PLUGIN_DIR/ServiceProvider.php" "use Acms\\Services\\Common\\InjectTemplate;" &&
    contains "$PLUGIN_DIR/ServiceProvider.php" "'admin-main'" &&
    contains "$PLUGIN_DIR/ServiceProvider.php" "'admin-topicpath'" &&
    contains "$PLUGIN_DIR/ServiceProvider.php" "archiveLegacyAdminTemplate" &&
    contains "$ADMIN_TEMPLATE" "<!-- BEGIN_IF [%{ADMIN}/eq/app_df-form-guard] -->" &&
    contains "$TOPICPATH_TEMPLATE" "<!-- BEGIN app_df-form-guard -->" &&
    contains "$ADMIN_TEMPLATE" "js-df-form-guard-update-notice" &&
    contains "$PLUGIN_DIR/assets/df-form-guard-admin.js" "df_form_guard_latest_release" &&
    contains "$PLUGIN_DIR/assets/df-form-guard-admin.js" "df-form-guard-admin-menu-update-dot" &&
    contains "$PLUGIN_DIR/assets/df-form-guard-admin.css" ".df-form-guard-admin-menu-update-dot" &&
    contains "$ADMIN_TEMPLATE" "https://www.jicoo.com/event_types/9KVr0WMdvpEl" &&
    contains "$ADMIN_TEMPLATE" "https://datafarm.jp/contact" &&
    contains "$ADMIN_TEMPLATE" "https://buy.stripe.com/4gM3cu8ZGggTdyL70O9ws04" &&
    contains "$ADMIN_TEMPLATE" "rel=\"noopener\"" &&
    not_contains_regex "syncAdminTemplate" \
      "$PLUGIN_DIR" \
      -g '!README.md' \
      -g '!**/tools/release-check.sh'
}

check_release_scripts() {
  contains "$PLUGIN_DIR/tools/release.sh" "bash tools/release-check.sh" &&
    contains "$PLUGIN_DIR/tools/release.sh" "## 変更内容" &&
    contains "$PLUGIN_DIR/tools/release.sh" "CHANGELOG.md の該当箇所を開く" &&
    contains "$PLUGIN_DIR/tools/release-json.php" "changelog_url"
}

check_debug_safety() {
  local auth_hits

  if [ -n "$PROJECT_ROOT" ]; then
    auth_hits="$(
      rg -n "Authorization: Bearer" "$PLUGIN_DIR" "$PROJECT_ROOT/extension/acms/POST" \
        -g '!**/Services/Classifier.php' \
        -g '!README.md' \
        -g '!CHANGELOG.md' \
        -g '!RELEASE_MANIFEST.txt' \
        -g '!**/tools/release-check.sh' || true
    )"
  else
    auth_hits="$(
      rg -n "Authorization: Bearer" "$PLUGIN_DIR" \
        -g '!**/Services/Classifier.php' \
        -g '!README.md' \
        -g '!CHANGELOG.md' \
        -g '!RELEASE_MANIFEST.txt' \
        -g '!**/tools/release-check.sh' || true
    )"
  fi
  if [ -n "$auth_hits" ]; then
    {
      printf '%s\n' "Authorization header construction is only allowed in Services/Classifier.php:"
      printf '%s\n' "$auth_hits"
    } >/tmp/df_form_guard_release_check.out
    return 1
  fi

  not_contains_regex "console\\.(log|info|warn|error)\\([^\\n]*(api[_-]?key|Authorization|Bearer|sk-)" \
    "$PLUGIN_DIR/assets" \
    -g '!**/tools/release-check.sh'
}

run_check "PHP syntax" check_php_files
run_check "JS syntax" check_js_files
run_check "no unwanted files" check_no_unwanted_files
run_check "release manifest" check_manifest
run_check "project synced files" check_project_synced_files
run_check "version references" check_versions
run_check "shared guideline references" check_shared_guidelines
run_check "admin template injection and public guidance" check_admin_template
run_check "release script output" check_release_scripts
run_check "debug safety" check_debug_safety

rm -f /tmp/df_form_guard_release_check.out

if [ "$FAILURES" -gt 0 ]; then
  note "Release check failed: $FAILURES failure(s)."
  exit 1
fi

note "Release check passed."
