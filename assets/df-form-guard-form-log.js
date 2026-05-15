(function() {
  'use strict';

  document.addEventListener('DOMContentLoaded', function() {
    var root = document.querySelector('.js-df-form-guard-form-log');
    if (!root) {
      return;
    }
    setupFormLog(root);
  });

  function setupFormLog(root) {
    var fmid = parseInt(root.getAttribute('data-fmid') || '', 10);
    var rows = collectRows();
    var serials = rows.map(function(item) {
      return item.serial;
    });
    if (!fmid || rows.length === 0) {
      return;
    }
    addHeader(rows[0].row);
    rows.forEach(function(item) {
      item.cell = addCell(item.row);
      renderEmpty(item.cell, '読み込み中');
    });
    loadDecisions(fmid, serials)
      .then(function(json) {
        var decisions = json && json.decisions ? json.decisions : {};
        rows.forEach(function(item) {
          renderDecision(item.cell, decisions[String(item.serial)]);
        });
      })
      .catch(function() {
        rows.forEach(function(item) {
          renderEmpty(item.cell, '未判定');
        });
      });
  }

  function collectRows() {
    var rows = [];
    document.querySelectorAll('input[name="checks[]"]').forEach(function(input) {
      var parts = String(input.value || '').split(':');
      var serial = parseInt(parts[1] || '', 10);
      var row = closest(input, 'tr');
      if (!serial || !row) {
        return;
      }
      rows.push({
        serial: serial,
        row: row,
      });
    });
    return rows;
  }

  function addHeader(firstRow) {
    var table = closest(firstRow, 'table');
    var headerRow;
    var th;
    if (!table || table.getAttribute('data-df-form-guard-log-ready') === '1') {
      return;
    }
    table.setAttribute('data-df-form-guard-log-ready', '1');
    headerRow = table.querySelector('thead tr');
    if (!headerRow) {
      return;
    }
    th = document.createElement('th');
    th.textContent = 'AI判定';
    insertAfter(th, headerRow.children[2] || headerRow.lastElementChild);
  }

  function addCell(row) {
    var cell = document.createElement('td');
    cell.className = 'df-form-guard-log-cell';
    insertAfter(cell, row.children[2] || row.lastElementChild);
    return cell;
  }

  function renderDecision(cell, decision) {
    var normalized = normalizeResult(decision && decision.result);
    if (!normalized) {
      renderEmpty(cell, '未判定');
      return;
    }
    cell.textContent = '';
    cell.appendChild(badge(normalized));
    cell.appendChild(meta(decision));
    if (decision.reason) {
      cell.appendChild(reason(decision.reason));
    }
  }

  function renderEmpty(cell, label) {
    cell.textContent = '';
    cell.appendChild(badge('', label || '未判定'));
  }

  function badge(result, label) {
    var span = document.createElement('span');
    span.className = 'df-form-guard-log-badge df-form-guard-log-badge--' + (result ? result.toLowerCase() : 'empty');
    span.textContent = label || result;
    return span;
  }

  function meta(decision) {
    var lines = [];
    var div = document.createElement('div');
    div.className = 'df-form-guard-log-meta';
    if (decision.category) {
      lines.push('カテゴリ: ' + decision.category);
    }
    if (decision.confidence) {
      lines.push('信頼度: ' + decision.confidence);
    }
    if (decision.admin_mail_blocked) {
      lines.push('管理者宛メール停止: ' + decision.admin_mail_blocked);
    }
    if (decision.checked_at) {
      lines.push('判定日時: ' + decision.checked_at);
    }
    div.textContent = lines.join(' / ');
    return div;
  }

  function reason(text) {
    var details = document.createElement('details');
    var summary = document.createElement('summary');
    var body = document.createElement('div');
    details.className = 'df-form-guard-log-reason';
    summary.textContent = '判定理由';
    body.className = 'df-form-guard-log-reason__body';
    body.textContent = text;
    details.appendChild(summary);
    details.appendChild(body);
    return details;
  }

  function loadDecisions(fmid, serials) {
    return postJsonWithFallback(
      ['ACMS_POST_DF_FormGuard_FormGuardLogDecisions', 'ACMS_POST_FormGuardLogDecisions'],
      function(action) {
        var formData = new FormData();
        formData.append(action, '1');
        formData.append('fmid', String(fmid));
        serials.forEach(function(serial) {
          formData.append('serials[]', String(serial));
        });
        appendCsrfToken(formData);
        return formData;
      },
      'DF_FormGuardの判定結果を取得できませんでした。'
    ).then(function(json) {
      if (!json || json.status !== 'success') {
        throw new Error((json && json.message) || 'DF_FormGuardの判定結果を取得できませんでした。');
      }
      return json;
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
            throw new Error(failureMessage || '通信結果を読み取れませんでした。');
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

  function normalizeResult(value) {
    var result = String(value || '').trim().toUpperCase();
    return ['OK', 'NG', 'ERROR'].indexOf(result) === -1 ? '' : result;
  }

  function insertAfter(node, reference) {
    if (!reference || !reference.parentNode) {
      return;
    }
    reference.parentNode.insertBefore(node, reference.nextSibling);
  }

  function closest(element, selector) {
    if (element.closest) {
      return element.closest(selector);
    }
    while (element) {
      if (matches(element, selector)) {
        return element;
      }
      element = element.parentElement;
    }
    return null;
  }

  function matches(element, selector) {
    var matcher = element.matches || element.msMatchesSelector || element.webkitMatchesSelector;
    return matcher ? matcher.call(element, selector) : false;
  }
})();
