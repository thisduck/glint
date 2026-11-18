'use strict';
const { ipcRenderer } = require('electron');

window.addEventListener('DOMContentLoaded', () => {
  const rowsEl = document.getElementById('rows');
  const clockEl = document.getElementById('clock');
  const titleEl = document.getElementById('title');
  const main = document.getElementById('main');
  let state = { mode: 'setup', rows: [] };
  let structureKey = '';
  let lastHeight = 0;

  const send = (id, value) => ipcRenderer.send('trayAction', state.mode, id, value, state.profileId);

  function reportHeight() {
    const h = Math.ceil(main.getBoundingClientRect().height);
    if (h !== lastHeight) {
      lastHeight = h;
      ipcRenderer.send('trayHeight', h);
    }
  }
  new ResizeObserver(reportHeight).observe(main);

  function keyOf(s) {
    return s.mode + '|' + (s.rows || []).map(r =>
      [r.id, r.kind, r.group || '', r.label, r.primary ? 1 : 0,
       (r.options || []).map(o => o.value + ':' + o.label).join(',')].join('/')).join(';');
  }

  function build() {
    rowsEl.textContent = '';
    let groupEl = null, groupName;
    for (const r of state.rows || []) {
      const g = r.group || '';
      if (!groupEl || g !== groupName) {
        groupName = g;
        groupEl = document.createElement('div');
        groupEl.className = 'group';
        groupEl.setAttribute('role', 'group');
        if (g) {
          const t = document.createElement('div');
          t.className = 'group-title';
          t.textContent = g;
          groupEl.appendChild(t);
          groupEl.setAttribute('aria-label', g);
        }
        rowsEl.appendChild(groupEl);
      }
      const ctlId = 'ctl-' + r.id;
      if (r.kind === 'button') {
        const b = document.createElement('button');
        b.type = 'button';
        b.id = ctlId;
        b.className = 'action' + (r.primary ? ' primary' : '');
        b.textContent = r.label;
        b.addEventListener('click', () => send(r.id, r.value));
        groupEl.appendChild(b);
        continue;
      }
      const row = document.createElement('div');
      row.className = 'row';
      row.dataset.id = r.id;
      const lab = document.createElement('label');
      lab.htmlFor = ctlId;
      lab.textContent = r.label;
      row.appendChild(lab);
      let ctl;
      if (r.kind === 'switch') {
        ctl = document.createElement('input');
        ctl.type = 'checkbox';
        ctl.className = 'switch';
        ctl.setAttribute('role', 'switch');
        ctl.addEventListener('change', () => {
          ctl.setAttribute('aria-checked', String(ctl.checked));
          send(r.id, ctl.checked);
        });
        ctl.addEventListener('keydown', e => {
          if (e.key === 'Enter') { e.preventDefault(); ctl.click(); }
        });
      } else {
        ctl = document.createElement('select');
        for (const o of r.options || []) {
          const op = document.createElement('option');
          op.value = o.value;
          op.textContent = o.label;
          ctl.appendChild(op);
        }
        ctl.addEventListener('change', () => send(r.id, ctl.value));
      }
      ctl.id = ctlId;
      row.appendChild(ctl);
      groupEl.appendChild(row);
    }
  }

  function sync() {
    for (const r of state.rows || []) {
      const ctl = document.getElementById('ctl-' + r.id);
      if (!ctl) continue;
      ctl.disabled = !!r.disabled;
      const row = ctl.closest('.row');
      if (row) row.classList.toggle('disabled', !!r.disabled);
      if (r.kind === 'switch') {
        ctl.checked = r.value === true;
        ctl.setAttribute('aria-checked', String(ctl.checked));
      } else if (r.kind === 'select') {
        if (ctl.value !== String(r.value ?? '')) {
          ctl.value = String(r.value ?? '');
        }
      } else if (r.kind === 'button' && ctl.textContent !== r.label) {
        ctl.textContent = r.label;
      }
    }
  }

  ipcRenderer.on('trayState', (_e, s) => {
    state = s || { mode: 'setup', rows: [] };
    titleEl.textContent = state.mode === 'recording' ? 'Recording' : 'glint';
    clockEl.textContent = state.clock || '';
    const k = keyOf(state);
    if (k !== structureKey) {
      const focusedId = document.activeElement && document.activeElement.id;
      structureKey = k;
      build();
      if (focusedId) {
        const f = document.getElementById(focusedId);
        if (f) f.focus();
      }
    }
    sync();
    reportHeight();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      e.preventDefault();
      send('dismiss', undefined);
    }
  });
});
