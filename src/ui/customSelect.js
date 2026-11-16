/**
 * customSelect.js - Zero-Dependency Dark-Cinema Select2-Style Genre Dropdown
 */

const GENRE_ICON_RULES = [
  [/^all$/i, '🎵'],
  [/j-?pop|anime|ska|j-?rock/i, '⚡'],
  [/rock|post-hardcore|emo|punk|metal/i, '🎸'],
  [/acoustic|folk|ballad|singer/i, '🪕'],
  [/soul|r&b|jazz|blues/i, '🎷'],
  [/indie|alternative/i, '🌿'],
  [/pop|synth|electro|city/i, '🎹'],
];

export function getGenreIcon(genreValue) {
  const val = String(genreValue || '').trim();
  for (let i = 0; i < GENRE_ICON_RULES.length; i += 1) {
    if (GENRE_ICON_RULES[i][0].test(val)) return GENRE_ICON_RULES[i][1];
  }
  return '🎧';
}

/**
 * Enhance a native <select> into an accessible dark-cinema Select2-style dropdown.
 * Keeps the native <select> in DOM (visually sr-only) so existing .value / change listeners work.
 */
export function enhanceGenreSelect(selectEl, { allLabel = 'Semua Genre', compact = false } = {}) {
  if (!selectEl || selectEl.dataset.enhanced === '1') return null;
  selectEl.dataset.enhanced = '1';
  selectEl.classList.add('sr-only');
  selectEl.tabIndex = -1;

  const wrap = document.createElement('div');
  wrap.className = `cselect-wrap ${compact ? 'is-compact' : ''}`;

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'cselect-trigger';
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.innerHTML = `
    <span class="cselect-trigger-icon" aria-hidden="true">🎵</span>
    <span class="cselect-trigger-label">${allLabel}</span>
    <span class="cselect-trigger-caret" aria-hidden="true">▾</span>
  `;

  const dropdown = document.createElement('div');
  dropdown.className = 'cselect-dropdown';
  dropdown.hidden = true;
  dropdown.setAttribute('role', 'dialog');
  dropdown.setAttribute('aria-label', 'Filter Genre');
  dropdown.innerHTML = `
    <div class="cselect-search-wrap">
      <input type="search" class="cselect-search" placeholder="Cari genre..." aria-label="Cari genre">
    </div>
    <div class="cselect-list" role="listbox"></div>
  `;

  const searchInput = dropdown.querySelector('.cselect-search');
  const listEl = dropdown.querySelector('.cselect-list');
  const iconEl = trigger.querySelector('.cselect-trigger-icon');
  const labelEl = trigger.querySelector('.cselect-trigger-label');

  selectEl.insertAdjacentElement('afterend', wrap);
  wrap.appendChild(trigger);
  wrap.appendChild(dropdown);

  function updateTriggerLabel() {
    const val = selectEl.value || 'all';
    const opt = Array.from(selectEl.options).find((o) => o.value === val);
    const rawText = val === 'all' ? allLabel : opt?.textContent || val;
    if (iconEl) iconEl.textContent = getGenreIcon(val);
    if (labelEl) labelEl.textContent = rawText;
    trigger.classList.toggle('is-filtered', val !== 'all');
  }

  function renderOptions() {
    if (!listEl) return;
    const q = String(searchInput?.value || '').trim().toLowerCase();
    const curVal = selectEl.value || 'all';
    listEl.innerHTML = '';

    const opts = Array.from(selectEl.options).filter((o) => {
      if (!q) return true;
      return (o.textContent || o.value).toLowerCase().includes(q);
    });

    if (!opts.length) {
      listEl.innerHTML = '<div class="cselect-empty">Genre tidak ditemukan</div>';
      return;
    }

    const frag = document.createDocumentFragment();
    opts.forEach((opt) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = `cselect-option ${opt.value === curVal ? 'is-active' : ''}`;
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', String(opt.value === curVal));
      item.dataset.value = opt.value;

      const icon = getGenreIcon(opt.value);
      const countText = opt.dataset.count ? opt.dataset.count : '';
      const displayLabel = opt.value === 'all' ? allLabel : opt.textContent;

      item.innerHTML = `
        <span class="cselect-opt-left">
          <span class="cselect-opt-icon" aria-hidden="true">${icon}</span>
          <span class="cselect-opt-text"></span>
        </span>
        <span class="cselect-opt-right">
          ${countText ? `<span class="cselect-opt-count">${countText}</span>` : ''}
          <span class="cselect-opt-check" aria-hidden="true">${opt.value === curVal ? '✓' : ''}</span>
        </span>
      `;
      item.querySelector('.cselect-opt-text').textContent = displayLabel;

      item.addEventListener('click', (e) => {
        e.stopPropagation();
        selectEl.value = opt.value;
        selectEl.dispatchEvent(new Event('change', { bubbles: true }));
        updateTriggerLabel();
        closeDropdown();
      });

      frag.appendChild(item);
    });
    listEl.appendChild(frag);
  }

  function openDropdown() {
    dropdown.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    wrap.classList.add('is-open');
    if (searchInput) searchInput.value = '';
    renderOptions();
    searchInput?.focus({ preventScroll: true });
  }

  function closeDropdown() {
    if (dropdown.hidden) return;
    dropdown.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    wrap.classList.remove('is-open');
  }

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    if (dropdown.hidden) openDropdown();
    else closeDropdown();
  });

  searchInput?.addEventListener('input', renderOptions);
  searchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeDropdown();
      trigger.focus();
    }
  });

  const handleOutsideClick = (e) => {
    if (!wrap.contains(e.target)) closeDropdown();
  };
  const handleGlobalKey = (e) => {
    if (e.key === 'Escape' && !dropdown.hidden) closeDropdown();
  };
  document.addEventListener('click', handleOutsideClick);
  document.addEventListener('keydown', handleGlobalKey);

  updateTriggerLabel();

  return {
    syncOptions: () => {
      updateTriggerLabel();
      if (!dropdown.hidden) renderOptions();
    },
    close: closeDropdown,
    destroy: () => {
      document.removeEventListener('click', handleOutsideClick);
      document.removeEventListener('keydown', handleGlobalKey);
    },
  };
}
