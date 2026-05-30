
const API = ''; // 같은 서버이므로 빈 문자열 (상대경로)
let slots = [null, null]; // { seq, name } or null
let slotCount = 2;
let searchCategory = 'all';
let cabDrugs = []; // { seq, name, category, color }
const COLORS = ['#2563EB','#16A34A','#D97706','#7C3AED','#DC2626'];
let currentSlotIdx = 0; // 현재 입력 중인 슬롯 인덱스

// ── 새 UI: 약 태그 렌더링 ──────────────────────────────
function renderDrugTags() {
  const wrap = document.getElementById('selectedDrugsWrap');
  const analyzeBigBtn = document.getElementById('analyzeBigBtn');
  const mainInput = document.getElementById('mainInput');
  if (!wrap) return;

  const selectedSlots = slots.filter(Boolean);

  // 태그 렌더
  let html = selectedSlots.map((s, i) => {
    const realIdx = slots.indexOf(s);
    return `<span class="drug-tag">💊 ${s.name}<button class="drug-tag__remove" onclick="clearSlotNew(${realIdx})">✕</button></span>`;
  }).join('');

  // 2개 미만이면 "+ 두 번째 약 추가하기" 버튼 표시
  if (selectedSlots.length > 0 && selectedSlots.length < 3) {
    html += `<button class="add-second-btn" onclick="activateNewSlot()">+ ${selectedSlots.length === 1 ? '두 번째' : '세 번째'} 약 추가하기</button>`;
  }

  wrap.innerHTML = html;
  wrap.classList.toggle('show', selectedSlots.length > 0);

  // 분석 버튼: 2개 이상 선택 시
  analyzeBigBtn.classList.toggle('show', selectedSlots.length >= 2);

  // 입력창 placeholder 업데이트
  if (selectedSlots.length === 0) {
    mainInput.placeholder = '약 이름이나 성분을 검색해 보세요';
    currentSlotIdx = 0;
  } else if (selectedSlots.length === 1) {
    mainInput.placeholder = '두 번째 약 이름을 검색해 보세요';
  }
}

function clearSlotNew(idx) {
  slots[idx] = null;
  renderDrugTags();
}

function activateNewSlot() {
  // 빈 슬롯 찾기
  for (let i = 0; i < slots.length; i++) {
    if (!slots[i]) { currentSlotIdx = i; break; }
  }
  document.getElementById('mainInput').value = '';
  document.getElementById('mainInput').focus();
}

// 칩 검색
function chipSearch(name) {
  const input = document.getElementById('mainInput');
  if (!input) return;
  input.value = name;
  onSearch(input, currentSlotIdx);
  input.focus();
}

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

  if (!items.length) {
    ac.innerHTML = `<div style="padding:16px 16px;text-align:center">
      <div style="font-size:22px;margin-bottom:6px">🔍</div>
      <div style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:4px">'${q}' 검색 결과가 없어요</div>
      <div style="font-size:12px;color:var(--text-tertiary);line-height:1.6">
        약 이름 또는 성분명으로 다시 검색해 보세요<br>
        예: 타이레놀, 아세트아미노펜, 오메가3
      </div>
    </div>`;
    ac.style.display = 'block';
    return;
  }
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
  // 기존 호환
  const drugSlotsEl = document.getElementById('drugSlots');
  if (drugSlotsEl) {
    const slot = drugSlotsEl.querySelectorAll('.drug-slot')[idx];
    if (slot) {
      slot.querySelector('input').value = name;
      slot.querySelector('.slot-clear').classList.add('show');
    }
  }
  document.getElementById('ac-' + idx).style.display = 'none';
  // 새 UI: 입력창 초기화 + 태그 렌더
  const mainInput = document.getElementById('mainInput');
  if (mainInput) mainInput.value = '';
  // 다음 빈 슬롯으로 포커스
  for (let i = 0; i < slots.length; i++) {
    if (!slots[i]) { currentSlotIdx = i; break; }
  }
  renderDrugTags();
}

function hideAc(idx) { setTimeout(() => { const el = document.getElementById('ac-' + idx); if (el) el.style.display = 'none'; }, 200); }
function toggleClear(idx, show) {
  const drugSlotsEl = document.getElementById('drugSlots');
  if (!drugSlotsEl) return;
  const slot = drugSlotsEl.querySelectorAll('.drug-slot')[idx];
  if (slot) slot.querySelector('.slot-clear')?.classList.toggle('show', show);
}
function clearSlot(idx) {
  slots[idx] = null;
  const drugSlotsEl = document.getElementById('drugSlots');
  if (drugSlotsEl) {
    const slot = drugSlotsEl.querySelectorAll('.drug-slot')[idx];
    if (slot) slot.querySelector('input').value = '';
  }
  toggleClear(idx, false);
  renderDrugTags();
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
function showPage(name, btn, fromTab) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');

  // 상단 nav 업데이트
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  if (btn && !fromTab) btn.classList.add('active');
  else {
    const map = { home:0, cabinet:1, symptoms:2, guide:3 };
    const links = document.querySelectorAll('.nav-link');
    if (map[name] !== undefined) links[map[name]]?.classList.add('active');
  }

  // 하단 탭바 업데이트
  document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
  const tabEl = document.getElementById('tab-' + name);
  if (tabEl) tabEl.classList.add('active');

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

// ── 복약 알림 (Service Worker 기반) ──────────────────────
let alarms = JSON.parse(localStorage.getItem('pill_alarms') || '[]');
let swReg = null; // Service Worker registration

// SW 등록
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
    .then(reg => {
      swReg = reg;
      sendAlarmsToSW();
    })
    .catch(err => console.warn('SW 등록 실패:', err));
}

function saveAlarms() {
  localStorage.setItem('pill_alarms', JSON.stringify(alarms));
  sendAlarmsToSW();
}

// SW에 알람 목록 전달 (SW가 스케줄링 담당)
async function sendAlarmsToSW() {
  if (!swReg) return;
  const sw = swReg.active || swReg.installing || swReg.waiting;
  if (!sw) return;
  sw.postMessage({ type: 'SCHEDULE_ALARMS', alarms });
}

function renderAlarms() {
  const list = document.getElementById('alarmList');
  if (!list) return;
  if (alarms.length === 0) {
    list.innerHTML = '<div style="font-size:13px;color:var(--text-tertiary);text-align:center;padding:8px 0">설정된 알림이 없어요</div>';
    return;
  }
  // 다음 알림까지 남은 시간 계산
  function getTimeLeft(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    const now = new Date();
    const next = new Date();
    next.setHours(h, m, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    const diff = Math.round((next - now) / 60000);
    if (diff < 60) return `${diff}분 후`;
    const hh = Math.floor(diff / 60), mm = diff % 60;
    return mm > 0 ? `${hh}시간 ${mm}분 후` : `${hh}시간 후`;
  }
  list.innerHTML = alarms.map((a, i) => `
    <div class="alarm-item">
      <div class="alarm-item__left">
        <div>
          <span class="alarm-item__time">${a.time}</span>
          <span class="alarm-item__label">${a.label || '복약 시간'}</span>
        </div>
        ${a.on ? `<div style="font-size:11px;color:var(--text-tertiary);margin-top:2px">⏱ ${getTimeLeft(a.time)}</div>` : '<div style="font-size:11px;color:var(--text-tertiary);margin-top:2px">꺼짐</div>'}
      </div>
      <div style="display:flex;align-items:center;gap:4px">
        <label class="alarm-item__toggle">
          <input type="checkbox" ${a.on ? 'checked' : ''} onchange="toggleAlarm(${i}, this.checked)">
          <span class="alarm-item__slider"></span>
        </label>
        <span class="alarm-item__del" onclick="deleteAlarm(${i})">✕</span>
      </div>
    </div>
  `).join('');
}

function addAlarm() {
  const time = document.getElementById('alarmTimeInput').value;
  const label = document.getElementById('alarmLabelInput').value.trim();
  if (!time) return;
  alarms.push({ time, label, on: true, id: Date.now() });
  saveAlarms();
  renderAlarms();
  document.getElementById('alarmLabelInput').value = '';
  toast(`⏰ ${time} 알림이 설정됐어요!`);
}

function deleteAlarm(i) {
  alarms.splice(i, 1);
  saveAlarms();
  renderAlarms();
}

function toggleAlarm(i, on) {
  alarms[i].on = on;
  saveAlarms();
  renderAlarms();
}

async function requestAlarmPermission() {
  if (!('Notification' in window)) {
    alert('이 브라우저는 알림을 지원하지 않아요.');
    return;
  }
  // SW 권한 요청
  const result = await Notification.requestPermission();
  updatePermBadge();
  if (result === 'granted') {
    toast('🔔 알림 권한이 허용됐어요! 탭을 닫아도 알림이 와요.');
    sendAlarmsToSW();
  } else if (result === 'denied') {
    toast('알림 권한이 거부됐어요. 브라우저 주소창 왼쪽 자물쇠 아이콘에서 허용해 주세요.');
  }
}

function updatePermBadge() {
  const badge = document.getElementById('alarmPermBadge');
  const btn = document.getElementById('alarmPermBtn');
  if (!badge || !btn) return;
  const perm = Notification?.permission;
  const swSupport = 'serviceWorker' in navigator;
  if (perm === 'granted') {
    badge.textContent = swSupport ? '✅ SW 알림 활성' : '✅ 알림 허용됨';
    badge.style.background = '#E8FAF0'; badge.style.color = '#00B761';
    btn.textContent = '✅ 알림 활성화됨';
    btn.classList.add('granted');
  } else if (perm === 'denied') {
    badge.textContent = '🚫 알림 차단됨';
    badge.style.background = '#FFF0F0'; badge.style.color = '#F04452';
    btn.textContent = '🚫 브라우저 설정에서 허용 필요';
    btn.classList.add('granted');
  } else {
    badge.textContent = swSupport ? 'SW 대기 중' : '알림 꺼짐';
  }
}

// ── 햄버거 드로어 ────────────────────────────────────────
function toggleDrawer() {
  const drawer = document.getElementById('drawer');
  const overlay = document.getElementById('drawerOverlay');
  const isOpen = drawer.classList.contains('open');
  if (isOpen) closeDrawer();
  else {
    drawer.classList.add('open');
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}
function closeDrawer() {
  document.getElementById('drawer').classList.remove('open');
  document.getElementById('drawerOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

// ── AI 챗봇 ──────────────────────────────────────────────
function openChatBot() {
  document.getElementById('chatModal').classList.add('open');
  document.getElementById('chatInput').focus();
}
function closeChatBot() {
  document.getElementById('chatModal').classList.remove('open');
}
// 모달 바깥 클릭 시 닫기
document.addEventListener('click', e => {
  const modal = document.getElementById('chatModal');
  const box = modal?.querySelector('.chat-modal__box');
  const fab = document.getElementById('fabChat');
  if (modal?.classList.contains('open') && !box?.contains(e.target) && !fab?.contains(e.target)) {
    closeChatBot();
  }
});

function appendMsg(text, role) {
  const wrap = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = `chat-msg chat-msg--${role}`;
  div.innerHTML = `<div class="chat-msg__bubble">${text}</div>`;
  wrap.appendChild(div);
  wrap.scrollTop = wrap.scrollHeight;
  return div;
}

async function sendChat() {
  const input = document.getElementById('chatInput');
  const q = input.value.trim();
  if (!q) return;
  input.value = '';
  appendMsg(q, 'user');
  const typing = appendMsg('답변을 생성 중이에요...', 'bot chat-msg--typing');
  try {
    const r = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: q })
    });
    const data = await r.json();
    typing.remove();
    appendMsg(data.reply || '죄송해요, 잠시 후 다시 시도해 주세요.', 'bot');
  } catch {
    typing.remove();
    appendMsg('서버 연결에 실패했어요. 잠시 후 다시 시도해 주세요.', 'bot');
  }
}

// ── 초기화 ────────────────────────────────────────────────
renderSymptoms();
renderCabList();
loadStats();
renderAlarms();
renderDrugTags();
updatePermBadge();
setInterval(renderAlarms, 60000);
