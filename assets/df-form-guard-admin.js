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
          var decision = json && json.decision ? json.decision : {};
          if (!json || json.status !== 'success') {
            throw new Error((json && json.message) || 'AI接続を確認できませんでした。');
          }
          result.className = 'js-df-form-guard-ai-check-result acms-admin-text-success';
          result.textContent = 'AI接続に成功しました。モデル: ' + (json.model || '') + ' / 判定: ' + (decision.result || '');
          logDebug('AI connection check response:', json);
        })
        .catch(function(error) {
          result.className = 'js-df-form-guard-ai-check-result acms-admin-text-danger';
          result.textContent = error && error.message ? error.message : 'AI接続を確認できませんでした。';
        })
        .finally(function() {
          button.disabled = false;
        });
    });
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
