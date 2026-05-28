
const API = ''; // 같은 서버이므로 빈 문자열 (상대경로)
let slots = [null, null]; // { seq, name } or null
let slotCount = 2;
let searchCategory = 'all';
let cabDrugs = []; // { seq, name, category, color }
const COLORS = ['#2563EB','#16A34A','#D97706','#7C3AED','#DC2626'];

// ── 검색 ──────────────────────────────────────────────────
async function onSearch(input, idx) {
  const q = input.value.trim();
  if (slots[idx] && input.value === slots[idx].name) return;
  slots[idx] = null;
  toggleClear(idx, !!q);
  const ac = document.getElementById('ac-' + idx);
  if (!q) { ac.style.display = 'none'; return; }

  const res = await fetch(`${API}/api/search?q=${encodeURIComponent(q)}&category=${searchCategory}&limit=8`).catch(() => null);
  if (!res || !res.ok) return;
  const items = await res.json();

  if (!items.length) { ac.style.display = 'none'; return; }
  ac.innerHTML = items.map(d =>
    `<div class="ac-item" onmousedown="selectDrug(${idx},'${d.item_seq}','${d.item_name.replace(/'/g,"\\'")}','${d.category}')">
      <span>${d.item_name}</span>
      <span style="font-size:12px;color:var(--muted)">${d.ingredient||''}</span>
      <span class="ac-cat">${d.category === 'drug' ? '의약품' : '건기식'}</span>
    </div>`
  ).join('');
  ac.style.display = 'block';
}

function selectDrug(idx, seq, name, category) {
  slots[idx] = { seq, name, category };
  const slot = document.getElementById('drugSlots').querySelectorAll('.drug-slot')[idx];
  slot.querySelector('input').value = name;
  slot.querySelector('.slot-clear').classList.add('show');
  document.getElementById('ac-' + idx).style.display = 'none';
}

function hideAc(idx) { setTimeout(() => { const el = document.getElementById('ac-' + idx); if (el) el.style.display = 'none'; }, 200); }
function toggleClear(idx, show) {
  const slot = document.getElementById('drugSlots').querySelectorAll('.drug-slot')[idx];
  if (slot) slot.querySelector('.slot-clear').classList.toggle('show', show);
}
function clearSlot(idx) {
  slots[idx] = null;
  const slot = document.getElementById('drugSlots').querySelectorAll('.drug-slot')[idx];
  slot.querySelector('input').value = '';
  toggleClear(idx, false);
}

function setCategory(cat, btn) {
  searchCategory = cat;
  document.querySelectorAll('.search-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
}

function addSlot() {
  if (slotCount >= 5) { toast('최대 5개까지 가능합니다'); return; }
  const idx = slotCount++;
  slots.push(null);
  const div = document.createElement('div');
  div.className = 'drug-slot';
  div.dataset.idx = idx;
  div.innerHTML = `<input type="text" placeholder="${idx+1}번째 약 검색" oninput="onSearch(this,${idx})" onfocus="onSearch(this,${idx})" onblur="hideAc(${idx})" autocomplete="off">
    <div class="slot-badge"><span class="slot-tag">약 ${idx+1}</span><span class="slot-clear" onclick="clearSlot(${idx})">✕</span></div>
    <div class="autocomplete" id="ac-${idx}" style="display:none"></div>`;
  document.getElementById('drugSlots').appendChild(div);
}

// ── 상호작용 체크 ──────────────────────────────────────────
async function checkInteraction() {
  const selected = slots.filter(Boolean);
  if (selected.length < 2) { toast('약을 2개 이상 선택해야 천재가 분석할 수 있어요'); return; }

  document.getElementById('resultSection').style.display = 'block';
  document.getElementById('resultCard').innerHTML = '';
  document.getElementById('checkLoading').style.display = 'block';
  document.getElementById('resultSection').scrollIntoView({ behavior: 'smooth', block: 'start' });

  const res = await fetch(`${API}/api/interactions/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ drug_seqs: selected.map(s => s.seq) })
  }).catch(() => null);

  document.getElementById('checkLoading').style.display = 'none';

  if (!res || !res.ok) { toast('오류가 발생했습니다. 다시 시도해주세요.'); return; }
  const data = await res.json();
  renderResult(data, selected);
}

function renderResult(data, selected) {
  const sevClass = { 1:'b-safe', 2:'b-caution', 3:'b-warning', 4:'b-danger' };
  const sevLabel = { 1:'안전', 2:'주의', 3:'경고', 4:'위험' };
  const iconBg = { 1:'i-safe', 2:'i-caution', 3:'i-warning', 4:'i-warning' };
  const iconChar = { 1:'✓', 2:'⚠', 3:'✗', 4:'☠' };
  const sevColor = { 1:'var(--safe)', 2:'var(--caution)', 3:'var(--danger)', 4:'var(--danger)' };

  let html = `<div class="result-header">
    <div class="result-badge ${sevClass[data.overall_severity]}">${sevLabel[data.overall_severity]}</div>
    <div class="result-title">${selected.map(s => s.name).join(' + ')}</div>
  </div><div class="result-body">`;

  for (const pair of data.pairs) {
    const sev = pair.severity;
    if (pair.interaction) {
      html += `<div class="pair-row">
        <div class="pair-icon ${iconBg[sev]}">${iconChar[sev]}</div>
        <div class="pair-info">
          <div class="pair-drugs" style="color:${sevColor[sev]}">${pair.drug_a.item_name} + ${pair.drug_b.item_name}</div>
          <div style="font-size:13px;font-weight:600;margin-bottom:4px">${pair.interaction.clinical_effect}</div>
          <div class="pair-effect">${pair.interaction.mechanism}</div>
          ${pair.interaction.management ? `<div class="pair-manage">📌 ${pair.interaction.management}</div>` : ''}
          <span class="source-tag">출처: ${pair.interaction.source}</span>
        </div>
      </div>`;
    } else {
      html += `<div class="pair-row">
        <div class="pair-icon i-safe">✓</div>
        <div class="pair-info">
          <div class="pair-drugs">${pair.drug_a.item_name} + ${pair.drug_b.item_name}</div>
          <div class="pair-effect" style="color:var(--safe)">이 조합은 안전합니다 ✓</div>
          <span class="source-tag">DUR 기준</span>
        </div>
      </div>`;
    }
  }

  html += `<div style="margin-top:16px">
    <button onclick="addResultToCabinet()" style="background:var(--bg);border:1.5px solid var(--border);color:var(--text);padding:8px 16px;border-radius:8px;font-size:13px;cursor:pointer">
      💊 내 약통에 담기
    </button>
  </div></div>`;

  document.getElementById('resultCard').innerHTML = html;
  window._lastSelected = selected;
}

function addResultToCabinet() {
  if (!window._lastSelected) return;
  window._lastSelected.forEach(s => {
    if (!cabDrugs.find(d => d.seq === s.seq)) {
      cabDrugs.push({ seq: s.seq, name: s.name, category: s.category, color: COLORS[cabDrugs.length % 5] });
    }
  });
  renderCabList();
  toast('내 약통에 담겼어요 💊');
}

// ── 복약함 ──────────────────────────────────────────────────
function renderCabList() {
  const el = document.getElementById('cabList');
  document.getElementById('cabCount').textContent = `${cabDrugs.length}개`;
  if (!cabDrugs.length) {
    el.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted);font-size:13px">아직 약통이 비어있어요<br>위에서 약을 검색해 담아보세요 💊</div>';
    return;
  }
  el.innerHTML = cabDrugs.map((d, i) =>
    `<div class="drug-item">
      <div class="drug-dot" style="background:${d.color}"></div>
      <div class="drug-name-wrap"><div class="drug-nm">${d.name}</div><div class="drug-cat">${d.category === 'drug' ? '의약품' : '건강기능식품'}</div></div>
      <span class="drug-rm" onclick="removeCab(${i})">✕</span>
    </div>`
  ).join('');
}

function removeCab(idx) { cabDrugs.splice(idx, 1); renderCabList(); }

let cabAcItems = [];
async function cabSearch(input) {
  const q = input.value.trim();
  const acEl = document.getElementById('cabAc');
  if (!q) { acEl.style.display = 'none'; return; }
  const res = await fetch(`${API}/api/search?q=${encodeURIComponent(q)}&limit=6`).catch(() => null);
  if (!res) return;
  const items = await res.json();
  cabAcItems = items;
  if (!items.length) { acEl.style.display = 'none'; return; }
  acEl.innerHTML = `<div class="autocomplete" style="position:static;display:block">${items.map((d,i) =>
    `<div class="ac-item" onmousedown="addToCab(${i})">${d.item_name} <span class="ac-cat">${d.category==='drug'?'의약품':'건기식'}</span></div>`
  ).join('')}</div>`;
  acEl.style.display = 'block';
}

function addToCab(idx) {
  const d = cabAcItems[idx];
  if (!cabDrugs.find(x => x.seq === d.item_seq)) {
    cabDrugs.push({ seq: d.item_seq, name: d.item_name, category: d.category, color: COLORS[cabDrugs.length % 5] });
  }
  renderCabList();
  document.getElementById('cabInput').value = '';
  document.getElementById('cabAc').style.display = 'none';
}

async function checkCabinet() {
  if (cabDrugs.length < 2) { toast('약통에 2개 이상 담아야 분석할 수 있어요'); return; }
  const resEl = document.getElementById('cabResult');
  resEl.innerHTML = '<div style="padding:20px;text-align:center"><span class="spinner" style="display:inline-block"></span></div>';

  const res = await fetch(`${API}/api/interactions/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ drug_seqs: cabDrugs.map(d => d.seq) })
  }).catch(() => null);

  if (!res) { resEl.innerHTML = '<div style="padding:16px;color:var(--danger)">오류가 발생했습니다</div>'; return; }
  const data = await res.json();

  const sevColor = { 1:'var(--safe)', 2:'var(--caution)', 3:'var(--warning)', 4:'var(--danger)' };
  const issues = data.pairs.filter(p => p.severity > 1);

  let html = '';
  if (!issues.length) {
    html = '<div class="matrix-cell"><div class="matrix-dot" style="background:var(--safe)"></div><div class="matrix-text"><div class="matrix-pair">모든 조합 안전 ✓</div><div class="matrix-status" style="color:var(--safe)">천재가 확인했습니다 — 이 조합은 안전해요</div></div></div>';
  } else {
    html = issues.map(p => `
      <div class="matrix-cell">
        <div class="matrix-dot" style="background:${sevColor[p.severity]}"></div>
        <div class="matrix-text">
          <div class="matrix-pair">${p.drug_a.item_name} + ${p.drug_b.item_name}</div>
          <div class="matrix-status" style="color:${sevColor[p.severity]}">${p.severity >= 3 ? '⚠' : 'ℹ'} ${p.interaction?.clinical_effect || p.severity_label}</div>
        </div>
      </div>`).join('');
    html += `<div style="padding:12px 20px;background:#FFF7ED;border-top:1px solid var(--border);font-size:12px;color:#92400E">⚠️ 이슈 ${issues.length}건 발견 — 약사 상담을 꼭 받아보세요</div>`;
  }
  resEl.innerHTML = html;
}

// ── 증상 검색 ──────────────────────────────────────────────
const SYMPTOMS = [
  { name:'두통', icon:'🤕' }, { name:'발열', icon:'🌡️' }, { name:'소화불량', icon:'😮‍💨' },
  { name:'알레르기', icon:'🤧' }, { name:'불면', icon:'😴' }, { name:'혈전예방', icon:'🩸' },
  { name:'당뇨', icon:'💉' }, { name:'고혈압', icon:'❤️' }, { name:'고지혈증', icon:'🔬' },
  { name:'위염', icon:'🔥' }, { name:'갑상선', icon:'🦋' }, { name:'감염', icon:'🦠' },
];

function renderSymptoms() {
  document.getElementById('symptomGrid').innerHTML = SYMPTOMS.map(s =>
    `<div class="sym-card" onclick="loadSymptom('${s.name}')"><div class="sym-icon">${s.icon}</div><div class="sym-name">${s.name}</div></div>`
  ).join('');
}

async function loadSymptom(name) {
  const resEl = document.getElementById('symResult');
  resEl.style.display = 'block';
  resEl.innerHTML = '<div style="padding:20px;text-align:center"><span class="spinner" style="display:inline-block"></span></div>';

  const res = await fetch(`${API}/api/symptoms?symptom=${encodeURIComponent(name)}`).catch(() => null);
  if (!res) return;
  const data = await res.json();

  if (!data.drugs || !data.drugs.length) {
    resEl.innerHTML = `<div style="padding:16px;color:var(--muted)">${name}에 대한 정보가 없습니다.</div>`;
    return;
  }

  resEl.innerHTML = `<div class="result-card">
    <div class="result-header"><div class="result-badge b-safe">${name}</div><div class="result-title">관련 약물 ${data.drugs.length}개</div></div>
    <div class="result-body">
      <div style="margin-bottom:12px">${data.drugs.map(d =>
        `<span style="display:inline-block;background:#EFF6FF;color:var(--primary);padding:5px 12px;border-radius:16px;font-size:13px;margin:4px 4px 4px 0;cursor:pointer" onclick="prefillSearch('${d.item_seq}','${d.item_name}','${d.category}')">${d.item_name}</span>`
      ).join('')}</div>
      <div style="font-size:13px;color:var(--muted);line-height:1.6">약품명을 클릭하면 검색창에 자동입력됩니다. 상호작용 체크 탭에서 천재한테 물어보세요.</div>
    </div>
  </div>`;
  resEl.scrollIntoView({ behavior: 'smooth' });
}

function prefillSearch(seq, name, category) {
  showPage('home');
  slots[0] = { seq, name, category };
  const input = document.getElementById('drugSlots').querySelector('input');
  input.value = name;
  toggleClear(0, true);
  toast(name + ' 이(가) 약 1에 입력되었습니다');
}

// ── 가이드 탭 ──────────────────────────────────────────────
function guideTab(btn, id) {
  document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.guide-panel').forEach(p => { p.style.display = 'none'; p.classList.remove('active'); });
  const panel = document.getElementById(id);
  panel.style.display = 'block';
  panel.classList.add('active');
}

// ── 페이지 이동 ──────────────────────────────────────────────
function showPage(name, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  if (btn) btn.classList.add('active');
  else {
    const map = { home:0, cabinet:1, symptoms:2, guide:3 };
    const links = document.querySelectorAll('.nav-link');
    if (map[name] !== undefined) links[map[name]].classList.add('active');
  }
  window.scrollTo(0, 0);
}

// ── 통계 로드 ──────────────────────────────────────────────
async function loadStats() {
  const res = await fetch(`${API}/api/admin/stats`).catch(() => null);
  if (!res) return;
  const d = await res.json();
  document.getElementById('stat-drugs').textContent = d.drugs?.toLocaleString() || '-';
  document.getElementById('stat-supp').textContent = d.supplements?.toLocaleString() || '-';
  document.getElementById('stat-inter').textContent = d.interactions?.toLocaleString() || '-';
}

// ── Toast ──────────────────────────────────────────────────
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// ── 초기화 ────────────────────────────────────────────────
renderSymptoms();
renderCabList();
loadStats();
