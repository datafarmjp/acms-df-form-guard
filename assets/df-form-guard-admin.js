(function() {
  'use strict';

  document.addEventListener('DOMContentLoaded', function() {
    var root = document.querySelector('.js-df-form-guard-admin');
    var apiKey = document.querySelector('.js-df-form-guard-api-key');
    var timeout = document.querySelector('[name="df_form_guard_ai_timeout_seconds"]');
    var debugToggle = document.querySelector('.js-df-form-guard-debug-toggle');
    var debugValue = document.querySelector('.js-df-form-guard-debug-value');
    var checkButton = document.querySelector('.js-df-form-guard-ai-check');
    var checkResult = document.querySelector('.js-df-form-guard-ai-check-result');
    var testText = document.querySelector('.js-df-form-guard-test-text');

    if (!root) {
      return;
    }

    setNumberDefault(timeout, 1, 60, 10);
    setupApiKeyConfig(apiKey);
    setupDebug(debugToggle, debugValue);
    setupConnectionCheck(checkButton, checkResult, testText);
    setupUpdateNotice();
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

  function setupDebug(toggle, hidden) {
    if (!toggle || !hidden) {
      return;
    }
    toggle.checked = isEnabled(toggle.getAttribute('data-config-value'));
    syncFeature(toggle, hidden);
    toggle.addEventListener('change', function() {
      syncFeature(toggle, hidden);
    });
  }

  function setupConnectionCheck(button, result, testText) {
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
          formData.append('test_text', testText ? testText.value : '');
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
    if (normalized === 'environment') {
      return '環境変数';
    }
    if (normalized === 'none' || normalized === '') {
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

  function isEnabled(value) {
    var normalized = String(value || '').trim().toLowerCase();
    return normalized === 'enabled' || normalized === 'on' || normalized === '1' || normalized === 'true';
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
            window.localStorage.setItem('df_form_guard_update_dismissed', tag);
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
      if (!release || !release.tag_name || release.prerelease || release.draft) {
        return;
      }
      latestVersion = normalizeVersion(release.tag_name);
      if (!isNewerVersion(latestVersion, currentVersion) || isDismissed(release.tag_name)) {
        return;
      }
      url = release.html_url || 'https://github.com/datafarmjp/acms-df-form-guard/releases/latest';
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
    }).catch(function(error) {
      warnDebug('DF_FormGuard release check failed:', error);
    });
  }

  function latestRelease() {
    var cacheKey = 'df_form_guard_latest_release';
    var cachedRelease = null;
    if (window.localStorage) {
      try {
        var cached = JSON.parse(window.localStorage.getItem(cacheKey) || 'null');
        if (cached && cached.release && cached.checked_at && Date.now() - cached.checked_at < 21600000) {
          cachedRelease = cached.release;
        }
      } catch (error) {
      }
    }
    if (cachedRelease) {
      return Promise.resolve(cachedRelease);
    }
    return fetch('https://api.github.com/repos/datafarmjp/acms-df-form-guard/releases/latest', {
      headers: {'Accept': 'application/vnd.github+json'}
    }).then(function(response) {
      if (!response.ok) {
        throw new Error('release check failed');
      }
      return response.json();
    }).then(function(release) {
      if (window.localStorage) {
        try {
          window.localStorage.setItem(cacheKey, JSON.stringify({
            checked_at: Date.now(),
            release: release,
          }));
        } catch (error) {
        }
      }
      return release;
    });
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

  function isDismissed(tag) {
    if (!window.localStorage) {
      return false;
    }
    try {
      return window.localStorage.getItem('df_form_guard_update_dismissed') === tag;
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
