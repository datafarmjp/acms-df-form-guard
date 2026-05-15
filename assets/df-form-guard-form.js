(function() {
  'use strict';

  document.addEventListener('DOMContentLoaded', function() {
    var root = document.querySelector('.js-df-form-guard-form');
    if (!root) {
      return;
    }

    var enabled = root.querySelector('.js-df-form-guard-enabled');
    var detail = root.querySelector('.js-df-form-guard-detail');
    var errorAction = root.querySelector('.js-df-form-guard-error-action');
    var maxInput = root.querySelector('.js-df-form-guard-max-input');
    var referenceMax = root.querySelector('.js-df-form-guard-reference-max');
    var logDisabled = document.querySelector('#input-checkbox-log');
    var logWarning = root.querySelector('.js-df-form-guard-log-warning');

    root.querySelectorAll('.js-df-form-guard-default-on').forEach(function(input) {
      var current = String(input.getAttribute('data-current') || '').trim().toLowerCase();
      if (current === '') {
        input.checked = true;
      } else {
        input.checked = current === 'enabled' || current === 'on' || current === '1' || current === 'true';
      }
    });

    if (errorAction && ['send', 'block'].indexOf(errorAction.value) === -1) {
      errorAction.value = 'send';
    }
    setNumberDefault(maxInput, 500, 20000, 4000);
    setNumberDefault(referenceMax, 500, 20000, 3000);
    setupReferenceEntries(root);
    syncDetail(enabled, detail);
    syncLogWarning(enabled, logDisabled, logWarning);
    restoreFormSettings(root, enabled, detail);

    if (enabled) {
      enabled.addEventListener('change', function() {
        syncDetail(enabled, detail);
        syncLogWarning(enabled, logDisabled, logWarning);
      });
    }
    if (logDisabled) {
      logDisabled.addEventListener('change', function() {
        syncLogWarning(enabled, logDisabled, logWarning);
      });
    }
  });

  function syncDetail(enabled, detail) {
    if (!enabled || !detail) {
      return;
    }
    detail.style.display = enabled.checked ? '' : 'none';
  }

  function syncLogWarning(enabled, logDisabled, warning) {
    if (!enabled || !logDisabled || !warning) {
      return;
    }
    warning.hidden = !(enabled.checked && logDisabled.checked);
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

  function setupReferenceEntries(root) {
    var input = root.querySelector('.js-df-form-guard-reference-eids');
    var labels = root.querySelector('.js-df-form-guard-reference-labels');

    if (!input || !labels) {
      return;
    }

    renderLabels(parseEids(input.value));

    input.addEventListener('change', function() {
      var eids = parseEids(input.value);
      input.value = eids.join(',');
      renderLabels(eids);
    });
    labels.addEventListener('click', function(event) {
      var button = event.target.closest('.js-df-form-guard-reference-generated');
      var eid;
      if (!button) {
        return;
      }
      event.preventDefault();
      eid = parseInt(button.getAttribute('data-eid'), 10);
      input.value = parseEids(input.value).filter(function(value) {
        return value !== eid;
      }).join(',');
      renderLabels(parseEids(input.value));
    });

    function renderLabels(eids) {
      labels.querySelectorAll('.js-df-form-guard-reference-generated').forEach(function(item) {
        item.remove();
      });
      eids.forEach(function(eid) {
        var item = document.createElement('div');
        var label = document.createElement('span');
        var remove = document.createElement('button');
        item.className = 'js-arg_reference_remove js-df-form-guard-reference-generated acms-admin-label-group acms-admin-inline-space';
        item.setAttribute('data-arg', String(eid));
        item.setAttribute('data-eid', String(eid));
        item.style.display = 'inline-block';
        label.className = 'acms-admin-label acms-admin-label-large';
        label.textContent = 'EID: ' + eid;
        remove.type = 'button';
        remove.className = 'acms-admin-label acms-admin-label-large acms-admin-label-side';
        remove.textContent = 'x';
        item.appendChild(label);
        item.appendChild(remove);
        labels.appendChild(item);
      });
    }
  }

  function restoreFormSettings(root, enabled, detail) {
    var fmid = getCurrentFmid();
    if (!fmid) {
      return;
    }

    postJsonWithFallback(
      ['ACMS_POST_DF_FormGuard_FormGuardFormSettings', 'ACMS_POST_FormGuardFormSettings'],
      function(action) {
        var formData = new FormData();
        formData.append(action, '設定取得');
        formData.append('fmid', fmid);
        appendCsrfToken(formData);
        return formData;
      }
    )
      .then(function(json) {
        if (!json || json.status !== 'success' || !json.settings) {
          return;
        }
        applySettings(root, json.settings);
        syncDetail(enabled, detail);
        syncLogWarning(enabled, document.querySelector('#input-checkbox-log'), root.querySelector('.js-df-form-guard-log-warning'));
      })
      .catch(function(error) {
        warnDebug('DF_FormGuard form settings restore failed:', error);
      });
  }

  function applySettings(root, settings) {
    setCheckbox(root, '.js-df-form-guard-enabled', settings.df_form_guard_enabled);
    setValue(root, '[name="df_form_guard_prompt"]', settings.df_form_guard_prompt);
    setCheckbox(root, '[name="df_form_guard_block_admin_mail_on_ng"][type="checkbox"]', settings.df_form_guard_block_admin_mail_on_ng);
    setValue(root, '[name="df_form_guard_error_action"]', settings.df_form_guard_error_action);
    setValue(root, '[name="df_form_guard_max_input_chars"]', settings.df_form_guard_max_input_chars);
    setValue(root, '[name="df_form_guard_reference_eids"]', settings.df_form_guard_reference_eids, true);
    setValue(root, '[name="df_form_guard_reference_max_chars"]', settings.df_form_guard_reference_max_chars);
    setCheckbox(root, '[name="df_form_guard_store_reason"][type="checkbox"]', settings.df_form_guard_store_reason);
  }

  function setValue(root, selector, value, triggerChange) {
    var input = root.querySelector(selector);
    if (!input || typeof value === 'undefined' || value === null) {
      return;
    }
    input.value = String(value);
    if (triggerChange) {
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  function setCheckbox(root, selector, value) {
    var input = root.querySelector(selector);
    if (!input || typeof value === 'undefined' || value === null) {
      return;
    }
    input.checked = isEnabled(value);
  }

  function postJsonWithFallback(actions, buildFormData) {
    var names = Array.isArray(actions) ? actions.slice() : [actions];
    return tryPostAction(0);

    function tryPostAction(index) {
      var action = names[index];
      if (!action) {
        return Promise.reject(new Error('通信に失敗しました。'));
      }
      return fetch(window.location.href, {
        method: 'POST',
        body: buildFormData(action),
        credentials: 'same-origin',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'X-Csrf-Token': getCsrfToken()
        }
      })
        .then(function(response) {
          if (!response.ok) {
            throw new Error('通信に失敗しました。');
          }
          return response.text();
        })
        .then(function(text) {
          try {
            return text ? JSON.parse(text) : {};
          } catch (error) {
            throw new Error('通信結果を読み取れませんでした。');
          }
        })
        .catch(function(error) {
          if (index + 1 >= names.length) {
            throw error;
          }
          return tryPostAction(index + 1);
        });
    }
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

  function getCurrentFmid() {
    var params = new URLSearchParams(window.location.search || '');
    var value = params.get('fmid');
    var match;
    if (!value) {
      match = String(window.location.pathname || '').match(/(?:^|\/)fmid\/(\d+)(?:\/|$)/);
      value = match ? match[1] : '';
    }
    value = parseInt(value, 10);
    return Number.isFinite(value) && value > 0 ? String(value) : '';
  }

  function isEnabled(value) {
    var normalized = String(value || '').trim().toLowerCase();
    return normalized === 'enabled' || normalized === 'on' || normalized === '1' || normalized === 'true';
  }

  function isDebugEnabled() {
    try {
      return window.localStorage.getItem('DFFormGuardDebug') === '1';
    } catch (error) {
      return false;
    }
  }

  function warnDebug() {
    if (!isDebugEnabled() || !window.console || !console.warn) {
      return;
    }
    console.warn.apply(console, arguments);
  }

  function parseEids(value) {
    var seen = {};
    return String(value || '')
      .split(/[,\s]+/)
      .map(function(part) {
        return parseInt(part, 10);
      })
      .filter(function(eid) {
        if (!Number.isFinite(eid) || eid <= 0 || seen[eid]) {
          return false;
        }
        seen[eid] = true;
        return true;
      });
  }
})();
