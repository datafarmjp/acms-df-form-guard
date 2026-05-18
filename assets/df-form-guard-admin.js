(function() {
  'use strict';

  var RELEASE_API_URL = 'https://api.github.com/repos/datafarmjp/acms-df-form-guard/releases/latest';
  var RELEASE_LATEST_URL = 'https://github.com/datafarmjp/acms-df-form-guard/releases/latest';
  var RELEASE_CACHE_KEY = 'df_form_guard_latest_release';
  var UPDATE_DISMISSED_KEY = 'df_form_guard_update_dismissed';
  var UPDATE_DOT_LABEL = '新しいバージョンがあります';
  var SIDEBAR_SELECTOR = '.acms-admin-sidebar-main';
  var MENU_LINK_SELECTOR = 'a[href*="admin/app_df-form-guard"]';
  var MENU_DOT_SELECTOR = '.df-form-guard-admin-menu-update-dot';
  var latestReleasePromise = null;

  document.addEventListener('DOMContentLoaded', function() {
    var root = document.querySelector('.js-df-form-guard-admin');
    var apiKey = document.querySelector('.js-df-form-guard-api-key');
    var timeout = document.querySelector('[name="df_form_guard_ai_timeout_seconds"]');
    var debugToggle = document.querySelector('.js-df-form-guard-debug-toggle');
    var debugValue = document.querySelector('.js-df-form-guard-debug-value');
    var honeypotToggle = document.querySelector('.js-df-form-guard-honeypot-toggle');
    var honeypotValue = document.querySelector('.js-df-form-guard-honeypot-value');
    var honeypotRaw = document.querySelector('.js-df-form-guard-honeypot-raw');
    var honeypotEffective = document.querySelector('.js-df-form-guard-honeypot-effective');
    var checkButton = document.querySelector('.js-df-form-guard-ai-check');
    var checkResult = document.querySelector('.js-df-form-guard-ai-check-result');
    var checkLast = document.querySelector('.js-df-form-guard-ai-check-last');

    if (!root) {
      return;
    }

    setNumberDefault(timeout, 1, 60, 10);
    setupApiKeyConfig(apiKey);
    setupFeatureToggle(debugToggle, debugValue, false);
    setupFeatureToggle(honeypotToggle, honeypotValue, true);
    setupHoneypotStatus(honeypotToggle, honeypotValue, honeypotRaw, honeypotEffective);
    setupConnectionCheck(checkButton, checkResult, checkLast);
    setupCopyButtons();
    setupUpdateNotice();
    cleanupMenuUpdateDots();
    setupMenuUpdateDot();
  });

  function setupApiKeyConfig(apiKey) {
    if (!apiKey || !apiKey.form) {
      return;
    }
    apiKey.addEventListener('input', function() {
      var exists = apiKey.form.querySelector('input[name="config[]"][value="df_form_guard_openai_api_key"]');
      if (apiKey.value && !exists) {
        var hidden = document.createElement('input');
        hidden.type = 'hidden';
        hidden.name = 'config[]';
        hidden.value = 'df_form_guard_openai_api_key';
        apiKey.form.appendChild(hidden);
      } else if (!apiKey.value && exists) {
        exists.parentNode.removeChild(exists);
      }
    });
  }

  function setupFeatureToggle(toggle, hidden, fallback) {
    if (!toggle || !hidden) {
      return;
    }
    toggle.checked = isEnabled(toggle.getAttribute('data-config-value'), fallback);
    syncFeature(toggle, hidden);
    toggle.addEventListener('change', function() {
      syncFeature(toggle, hidden);
    });
  }

  function setupHoneypotStatus(toggle, hidden, raw, effective) {
    if (!toggle || !hidden || !raw || !effective) {
      return;
    }
    renderHoneypotStatus();
    toggle.addEventListener('change', renderHoneypotStatus);

    function renderHoneypotStatus() {
      var savedValue = String(toggle.getAttribute('data-config-value') || '').trim();
      var value = String(hidden.value || '').trim();
      raw.textContent = savedValue === '' ? '(空)' : savedValue;
      effective.textContent = isEnabled(value, true) ? 'ON' : 'OFF';
      effective.className = 'js-df-form-guard-honeypot-effective ' + (isEnabled(value, true) ? 'acms-admin-text-success' : 'acms-admin-text-danger');
    }
  }

  function setupConnectionCheck(button, result, lastChecked) {
    if (!button || !result) {
      return;
    }
    button.addEventListener('click', function() {
      button.disabled = true;
      result.className = 'js-df-form-guard-ai-check-result acms-admin-text-muted';
      result.textContent = 'AI接続を確認しています。';

      postJsonWithFallback(
        ['ACMS_POST_DF_FormGuard_FormGuardAiConnectionCheck', 'ACMS_POST_FormGuardAiConnectionCheck'],
        function(action) {
          var formData = new FormData();
          formData.append(action, 'AI接続確認');
          appendCsrfToken(formData);
          return formData;
        },
        'AI接続を確認できませんでした。'
      )
        .then(function(json) {
          if (!json || json.status !== 'success') {
            renderConnectionResult(result, json, false, (json && json.message) || 'AI接続を確認できませんでした。');
            return;
          }
          renderConnectionResult(result, json, true, 'AI接続に成功しました。');
          if (lastChecked) {
            lastChecked.textContent = json.last_checked_at ? ('最終確認: ' + json.last_checked_at) : '未確認';
          }
          logDebug('AI connection check response:', json);
        })
        .catch(function(error) {
          renderConnectionResult(result, null, false, error && error.message ? error.message : 'AI接続を確認できませんでした。');
        })
        .finally(function() {
          button.disabled = false;
        });
    });
  }

  function renderConnectionResult(result, json, success, message) {
    var decision = json && json.decision ? json.decision : {};
    var details = [];
    result.className = 'js-df-form-guard-ai-check-result ' + (success ? 'acms-admin-text-success' : 'acms-admin-text-danger');
    if (json && json.model) {
      details.push('モデル: ' + json.model);
    }
    if (json && json.apiKeySource) {
      details.push('APIキー取得元: ' + apiKeySourceLabel(json.apiKeySource));
    }
    if (decision.result) {
      details.push('サンプル判定: ' + decision.result + (decision.category ? ' / ' + decision.category : ''));
    }
    result.textContent = [message || (success ? 'AI接続に成功しました。' : 'AI接続を確認できませんでした。')]
      .concat(details)
      .join(details.length ? ' / ' : '');
  }

  function apiKeySourceLabel(value) {
    var normalized = String(value || '').trim();
    if (normalized === 'config') {
      return '保存済み設定';
    }
    if (normalized === 'constant') {
      return '互換定数';
    }
    if (normalized === 'env' || normalized === 'environment') {
      return '環境変数';
    }
    if (normalized === 'missing' || normalized === 'none' || normalized === '') {
      return '未設定';
    }
    return normalized;
  }

  function postJsonWithFallback(actions, buildFormData, failureMessage) {
    var names = Array.isArray(actions) ? actions.slice() : [actions];
    return tryPostAction(0);

    function tryPostAction(index) {
      var action = names[index];
      if (!action) {
        return Promise.reject(new Error(failureMessage || '通信に失敗しました。'));
      }
      return fetch(window.location.href, {
        method: 'POST',
        body: buildFormData(action),
        credentials: 'same-origin',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'X-Csrf-Token': getCsrfToken(),
        },
      })
        .then(function(response) {
          if (!response.ok) {
            throw new Error(failureMessage || '通信に失敗しました。');
          }
          return response.text();
        })
        .then(function(text) {
          try {
            return text ? JSON.parse(text) : {};
          } catch (error) {
            var preview = String(text || '').slice(0, 160);
            var htmlResponse = isHtmlResponsePreview(preview);
            warnDebug('DF_FormGuard POST invalid JSON:', action, {
              message: error && error.message ? error.message : String(error),
              possiblePostMissing: htmlResponse,
              preview: preview,
            });
            throw new Error(htmlResponse
              ? 'POSTが認識されずHTMLが返りました。extension/acms/POST の互換POST配置を確認してください。'
              : failureMessage || '通信結果を読み取れませんでした。');
          }
        })
        .catch(function(error) {
          if (index + 1 >= names.length) {
            throw error;
          }
          warnDebug('DF_FormGuard POST fallback:', action, '->', names[index + 1], error);
          return tryPostAction(index + 1);
        });
    }
  }

  function setNumberDefault(input, min, max, fallback) {
    var value;
    if (!input) {
      return;
    }
    value = parseInt(input.value, 10);
    if (!Number.isFinite(value) || value < min || value > max) {
      input.value = fallback;
    }
  }

  function syncFeature(toggle, hidden) {
    hidden.value = toggle.checked ? 'enabled' : 'disabled';
  }

  function isEnabled(value, fallback) {
    var normalized = String(value || '').trim().toLowerCase();
    if (normalized === '') {
      return !!fallback;
    }
    return normalized === 'enabled' || normalized === 'on' || normalized === '1' || normalized === 'true';
  }

  function setupCopyButtons() {
    var buttons = document.querySelectorAll('.js-df-form-guard-copy');
    Array.prototype.forEach.call(buttons, function(button) {
      var status = findCopyStatus(button);
      button.addEventListener('click', function() {
        copyText(button.getAttribute('data-copy-text') || '')
          .then(function() {
            renderLocalStatus(status, 'コピーしました', 'success');
          })
          .catch(function() {
            renderLocalStatus(status, 'コピーできませんでした', 'danger');
          });
      });
    });
  }

  function findCopyStatus(button) {
    var parent = button.closest ? button.closest('td') : null;
    return parent ? parent.querySelector('.js-df-form-guard-copy-status') : null;
  }

  function renderLocalStatus(status, message, type) {
    if (!status) {
      return;
    }
    status.className = statusClass(status, type);
    status.textContent = message;
  }

  function statusClass(element, type) {
    var base = element.getAttribute('data-base-class') || element.className.replace(/\s*acms-admin-text-(success|danger|muted)\b/g, '');
    element.setAttribute('data-base-class', base);
    return base + ' acms-admin-text-' + (type || 'muted');
  }

  function copyText(text) {
    if (window.navigator && window.navigator.clipboard && window.navigator.clipboard.writeText) {
      return window.navigator.clipboard.writeText(text);
    }
    return new Promise(function(resolve, reject) {
      var textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', 'readonly');
      textarea.style.position = 'fixed';
      textarea.style.left = '-10000px';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        if (document.execCommand('copy')) {
          resolve();
        } else {
          reject(new Error('copy failed'));
        }
      } catch (error) {
        reject(error);
      } finally {
        document.body.removeChild(textarea);
      }
    });
  }

  function appendCsrfToken(formData) {
    var token = getCsrfToken();
    if (token) {
      formData.append('formToken', token);
    }
  }

  function getCsrfToken() {
    if (window.csrfToken) {
      return window.csrfToken;
    }
    var meta = document.querySelector('meta[name="csrf-token"]');
    if (meta && meta.content) {
      return meta.content;
    }
    var input = document.querySelector('input[name="formToken"]');
    if (input && input.value) {
      return input.value;
    }
    return '';
  }

  function isHtmlResponsePreview(preview) {
    var value = String(preview || '').trim().toLowerCase();
    return value.indexOf('<!doctype html') === 0 || value.indexOf('<html') === 0;
  }

  function setupUpdateNotice() {
    var notice = document.querySelector('.js-df-form-guard-update-notice');
    var message = document.querySelector('.js-df-form-guard-update-message');
    var close = document.querySelector('.js-df-form-guard-update-close');
    var currentVersion = notice ? notice.getAttribute('data-current-version') || '' : '';
    if (!notice || !message || !currentVersion || !window.fetch) {
      return;
    }
    if (close) {
      close.addEventListener('click', function() {
        notice.hidden = true;
        var tag = notice.getAttribute('data-release-tag') || '';
        if (tag && window.localStorage) {
          try {
            window.localStorage.setItem(UPDATE_DISMISSED_KEY, tag);
          } catch (error) {
          }
        }
      });
    }
    latestRelease().then(function(release) {
      var latestVersion;
      var url;
      var changelogUrl;
      var asset;
      if (!isUsableRelease(release)) {
        return;
      }
      latestVersion = normalizeVersion(release.tag_name);
      if (!isNewerVersion(latestVersion, currentVersion) || isDismissed(release.tag_name)) {
        return;
      }
      url = release.html_url || RELEASE_LATEST_URL;
      changelogUrl = changelogUrlForTag(release.tag_name);
      asset = zipAsset(release.assets || [], latestVersion);
      if (asset && asset.browser_download_url) {
        url = asset.browser_download_url;
      }
      notice.setAttribute('data-release-tag', release.tag_name);
      message.innerHTML = '';
      message.appendChild(document.createTextNode('DFフォームガード ' + release.tag_name + ' が公開されています。'));
      message.appendChild(document.createTextNode(' '));
      var link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = '最新版をダウンロード';
      message.appendChild(link);
      if (changelogUrl) {
        message.appendChild(document.createTextNode(' / '));
        var changelogLink = document.createElement('a');
        changelogLink.href = changelogUrl;
        changelogLink.target = '_blank';
        changelogLink.rel = 'noopener';
        changelogLink.textContent = '変更内容を見る';
        message.appendChild(changelogLink);
      }
      notice.hidden = false;
    }).catch(function() {
    });
  }

  function setupMenuUpdateDot() {
    var notice = document.querySelector('.js-df-form-guard-update-notice');
    var currentVersion = notice ? notice.getAttribute('data-current-version') || '' : '';
    if (!currentVersion || !window.fetch) {
      return;
    }
    latestRelease().then(function(release) {
      if (!isUsableRelease(release)) {
        return;
      }
      if (!isNewerVersion(normalizeVersion(release.tag_name), currentVersion)) {
        return;
      }
      addMenuUpdateDot();
    }).catch(function() {
    });
  }

  function addMenuUpdateDot() {
    var sidebar = document.querySelector(SIDEBAR_SELECTOR);
    var link;
    var dot;
    if (!sidebar) {
      return;
    }
    link = sidebar.querySelector(MENU_LINK_SELECTOR);
    if (!link || link.querySelector(MENU_DOT_SELECTOR)) {
      return;
    }
    dot = document.createElement('span');
    dot.className = MENU_DOT_SELECTOR.slice(1);
    dot.setAttribute('role', 'img');
    dot.setAttribute('aria-label', UPDATE_DOT_LABEL);
    dot.title = UPDATE_DOT_LABEL;
    link.appendChild(dot);
  }

  function cleanupMenuUpdateDots() {
    var sidebar = document.querySelector(SIDEBAR_SELECTOR);
    var selector = [
      MENU_DOT_SELECTOR,
      '[title="' + UPDATE_DOT_LABEL + '"]',
      '[aria-label="' + UPDATE_DOT_LABEL + '"]'
    ].join(',');
    document.querySelectorAll(selector).forEach(function(dot) {
      if (sidebar && sidebar.contains(dot)) {
        return;
      }
      if (dot.parentNode) {
        dot.parentNode.removeChild(dot);
      }
    });
  }

  function latestRelease() {
    var cachedRelease = null;
    if (latestReleasePromise) {
      return latestReleasePromise;
    }
    if (window.localStorage) {
      try {
        var cached = JSON.parse(window.localStorage.getItem(RELEASE_CACHE_KEY) || 'null');
        if (cached && cached.release) {
          cachedRelease = cached.release;
        }
      } catch (error) {
      }
    }
    latestReleasePromise = fetch(RELEASE_API_URL, {
      headers: {'Accept': 'application/vnd.github+json'}
    }).then(function(response) {
      if (!response.ok) {
        throw new Error('release check failed');
      }
      return response.json();
    }).then(function(release) {
      if (window.localStorage) {
        try {
          window.localStorage.setItem(RELEASE_CACHE_KEY, JSON.stringify({
            checked_at: Date.now(),
            release: release
          }));
        } catch (error) {
        }
      }
      return release;
    }).catch(function(error) {
      if (cachedRelease) {
        return cachedRelease;
      }
      throw error;
    });
    return latestReleasePromise;
  }

  function changelogUrlForTag(tag) {
    var normalizedTag = String(tag || '').trim();
    if (!/^v\d+\.\d+\.\d+$/.test(normalizedTag)) {
      return '';
    }
    return 'https://github.com/datafarmjp/acms-df-form-guard/blob/' + normalizedTag + '/CHANGELOG.md#' + normalizedTag.replace(/\./g, '-');
  }

  function zipAsset(assets, version) {
    var expected = 'DF_FormGuard-v' + version + '.zip';
    for (var i = 0; i < assets.length; i++) {
      if (assets[i] && assets[i].name === expected) {
        return assets[i];
      }
    }
    for (var j = 0; j < assets.length; j++) {
      if (assets[j] && /\.zip$/i.test(assets[j].name || '')) {
        return assets[j];
      }
    }
    return null;
  }

  function isUsableRelease(release) {
    return !!(release && release.tag_name && !release.prerelease && !release.draft);
  }

  function isDismissed(tag) {
    if (!window.localStorage) {
      return false;
    }
    try {
      return window.localStorage.getItem(UPDATE_DISMISSED_KEY) === tag;
    } catch (error) {
      return false;
    }
  }

  function normalizeVersion(value) {
    return String(value || '').replace(/^v/i, '').trim();
  }

  function isNewerVersion(latest, current) {
    var latestParts = versionParts(latest);
    var currentParts = versionParts(current);
    for (var i = 0; i < Math.max(latestParts.length, currentParts.length); i++) {
      var left = latestParts[i] || 0;
      var right = currentParts[i] || 0;
      if (left > right) {
        return true;
      }
      if (left < right) {
        return false;
      }
    }
    return false;
  }

  function versionParts(value) {
    return normalizeVersion(value).split('.').map(function(part) {
      return parseInt(part, 10) || 0;
    });
  }

  function isDebugEnabled() {
    try {
      return window.localStorage.getItem('DFFormGuardDebug') === '1';
    } catch (error) {
      return false;
    }
  }

  function logDebug() {
    if (!isDebugEnabled() || !window.console || !console.log) {
      return;
    }
    console.log.apply(console, arguments);
  }

  function warnDebug() {
    if (!isDebugEnabled() || !window.console || !console.warn) {
      return;
    }
    console.warn.apply(console, arguments);
  }
})();
