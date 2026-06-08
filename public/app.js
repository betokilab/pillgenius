
const API = ''; // 같은 서버이므로 빈 문자열 (상대경로)

// ── Auth ────────────────────────────────────────────────────
function getToken()  { return localStorage.getItem('pg_token'); }
function getEmail()  { return localStorage.getItem('pg_email'); }
function isMember()  { return !!getToken(); }

function initAuthUI() {
  const token = getToken();
  const email = getEmail();
  const name  = email ? email.split('@')[0] : '';

  // 데스크탑 네비 버튼
  const navEl = document.getElementById('navAuthBtn');
  if (navEl) {
    if (token && email) {
      navEl.textContent = name;
      navEl.onclick = doLogout;
    } else {
      navEl.textContent = '로그인';
      navEl.onclick = () => { window.location.href = '/signup'; };
    }
  }

  // 모바일 드로어 버튼
  const drawerLabel = document.getElementById('drawerAuthLabel');
  if (drawerLabel) {
    drawerLabel.textContent = token ? `${name}님 · 로그아웃` : '로그인 / 회원가입';
  }
}

function drawerAuthAction() {
  closeDrawer();
  if (isMember()) doLogout();
  else window.location.href = '/signup';
}

function doLogout() {
  if (confirm('로그아웃 하시겠어요?')) {
    localStorage.removeItem('pg_token');
    localStorage.removeItem('pg_email');
    location.reload();
  }
}

// ── AI 상담 ─────────────────────────────────────────────────
const AI_FREE_LIMIT = 3;
let aiTrialUsed = Number(localStorage.getItem('aiTrialUsed') || 0);
let aiHistory = [];
let aiTyping = false;

function openAIChat() {
  document.getElementById('aiOverlay').classList.add('open');
  document.getElementById('aiModal').classList.add('open');
  updateTrialBadge();
  // 회원이면 무제한 안내
  const subEl = document.getElementById('aiModalSub');
  if (subEl) {
    subEl.textContent = isMember()
      ? `${getEmail()?.split('@')[0]}님 · AI 상담 무제한`
      : `식약처 DUR 기반 · 무료 ${Math.max(0, AI_FREE_LIMIT - aiTrialUsed)}회 남음`;
  }
  setTimeout(() => document.getElementById('aiChatInput').focus(), 400);
}

function closeAIChat() {
  document.getElementById('aiOverlay').classList.remove('open');
  document.getElementById('aiModal').classList.remove('open');
}

function updateTrialBadge() {
  const left = Math.max(0, AI_FREE_LIMIT - aiTrialUsed);
  const el = document.getElementById('aiTrialLeft');
  if (el) el.textContent = left;
}

function aiKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendAIMessage();
  }
}

async function sendAIMessage() {
  if (aiTyping) return;
  const input = document.getElementById('aiChatInput');
  const msg = input.value.trim();
  if (!msg) return;

  // 무료 횟수 체크 (비회원만)
  if (!isMember() && aiTrialUsed >= AI_FREE_LIMIT) {
    showSignupModal();
    return;
  }

  // 사용자 메시지 렌더
  input.value = '';
  input.style.height = 'auto';
  appendAIMsg('user', msg);

  // 로딩 표시
  aiTyping = true;
  const sendBtn = document.getElementById('aiChatSend');
  sendBtn.disabled = true;
  const loadingId = 'loading-' + Date.now();
  appendAIMsg('bot', '...', loadingId, true);

  try {
    const res = await fetch('/api/ai-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg, history: aiHistory, token: getToken() || undefined })
    });
    const data = await res.json();

    // 로딩 제거
    document.getElementById(loadingId)?.remove();

    const reply = data.reply || '답변을 받지 못했습니다.';
    appendAIMsg('bot', reply);

    // 히스토리 기록
    aiHistory.push({ role: 'user', content: msg });
    aiHistory.push({ role: 'assistant', content: reply });
    if (aiHistory.length > 20) aiHistory = aiHistory.slice(-20); // 최근 10턴만 유지

    // 사용 횟수 증가 (에러 아닐 때만)
    if (!data.error) {
      aiTrialUsed++;
      localStorage.setItem('aiTrialUsed', aiTrialUsed);
      updateTrialBadge();

      // 마지막 무료 사용이면 안내 메시지
      if (!isMember() && aiTrialUsed === AI_FREE_LIMIT) {
        setTimeout(() => {
          appendAIMsg('bot', '💡 무료 상담 3회를 모두 사용했어요. 회원가입하면 무제한으로 이용할 수 있어요!');
          setTimeout(() => showSignupModal(), 1500);
        }, 800);
      }
    }
  } catch(e) {
    document.getElementById(loadingId)?.remove();
    appendAIMsg('bot', '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
  } finally {
    aiTyping = false;
    sendBtn.disabled = false;
  }
}

function appendAIMsg(role, text, id, isLoading = false) {
  const body = document.getElementById('aiChatBody');
  const div = document.createElement('div');
  div.className = `ai-msg ai-msg--${role}${isLoading ? ' ai-msg-loading' : ''}`;
  if (id) div.id = id;
  // 줄바꿈 변환
  const html = text.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  div.innerHTML = `<div class="ai-msg-bubble">${html}</div>`;
  body.appendChild(div);
  body.scrollTop = body.scrollHeight;
}

function showSignupModal() {
  document.getElementById('aiSignupOverlay').classList.add('open');
  document.getElementById('aiSignupModal').classList.add('open');
}

function closeSignupModal() {
  document.getElementById('aiSignupOverlay').classList.remove('open');
  document.getElementById('aiSignupModal').classList.remove('open');
}

function goSignup() {
  window.location.href = '/signup';
}
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
    const isCustomMapped = s.customNotice?.startsWith('✅');
    const isCustomFailed = s.customNotice?.startsWith('⚠️');
    return `<span class="drug-tag${isCustomFailed ? ' drug-tag--warn' : ''}">
      ${isCustomMapped ? '🔗' : '💊'} ${s.name}
      <button class="drug-tag__remove" onclick="clearSlotNew(${realIdx})">✕</button>
    </span>`;
  }).join('');

  // 인식 알림 표시
  const notices = selectedSlots.filter(s => s.customNotice).map(s =>
    `<div class="custom-notice ${s.customNotice.startsWith('✅') ? 'custom-notice--ok' : 'custom-notice--warn'}">${s.customNotice}</div>`
  ).join('');
  if (notices) html = notices + html;

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

  // 직접 추가 옵션 (항상 맨 아래 표시)
  const customOption = `<div class="ac-item ac-item--custom" onmousedown="selectDrug(${idx},'custom-${Date.now()}','${q.replace(/'/g,"\\'")}','supplement')">
    <span style="font-size:16px">✏️</span>
    <span><strong>'${q}'</strong> 직접 추가하기</span>
    <span class="ac-cat" style="background:#F2F4F6;color:#8B95A1">직접입력</span>
  </div>`;

  if (!items.length) {
    ac.innerHTML = `<div style="padding:14px 16px;text-align:center;border-bottom:1px solid #F2F4F6">
      <div style="font-size:13px;color:var(--text-tertiary)">DB에 없는 제품이에요. 직접 추가할 수 있어요.</div>
    </div>${customOption}`;
    ac.style.display = 'block';
    return;
  }
  ac.innerHTML = items.map(d =>
    `<div class="ac-item" onmousedown="selectDrug(${idx},'${d.item_seq}','${d.item_name.replace(/'/g,"\\'")}','${d.category}')">
      <span>${d.item_name}</span>
      <span style="font-size:12px;color:var(--muted)">${d.ingredient||''}</span>
      <span class="ac-cat">${d.category === 'drug' ? '의약품' : '건기식'}</span>
    </div>`
  ).join('') + customOption;
  ac.style.display = 'block';
}

// ── 제품명 → DB 시퀀스 매핑 테이블 ──────────────────────
const INGREDIENT_MAP = {
  // 비타민 계열
  '비타민a': 'S016', '레티놀': 'S016', '비타민 a': 'S016',
  '비타민c': 'S008', '아스코르브산': 'S008', '비타민 c': 'S008', '비타민씨': 'S008',
  '비타민d': 'S002', '비타민d3': 'S002', '콜레칼시페롤': 'S002', '비타민 d': 'S002', '비타민디': 'S002',
  '비타민e': 'S017', '토코페롤': 'S017', '비타민 e': 'S017',
  '비타민k': 'S018', '비타민k2': 'S018', '메나퀴논': 'S018',
  '비타민b': 'S012', '비타민b군': 'S012', '비타민b복합': 'S012', 'b컴플렉스': 'S012',
  '비타민b12': 'S022', '코발라민': 'S022', '시아노코발라민': 'S022',
  '엽산': 'S023', '폴산': 'S023', '폴릭애씨드': 'S023',
  '종합비타민': 'S019', '멀티비타민': 'S019', '센트룸': 'S019', '얼라이브': 'S019',
  // 미네랄
  '오메가3': 'S001', 'epa': 'S001', 'dha': 'S001', '피쉬오일': 'S001', '생선오일': 'S001', '어유': 'S001',
  '마그네슘': 'S003', '산화마그네슘': 'S003',
  '칼슘': 'S013', '탄산칼슘': 'S013', '칼슘제': 'S013',
  '철분': 'S007', '철': 'S007', '황산철': 'S007', '철분제': 'S007', '아이언': 'S007',
  '아연': 'S011', '징크': 'S011',
  '코엔자임q10': 'S004', 'coq10': 'S004', '코큐텐': 'S004', '유비퀴논': 'S004',
  '루테인': 'S009', '지아잔틴': 'S009',
  '유산균': 'S010', '프로바이오틱스': 'S010', '락토바실러스': 'S010', '락토핏': 'S010',
  '홍삼': 'S005', '인삼': 'S005', '진생': 'S005',
  '은행잎': 'S006', '징코': 'S006', '진코': 'S006',
  '글루코사민': 'S014', '콘드로이틴': 'S014',
  '밀크씨슬': 'S015', '실리마린': 'S015',
  // 의약품
  '타이레놀': 'D001', '아세트아미노펜': 'D001', '아세타미노펜': 'D001',
  '이부프로펜': 'D002', '부루펜': 'D002', '애드빌': 'D002',
  '아스피린': 'D003', '아세틸살리실산': 'D003',
  '와파린': 'D004', '쿠마딘': 'D004',
  '메트포르민': 'D005', '글루코파지': 'D005',
  '암로디핀': 'D006', '노바스크': 'D006',
  '로수바스타틴': 'D007', '크레스토': 'D007',
  '오메프라졸': 'D008', '로섹': 'D008',
  '세티리진': 'D010', '지르텍': 'D010',
  '레보티록신': 'D011', '씬지로이드': 'D011',
  '클로피도그렐': 'D013', '플라빅스': 'D013',
};

// 제품명에서 DB seq 추출 (정규화 후 매핑)
function resolveCustomProduct(name) {
  const normalized = name.toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[0-9,]+\s*(mg|iu|mcg|g|ml|억|천만|만|cfu|%)/gi, '') // 용량 제거
    .replace(/\(.*?\)/g, '') // 괄호 제거
    .replace(/[·•_\-]/g, '') // 특수문자 제거
    .trim();

  // 정확히 일치하는 것 먼저
  if (INGREDIENT_MAP[normalized]) {
    return { seq: INGREDIENT_MAP[normalized], matched: true };
  }
  // 포함 관계로 찾기
  for (const [key, seq] of Object.entries(INGREDIENT_MAP)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return { seq, matched: true };
    }
  }
  return { seq: null, matched: false };
}

function selectDrug(idx, seq, name, category) {
  // 직접 입력 항목이면 성분 매핑 시도
  let resolvedSeq = seq;
  let resolvedName = name;
  let customNotice = null;
  if (seq.startsWith('custom-')) {
    const resolved = resolveCustomProduct(name);
    if (resolved.matched) {
      resolvedSeq = resolved.seq;
      customNotice = `✅ '${name}'을 성분으로 인식했어요`;
    } else {
      customNotice = `⚠️ '${name}' 성분을 찾지 못했어요. 성분명으로 검색해 보세요`;
    }
  }
  slots[idx] = { seq: resolvedSeq, name, category, customNotice };
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

  // 직접 입력 항목 체크 (매핑 실패한 것만 custom으로 처리)
  const customItems = selected.filter(s => s.seq?.startsWith('custom-'));
  const dbItems = selected.filter(s => !s.seq?.startsWith('custom-'));

  document.getElementById('resultSection').style.display = 'block';
  document.getElementById('resultCard').innerHTML = '';
  document.getElementById('checkLoading').style.display = 'block';
  document.getElementById('resultSection').scrollIntoView({ behavior: 'smooth', block: 'start' });

  // DB 항목이 2개 미만이면 상호작용 조회 불가 → 안내만 표시
  if (dbItems.length < 2) {
    document.getElementById('checkLoading').style.display = 'none';
    const names = selected.map(s => `<strong>${s.name}</strong>`).join(' + ');
    document.getElementById('resultCard').innerHTML = `
      <div style="padding:24px;text-align:center">
        <div style="font-size:36px;margin-bottom:12px">🔍</div>
        <div style="font-size:16px;font-weight:700;color:#191F28;margin-bottom:8px">${names}</div>
        <div style="font-size:14px;color:#8B95A1;line-height:1.7;margin-bottom:16px">
          직접 입력한 제품은 식약처 상호작용 DB에 등록되지 않아<br>
          자동 분석이 어려워요.<br><br>
          <strong style="color:#3182F6">📌 이렇게 해보세요</strong><br>
          검색창에서 성분명으로 검색해 보세요.<br>
          예) <em>비타민D 1000IU</em> → <em>비타민D</em> 또는 <em>콜레칼시페롤</em>
        </div>
        ${customItems.map(c => `<div style="background:#EBF3FF;border-radius:10px;padding:10px 14px;margin-bottom:8px;font-size:13px;color:#3182F6;font-weight:600">💡 '${c.name}' — 성분명으로 다시 검색해 보세요</div>`).join('')}
      </div>`;
    return;
  }

  const res = await fetch(`${API}/api/interactions/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ drug_seqs: selected.map(s => s.seq), custom_items: customItems.map(s => s.name) })
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

// ── 피드백 ──────────────────────────────────────────────────
let fbRating = 0;

function openFeedback() {
  document.getElementById('fbOverlay').classList.add('open');
  document.getElementById('fbModal').classList.add('open');
}
function closeFeedback() {
  document.getElementById('fbOverlay').classList.remove('open');
  document.getElementById('fbModal').classList.remove('open');
}
function setRating(n) {
  fbRating = n;
  document.querySelectorAll('.fb-star').forEach((s, i) => {
    s.classList.toggle('active', i < n);
  });
}
async function submitFeedback() {
  const message = document.getElementById('fbText').value.trim();
  const btn = document.getElementById('fbSubmit');
  if (!message && !fbRating) { toast('별점이나 의견을 입력해주세요'); return; }
  btn.disabled = true;
  btn.textContent = '전송 중...';
  try {
    await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating: fbRating, message, page: location.pathname })
    });
    closeFeedback();
    toast('소중한 의견 감사해요 💙');
    document.getElementById('fbText').value = '';
    fbRating = 0;
    document.querySelectorAll('.fb-star').forEach(s => s.classList.remove('active'));
  } catch(e) {
    toast('전송 실패. 잠시 후 다시 시도해주세요.');
  } finally {
    btn.disabled = false;
    btn.textContent = '의견 보내기';
  }
}

// 초기화
document.addEventListener('DOMContentLoaded', () => {
  initAuthUI();
  renderDrugTags();
  renderSymptoms();
  renderAlarms();
  updatePermBadge();
});

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

// ── 맞춤 영양 퀴즈 ────────────────────────────────────────
const QUIZ_STEPS = [
  {
    id: 'gender',
    label: 'STEP 1 / 4',
    q: '성별과 연령대를\n알려주세요',
    sub: '나이에 따라 꼭 필요한 영양소가 달라져요',
    type: 'single',
    options: [
      { icon:'👧', title:'여성 10-20대', desc:'성장·호르몬·철분·피부 케어 시작기', value:'f_teen' },
      { icon:'👦', title:'남성 10-20대', desc:'성장·근육·에너지·집중력 케어 시작기', value:'m_teen' },
      { icon:'👩', title:'여성 30-40대', desc:'항산화·피부·철분·임신 준비 케어 중요', value:'f_young' },
      { icon:'👨', title:'남성 30-40대', desc:'에너지·스트레스·혈관·근육 케어 중요', value:'m_young' },
      { icon:'👩‍🦳', title:'여성 50-60대', desc:'갱년기·뼈·혈관·콜레스테롤 케어 중요', value:'f_mid' },
      { icon:'👨‍🦳', title:'남성 50-60대', desc:'전립선·심혈관·뼈·근력 유지 중요', value:'m_mid' },
      { icon:'👴', title:'70대 이상', desc:'뇌·뼈·심혈관·낙상 예방·소화 케어 중요', value:'senior' },
    ]
  },
  {
    id: 'goal',
    label: 'STEP 2 / 4',
    q: '가장 원하는\n건강 목표는 뭐예요?',
    sub: '가장 중요한 것 하나를 골라주세요',
    type: 'single',
    options: [
      { icon:'⚡', title:'만성 피로 극복', desc:'에너지가 항상 부족해요', value:'energy' },
      { icon:'🛡️', title:'면역력 강화', desc:'자주 아프거나 감기에 취약해요', value:'immune' },
      { icon:'🦴', title:'뼈·관절 건강', desc:'관절이 아프거나 뼈가 걱정돼요', value:'bone' },
      { icon:'✨', title:'피부·노화 방지', desc:'피부 트러블이나 노화가 걱정돼요', value:'skin' },
    ]
  },
  {
    id: 'symptoms',
    label: 'STEP 3 / 4',
    q: '요즘 겪고 있는\n불편함을 골라주세요',
    sub: '해당하는 것을 모두 선택하세요',
    type: 'multi',
    options: [
      { icon:'😴', title:'자주 피곤함', value:'fatigue' },
      { icon:'😔', title:'집중력 저하', value:'focus' },
      { icon:'🦷', title:'뼈·치아 약함', value:'bone_weak' },
      { icon:'💤', title:'수면 장애', value:'sleep' },
      { icon:'🤒', title:'면역력 약함', value:'immunity' },
      { icon:'🫀', title:'혈압·혈관', value:'cardiovascular' },
      { icon:'🏋️', title:'근육 부족', value:'muscle' },
      { icon:'🌸', title:'피부 트러블', value:'skin_issue' },
    ]
  },
  {
    id: 'current',
    label: 'STEP 4 / 4',
    q: '현재 복용 중인\n영양제가 있나요?',
    sub: '이미 먹고 있는 것을 모두 선택하세요',
    type: 'multi',
    options: [
      { icon:'💊', title:'없음', value:'none' },
      { icon:'🌈', title:'종합비타민', value:'multi' },
      { icon:'🐟', title:'오메가3', value:'omega3' },
      { icon:'☀️', title:'비타민D', value:'vitd' },
      { icon:'🦴', title:'칼슘', value:'calcium' },
      { icon:'🔴', title:'철분', value:'iron' },
      { icon:'🌿', title:'마그네슘', value:'mag' },
      { icon:'🧫', title:'유산균', value:'probiotics' },
    ]
  }
];

// 추천 로직
const RECO_DB = {
  '비타민D': {
    icon:'☀️', badge:'거의 필수',
    reason:'뼈 건강, 면역력, 기분 개선에 필수예요. 한국인의 90% 이상이 부족합니다.',
    dosage:'권장 800~2000IU/일',
    timing:[
      { when:'🌅 아침~점심 식후', why:'지방과 함께 먹어야 흡수율이 2배↑. 저녁 복용 시 수면 방해 가능성 있어요.' }
    ],
    avoid:[
      { item:'칼슘제', reason:'동시에 다량 복용하면 고칼슘혈증 위험. 2~3시간 간격 권장' },
      { item:'이뇨제(thiazide계)', reason:'혈중 칼슘 수치를 과도하게 높일 수 있어요' },
    ]
  },
  '오메가3': {
    icon:'🐟', badge:'적극 추천',
    reason:'혈행 개선과 뇌 기능, 염증 감소에 도움이 돼요. EPA+DHA 합계 500mg 이상 권장해요.',
    dosage:'권장 1000~2000mg/일',
    timing:[
      { when:'🍽️ 식사 중 또는 식후', why:'지방 함유 식사와 함께 복용하면 흡수율이 높아져요.' }
    ],
    avoid:[
      { item:'와파린·아스피린(항응고제)', reason:'혈소판 응집 억제 효과가 겹쳐 출혈 위험 증가. 반드시 의사 상담' },
      { item:'혈압약', reason:'혈압 강하 효과가 강해질 수 있어요. 복용량 조절 필요' },
      { item:'은행잎 추출물', reason:'혈전 예방 효과 중복 — 출혈 경향 증가' },
    ]
  },
  '마그네슘': {
    icon:'🪨', badge:'강력 추천',
    reason:'스트레스 완화, 수면의 질 향상, 근육 이완에 효과적이에요. 현대인에게 가장 부족한 미네랄이에요.',
    dosage:'권장 200~400mg/일',
    timing:[
      { when:'🌙 취침 30분~1시간 전', why:'근육 이완과 수면 유도 효과를 극대화할 수 있어요.' },
      { when:'💊 위장이 민감하다면 식후', why:'공복 복용 시 설사가 생길 수 있어요.' }
    ],
    avoid:[
      { item:'칼슘제', reason:'동시 복용 시 흡수율이 서로 떨어져요. 2시간 이상 간격 권장' },
      { item:'항생제(퀴놀론·테트라사이클린)', reason:'마그네슘이 항생제 흡수를 방해해요. 2시간 이상 간격 필수' },
      { item:'레보티록신(갑상선약)', reason:'흡수 방해. 갑상선약 복용 4시간 후 섭취' },
    ]
  },
  '비타민C': {
    icon:'🍊', badge:'추천',
    reason:'강력한 항산화 효과와 면역력 증진, 콜라겐 합성에 필수적이에요.',
    dosage:'권장 500~1000mg/일',
    timing:[
      { when:'🍽️ 식후 또는 식사 중', why:'공복 복용 시 위산 자극으로 속이 쓰릴 수 있어요.' },
      { when:'💊 철분제와 함께 복용하면 효과적', why:'비타민C가 철분의 흡수율을 2~3배 높여줘요.' }
    ],
    avoid:[
      { item:'와파린', reason:'고용량(1g↑) 비타민C는 항응고 효과를 변동시킬 수 있어요' },
      { item:'알루미늄 함유 제산제', reason:'비타민C가 알루미늄 흡수를 높여 독성 위험' },
      { item:'신장결석 위험자', reason:'고용량 장기복용 시 옥살산칼슘 결석 위험 증가' },
    ]
  },
  '비타민B군': {
    icon:'⚡', badge:'강력 추천',
    reason:'에너지 대사의 핵심! 피로 회복과 신경계 기능에 직접적으로 관여해요.',
    dosage:'권장 B-Complex 1정/일',
    timing:[
      { when:'🌅 아침 식후', why:'에너지 대사를 활성화해 하루를 활기차게 시작할 수 있어요. 저녁 복용 시 수면 방해 가능' }
    ],
    avoid:[
      { item:'메트포르민(당뇨약)', reason:'장기 복용 시 비타민B12 흡수를 방해 — B12 별도 보충 권장' },
      { item:'알코올', reason:'알코올이 B군 비타민(특히 B1·B12·엽산) 흡수와 대사를 크게 방해해요' },
      { item:'항생제(일부)', reason:'장내 균총 파괴로 B군 합성 감소. 복용 2시간 간격 권장' },
    ]
  },
  '칼슘': {
    icon:'🦴', badge:'추천',
    reason:'뼈와 치아를 만드는 핵심 미네랄이에요. 비타민D와 함께 복용하면 흡수율이 높아져요.',
    dosage:'권장 500~1000mg/일 (1회 500mg 이하 분할)',
    timing:[
      { when:'🍽️ 식사 중 또는 식후', why:'위산이 분비될 때 흡수율이 높아져요.' },
      { when:'⏰ 1회 500mg 이하 분할 복용', why:'한 번에 500mg 이상은 흡수율이 급격히 떨어져요.' }
    ],
    avoid:[
      { item:'철분제', reason:'칼슘이 철분 흡수를 크게 방해해요. 2시간 이상 간격 필수' },
      { item:'레보티록신(갑상선약)', reason:'갑상선 호르몬 흡수 방해. 4시간 이상 간격 필수' },
      { item:'마그네슘', reason:'동시 복용 시 서로 흡수 경쟁. 시간차 복용 권장' },
      { item:'테트라사이클린·퀴놀론(항생제)', reason:'칼슘이 항생제 흡수를 50% 이상 방해' },
    ]
  },
  '아연': {
    icon:'🔬', badge:'추천',
    reason:'면역세포 생성과 피부 재생, 상처 치유에 중요한 역할을 해요.',
    dosage:'권장 10~15mg/일',
    timing:[
      { when:'🍽️ 식후 복용', why:'공복 복용 시 구역감이 생길 수 있어요.' }
    ],
    avoid:[
      { item:'철분제', reason:'아연과 철분은 같은 통로로 흡수 — 서로 방해해요. 2시간 간격 권장' },
      { item:'칼슘제', reason:'흡수 경쟁. 시간차 복용 권장' },
      { item:'항생제(퀴놀론·테트라사이클린)', reason:'아연이 항생제 흡수를 방해. 2시간 이상 간격 필수' },
    ]
  },
  '철분': {
    icon:'🔴', badge:'여성 필수',
    reason:'빈혈 예방과 에너지 생성에 필수적이에요. 특히 여성에게 중요해요.',
    dosage:'권장 10~18mg/일',
    timing:[
      { when:'☀️ 공복(아침 기상 직후) 또는 비타민C와 함께', why:'비타민C와 함께 복용하면 흡수율이 2~3배 올라가요.' },
      { when:'⚠️ 위장 불편 시 식후 복용 가능', why:'흡수율은 약간 감소하지만 위장 부담이 줄어요.' }
    ],
    avoid:[
      { item:'칼슘제·마그네슘', reason:'미네랄 흡수 경쟁으로 철분 흡수를 50% 이상 감소시켜요' },
      { item:'커피·녹차·홍차', reason:'탄닌이 철분 흡수를 방해해요. 철분 복용 2시간 후 음료 섭취' },
      { item:'레보티록신(갑상선약)', reason:'철분이 갑상선 호르몬 흡수를 방해. 4시간 이상 간격 필수' },
      { item:'제산제·위산억제제', reason:'위산을 중화시켜 철분 흡수율을 크게 낮춰요' },
    ]
  },
  '코엔자임Q10': {
    icon:'💛', badge:'추천',
    reason:'세포 에너지(ATP) 생성을 돕고 강력한 항산화 효과가 있어요.',
    dosage:'권장 100~200mg/일',
    timing:[
      { when:'🍽️ 지방 함유 식사와 함께', why:'지용성이라 기름진 식사와 함께 복용해야 흡수가 잘 돼요.' }
    ],
    avoid:[
      { item:'와파린', reason:'항응고 효과를 약화시킬 수 있어요. INR 모니터링 필요' },
      { item:'스타틴(콜레스테롤약)', reason:'스타틴이 CoQ10 합성을 억제 — 오히려 보충이 필요해요(병용 가능)' },
    ]
  },
  '루테인': {
    icon:'👁️', badge:'눈 건강',
    reason:'스마트폰·모니터 블루라이트로부터 눈 황반을 보호해요.',
    dosage:'권장 10~20mg/일',
    timing:[
      { when:'🍽️ 지방 함유 식사와 함께', why:'지용성 성분으로 기름진 음식과 함께 먹어야 흡수가 잘 돼요.' }
    ],
    avoid:[
      { item:'베타카로틴(고용량)', reason:'흡수 경쟁 — 같이 먹으면 루테인 흡수율이 낮아져요' },
      { item:'흡연', reason:'흡연자가 베타카로틴 고용량 복용 시 폐암 위험 증가 사례 있음(루테인은 괜찮음)' },
    ]
  },
  '글루코사민': {
    icon:'🦵', badge:'관절 추천',
    reason:'관절 연골을 보호하고 관절염 통증 완화에 도움을 줄 수 있어요.',
    dosage:'권장 1500mg/일 (효과 발현까지 4~8주 필요)',
    timing:[
      { when:'🍽️ 식사와 함께 분할 복용', why:'1500mg을 한 번에 먹기보다 식사마다 나눠 먹으면 위장 부담이 줄어요.' }
    ],
    avoid:[
      { item:'와파린', reason:'혈당·항응고 효과에 영향을 줄 수 있어요. INR 모니터링 권장' },
      { item:'당뇨약', reason:'글루코사민이 혈당을 소폭 올릴 수 있어요. 당뇨 환자는 의사 상담 필수' },
      { item:'갑각류 알레르기', reason:'글루코사민은 새우·게 껍질 유래 — 알레르기 환자 주의' },
    ]
  },
  '유산균': {
    icon:'🦠', badge:'장 건강',
    reason:'장 건강 개선과 면역력의 70%를 담당하는 장내 환경을 개선해요.',
    dosage:'권장 100억 CFU 이상/일',
    timing:[
      { when:'🌅 공복(아침 기상 직후) 또는 식전 30분', why:'위산이 적은 공복에 먹어야 균이 살아서 장까지 도달해요.' },
      { when:'🌙 취침 전도 효과적', why:'장 연동 운동이 적은 밤에 균이 정착하기 좋아요.' }
    ],
    avoid:[
      { item:'항생제', reason:'항생제가 유산균을 죽여요. 항생제 복용 후 2~3시간 뒤 섭취 또는 항생제 치료 후 보충' },
      { item:'뜨거운 음료(50°C↑)', reason:'고온이 균을 사멸시켜요. 미지근한 물과 함께 복용' },
    ]
  },
};

function getReco(answers) {
  const recs = new Set();
  const { gender, goal, symptoms, current } = answers;

  recs.add('비타민D'); // 전 연령 공통

  // 연령대별 특화
  if (gender === 'f_teen') { recs.add('칼슘'); recs.add('철분'); recs.add('비타민C'); }
  if (gender === 'm_teen') { recs.add('칼슘'); recs.add('아연'); recs.add('비타민B군'); }
  if (gender === 'f_young') { recs.add('철분'); recs.add('엽산'); recs.add('비타민C'); }
  if (gender === 'm_young') { recs.add('비타민B군'); recs.add('마그네슘'); recs.add('오메가3'); }
  if (gender === 'f_mid')  { recs.add('칼슘'); recs.add('마그네슘'); recs.add('오메가3'); recs.add('코엔자임Q10'); }
  if (gender === 'm_mid')  { recs.add('오메가3'); recs.add('코엔자임Q10'); recs.add('루테인'); }
  if (gender === 'senior') { recs.add('칼슘'); recs.add('오메가3'); recs.add('비타민B12'); recs.add('유산균'); recs.add('루테인'); }

  // 목표 기반
  if (goal === 'energy')  { recs.add('비타민B군'); recs.add('마그네슘'); recs.add('코엔자임Q10'); }
  if (goal === 'immune')  { recs.add('비타민C'); recs.add('아연'); recs.add('유산균'); }
  if (goal === 'bone')    { recs.add('칼슘'); recs.add('마그네슘'); recs.add('글루코사민'); }
  if (goal === 'skin')    { recs.add('비타민C'); recs.add('아연'); recs.add('오메가3'); }

  // 증상 기반
  if (symptoms?.includes('fatigue'))        { recs.add('비타민B군'); recs.add('마그네슘'); }
  if (symptoms?.includes('focus'))          { recs.add('오메가3'); recs.add('비타민B군'); }
  if (symptoms?.includes('bone_weak'))      { recs.add('칼슘'); recs.add('비타민D'); }
  if (symptoms?.includes('sleep'))          { recs.add('마그네슘'); }
  if (symptoms?.includes('immunity'))       { recs.add('비타민C'); recs.add('아연'); }
  if (symptoms?.includes('cardiovascular')) { recs.add('오메가3'); }
  if (symptoms?.includes('muscle'))         { recs.add('마그네슘'); recs.add('비타민D'); }
  if (symptoms?.includes('skin_issue'))     { recs.add('비타민C'); recs.add('아연'); }

  // 이미 복용 중인 것 제외
  const skip = {
    multi: ['비타민B군','비타민C','비타민D','아연'],
    omega3: ['오메가3'], vitd: ['비타민D'], calcium: ['칼슘'],
    iron: ['철분'], mag: ['마그네슘'], probiotics: ['유산균'],
  };
  if (current && !current.includes('none')) {
    current.forEach(k => { (skip[k]||[]).forEach(n => recs.delete(n)); });
  }

  return [...recs].slice(0, 5).filter(r => RECO_DB[r]);
}

let quizAnswers = {};
let quizStep = 0;

function openQuiz() {
  quizAnswers = {}; quizStep = 0;
  document.getElementById('quizOverlay').classList.add('open');
  document.getElementById('quizModal').classList.add('open');
  document.body.style.overflow = 'hidden';
  renderQuizStep();
}
function closeQuiz() {
  document.getElementById('quizOverlay').classList.remove('open');
  document.getElementById('quizModal').classList.remove('open');
  document.body.style.overflow = '';
}

function renderQuizStep() {
  const step = QUIZ_STEPS[quizStep];
  const pct = ((quizStep) / QUIZ_STEPS.length) * 100;
  document.getElementById('quizProgressBar').style.width = pct + '%';

  const body = document.getElementById('quizBody');
  const isMulti = step.type === 'multi';
  const selected = quizAnswers[step.id] || (isMulti ? [] : null);

  body.innerHTML = `
    <div class="quiz-step-label">${step.label}</div>
    <div class="quiz-question">${step.q.replace('\n','<br>')}</div>
    <div class="quiz-sub">${step.sub}</div>
    <div class="${isMulti ? 'quiz-multi-options' : 'quiz-options'}" id="quizOptions">
      ${step.options.map(opt => {
        const sel = isMulti ? selected.includes(opt.value) : selected === opt.value;
        return isMulti
          ? `<button class="quiz-multi-option${sel?' selected':''}" onclick="quizSelect('${step.id}','${opt.value}',true)">
               <span class="quiz-multi-option__icon">${opt.icon}</span>${opt.title}
             </button>`
          : `<button class="quiz-option${sel?' selected':''}" onclick="quizSelect('${step.id}','${opt.value}',false)">
               <span class="quiz-option__icon">${opt.icon}</span>
               <div class="quiz-option__text">
                 <div class="quiz-option__title">${opt.title}</div>
                 <div class="quiz-option__desc">${opt.desc||''}</div>
               </div>
             </button>`;
      }).join('')}
    </div>
    <button class="quiz-next-btn" id="quizNextBtn" onclick="quizNext()" ${!selected||(isMulti&&!selected.length)?'disabled':''}>
      ${quizStep < QUIZ_STEPS.length - 1 ? '다음 →' : '내 맞춤 영양제 보기 ✨'}
    </button>`;
}

function quizSelect(stepId, value, isMulti) {
  if (isMulti) {
    if (!quizAnswers[stepId]) quizAnswers[stepId] = [];
    const arr = quizAnswers[stepId];
    const idx = arr.indexOf(value);
    if (idx >= 0) arr.splice(idx, 1); else arr.push(value);
  } else {
    quizAnswers[stepId] = value;
  }
  renderQuizStep();
}

function quizNext() {
  quizStep++;
  if (quizStep >= QUIZ_STEPS.length) { renderQuizResult(); return; }
  renderQuizStep();
}

function renderQuizResult() {
  document.getElementById('quizProgressBar').style.width = '100%';
  const recs = getReco(quizAnswers);
  const GENDER_LABEL = {
    f_teen:'여성 10-20대', m_teen:'남성 10-20대',
    f_young:'여성 30-40대', m_young:'남성 30-40대',
    f_mid:'여성 50-60대', m_mid:'남성 50-60대',
    senior:'70대 이상'
  };
  const genderLabel = GENDER_LABEL[quizAnswers.gender] || '맞춤';
  const ageLabel = '';

  document.getElementById('quizBody').innerHTML = `
    <div class="quiz-result-hero">
      <div class="quiz-result-hero__emoji">🎯</div>
      <div class="quiz-result-hero__title">${genderLabel}에게<br>딱 맞는 조합이에요</div>
      <div class="quiz-result-hero__sub">식약처 데이터 기반으로 분석한<br>맞춤 영양제 ${recs.length}가지예요</div>
    </div>
    ${recs.map((name) => {
      const r = RECO_DB[name];
      const timingHtml = r.timing.map(t =>
        `<div class="quiz-rec-timing-item">
          <span class="quiz-rec-timing-when">${t.when}</span>
          <span class="quiz-rec-timing-why">${t.why}</span>
        </div>`
      ).join('');
      const avoidHtml = r.avoid.map(a =>
        `<div class="quiz-rec-avoid-item">
          <span class="quiz-rec-avoid-name">⚠️ ${a.item}</span>
          <span class="quiz-rec-avoid-reason">${a.reason}</span>
        </div>`
      ).join('');
      return `<div class="quiz-rec-card">
        <div class="quiz-rec-top">
          <span class="quiz-rec-icon">${r.icon}</span>
          <span class="quiz-rec-name">${name}</span>
          <span class="quiz-rec-badge">${r.badge}</span>
        </div>
        <div class="quiz-rec-reason">${r.reason}</div>
        <div class="quiz-rec-section-label">⏰ 언제 먹으면 좋을까요?</div>
        <div class="quiz-rec-timing">${timingHtml}</div>
        <div class="quiz-rec-section-label" style="color:#F04452">🚫 같이 먹으면 안 되는 것</div>
        <div class="quiz-rec-avoid">${avoidHtml}</div>
        <div class="quiz-rec-dosage">💡 ${r.dosage}</div>
      </div>`;
    }).join('')}
    <div class="quiz-result-actions">
      <button class="quiz-save-btn" onclick="saveQuizToNotes()">💊 약통에 저장하기</button>
      <button class="quiz-retry-btn" onclick="quizStep=0;quizAnswers={};renderQuizStep()">다시 하기</button>
    </div>
    <p style="font-size:11px;color:#8B95A1;text-align:center;margin-top:16px;line-height:1.7">※ 개인 건강 상태에 따라 다를 수 있어요.<br>전문가 상담을 병행하시길 권장합니다.</p>`;
}

function saveQuizToNotes() {
  const recs = getReco(quizAnswers);
  let added = 0;
  recs.forEach(name => {
    if (!cabDrugs.find(d => d.name === name)) {
      const color = COLORS[cabDrugs.length % COLORS.length];
      cabDrugs.push({ seq: 'quiz-' + Date.now() + Math.random(), name, category: 'supplement', color });
      added++;
    }
  });
  localStorage.setItem('cab_drugs', JSON.stringify(cabDrugs));
  renderCabList();
  toast(`💊 ${added}개 영양제를 내 약통에 추가했어요!`);
  closeQuiz();
}

// ── 메인 탭 전환 ──────────────────────────────────────────
function switchMainTab(tab) {
  const isInteraction = tab === 'interaction';
  document.getElementById('mainTabInteraction').classList.toggle('active', isInteraction);
  document.getElementById('mainTabNutrition').classList.toggle('active', !isInteraction);
  document.getElementById('tabPanelInteraction').style.display = isInteraction ? '' : 'none';
  document.getElementById('tabPanelNutrition').style.display = isInteraction ? 'none' : '';
}

// ── 영양 분석 ─────────────────────────────────────────────

// 한국인 영양소 섭취기준 (2020) - [남성, 여성] 권장/충분 섭취량
// age group: 0=1-2, 1=3-5, 2=6-8, 3=9-11, 4=12-14, 5=15-18, 6=19-29, 7=30-49, 8=50-64, 9=65-74, 10=75+
const NUTR_DRI = {
  '비타민A':   { unit:'mcg RAE', ul:3000,  male:[200,230,300,400,550,650,800,800,750,700,700], female:[200,230,300,400,500,550,650,650,600,600,600] },
  '비타민C':   { unit:'mg',      ul:2000,  male:[40,45,55,70,90,105,100,100,100,100,100],       female:[40,45,55,70,90,95,100,100,100,100,100] },
  '비타민D':   { unit:'mcg',     ul:100,   male:[5,5,5,5,10,10,10,10,15,15,15],                female:[5,5,5,5,10,10,10,10,15,15,15] },
  '비타민E':   { unit:'mg',      ul:540,   male:[4,5,6,7,10,11,12,12,12,12,12],                female:[4,5,6,7,9,10,12,12,12,12,12] },
  '비타민B1':  { unit:'mg',      ul:null,  male:[0.4,0.5,0.7,0.9,1.1,1.3,1.2,1.2,1.2,1.2,1.2],female:[0.4,0.5,0.7,0.8,1.0,1.1,1.1,1.1,1.1,1.1,1.1] },
  '비타민B2':  { unit:'mg',      ul:null,  male:[0.5,0.6,0.8,1.0,1.3,1.5,1.3,1.3,1.3,1.3,1.3],female:[0.5,0.6,0.8,1.0,1.2,1.2,1.2,1.2,1.2,1.2,1.2] },
  '비타민B6':  { unit:'mg',      ul:100,   male:[0.5,0.6,0.7,0.9,1.3,1.5,1.5,1.5,1.5,1.5,1.5],female:[0.5,0.6,0.7,0.9,1.2,1.2,1.4,1.4,1.4,1.4,1.4] },
  '비타민B12': { unit:'mcg',     ul:null,  male:[0.9,1.1,1.3,1.7,2.3,2.7,2.4,2.4,2.4,2.4,2.4],female:[0.9,1.1,1.3,1.7,2.3,2.7,2.4,2.4,2.4,2.4,2.4] },
  '엽산':      { unit:'mcg',     ul:1000,  male:[150,200,220,300,360,400,400,400,400,400,400],  female:[150,200,220,300,360,400,400,400,400,400,400] },
  '칼슘':      { unit:'mg',      ul:2500,  male:[500,600,700,800,1000,900,800,800,750,700,700], female:[500,600,700,800,900,800,700,700,800,800,800] },
  '마그네슘':  { unit:'mg',      ul:350,   male:[80,100,130,170,240,330,350,370,350,350,350],   female:[80,100,130,160,220,280,280,280,280,280,280] },
  '철분':      { unit:'mg',      ul:45,    male:[7,7,8,9,11,14,10,10,10,10,10],                female:[7,7,8,9,16,14,14,14,8,8,8] },
  '아연':      { unit:'mg',      ul:35,    male:[3,4,5,6,8,10,10,10,10,10,10],                 female:[3,4,5,6,8,9,8,8,8,8,8] },
  '오메가3':   { unit:'mg',      ul:null,  male:[null,null,null,null,null,null,500,500,500,500,500], female:[null,null,null,null,null,null,500,500,500,500,500] },
};

const AGE_GROUPS = [2,5,8,11,14,18,29,49,64,74,Infinity];

function getAgeGroupIdx(age) {
  for (let i = 0; i < AGE_GROUPS.length; i++) {
    if (age <= AGE_GROUPS[i]) return i;
  }
  return AGE_GROUPS.length - 1;
}

// 기본 영양소 목록
const DEFAULT_NUTRIENTS = ['비타민A','비타민C','비타민D','비타민E','비타민B1','비타민B2','비타민B6','비타민B12','엽산','칼슘','마그네슘','철분','아연','오메가3'];

function renderNutrTable(extracted = {}) {
  const tbody = document.getElementById('nutrTableBody');
  if (!tbody) return;
  tbody.innerHTML = DEFAULT_NUTRIENTS.map(name => {
    const dri = NUTR_DRI[name];
    const val = extracted[name] || '';
    return `<tr>
      <td><span class="nutr-name">${name}</span></td>
      <td><input type="number" id="nutr-val-${name}" value="${val}" placeholder="0" min="0" step="0.1"></td>
      <td><span class="nutr-unit">${dri.unit}</span></td>
    </tr>`;
  }).join('');
  document.getElementById('nutrInputStep').style.display = '';
}

async function imageToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function callClaudeOCR(file) {
  const base64 = await imageToBase64(file);
  const mediaType = file.type || 'image/jpeg';
  const res = await fetch('/api/ocr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64, mediaType })
  });
  const data = await res.json();
  return data.nutrients || {};
}

async function handleNutrImage(input) {
  const file = input.files[0];
  if (!file) return;
  const preview = document.getElementById('nutrPreview');
  preview.src = URL.createObjectURL(file);
  preview.style.display = 'block';
  document.getElementById('ocrLoading').style.display = 'block';
  document.getElementById('nutrInputStep').style.display = 'none';
  try {
    const nutrients = await callClaudeOCR(file);
    renderNutrTable(nutrients);
    const found = Object.values(nutrients).filter(v => v > 0).length;
    if (found > 0) toast(`📷 ${found}개 영양소를 인식했어요! 값을 확인해 주세요.`);
    else toast('인식된 영양소가 없어요. 직접 입력해 주세요.');
  } catch(e) {
    renderNutrTable({});
    toast('OCR 오류. 직접 입력해 주세요.');
  } finally {
    document.getElementById('ocrLoading').style.display = 'none';
  }
}

function parseNutrText(text) {
  const extracted = {};
  const patterns = [
    { keys: ['비타민a','비타민 a','vitamin a'], name: '비타민A' },
    { keys: ['비타민c','비타민 c','vitamin c','아스코르브'], name: '비타민C' },
    { keys: ['비타민d','비타민 d','vitamin d'], name: '비타민D' },
    { keys: ['비타민e','비타민 e','vitamin e','토코페롤'], name: '비타민E' },
    { keys: ['비타민b1','비타민 b1','티아민'], name: '비타민B1' },
    { keys: ['비타민b2','비타민 b2','리보플라빈'], name: '비타민B2' },
    { keys: ['비타민b6','비타민 b6'], name: '비타민B6' },
    { keys: ['비타민b12','비타민 b12'], name: '비타민B12' },
    { keys: ['엽산','폴산','folic'], name: '엽산' },
    { keys: ['칼슘','calcium'], name: '칼슘' },
    { keys: ['마그네슘','magnesium'], name: '마그네슘' },
    { keys: ['철','iron','철분'], name: '철분' },
    { keys: ['아연','zinc'], name: '아연' },
    { keys: ['오메가3','omega','epa','dha'], name: '오메가3' },
  ];
  const lines = text.toLowerCase().split('\n');
  lines.forEach(line => {
    patterns.forEach(p => {
      if (p.keys.some(k => line.includes(k))) {
        const numMatch = line.match(/[\d,]+\.?\d*/);
        if (numMatch) {
          const val = parseFloat(numMatch[0].replace(',',''));
          if (!isNaN(val) && val > 0) extracted[p.name] = val;
        }
      }
    });
  });
  return extracted;
}

function analyzeNutrition() {
  const age = parseInt(document.getElementById('nutrAge')?.value);
  const gender = document.getElementById('nutrGender')?.value || 'female';
  if (!age || age < 1 || age > 120) {
    toast('나이를 올바르게 입력해 주세요');
    return;
  }
  const ageIdx = getAgeGroupIdx(age);
  const results = [];
  DEFAULT_NUTRIENTS.forEach(name => {
    const inp = document.getElementById(`nutr-val-${name}`);
    if (!inp) return;
    const val = parseFloat(inp.value);
    if (isNaN(val) || val <= 0) return;
    const dri = NUTR_DRI[name];
    const rda = dri[gender][ageIdx];
    if (!rda) return;
    const ul = dri.ul;
    const pct = Math.round((val / rda) * 100);
    let status, label;
    if (ul && val > ul) { status = 'high'; label = '과다'; }
    else if (pct >= 80) { status = 'ok';   label = '적절'; }
    else if (pct >= 30) { status = 'low';  label = '부족'; }
    else                { status = 'low';  label = '많이 부족'; }
    results.push({ name, val, unit: dri.unit, rda, pct: Math.min(pct, 200), status, label });
  });
  if (!results.length) { toast('영양소 함량을 하나 이상 입력해 주세요'); return; }
  renderNutrResult(results, age, gender === 'male' ? '남성' : '여성');
}

function renderNutrResult(results, age, genderLabel) {
  const container = document.getElementById('nutrResultCards');
  const resultEl = document.getElementById('nutrResult');
  const colorMap = { ok: '#00B761', low: '#FF9500', high: '#F04452' };
  container.innerHTML = results.map(r => {
    const barW = Math.min(r.pct, 100);
    return `<div class="nutr-result-card">
      <div class="nutr-result-item">
        <span class="nutr-status-badge ${r.status}">${r.label}</span>
        <span class="nutr-result-name">${r.name}</span>
        <div style="flex:1;margin:0 12px">
          <div class="nutr-result-bar-wrap">
            <div class="nutr-result-bar" style="width:${barW}%;background:${colorMap[r.status]}"></div>
          </div>
        </div>
        <span class="nutr-result-value">${r.val}${r.unit}<br><span style="font-size:11px">권장 ${r.rda}${r.unit}</span></span>
      </div>
    </div>`;
  }).join('');
  resultEl.style.display = 'block';
  resultEl.querySelector('.nutr-result-header').textContent = `📊 ${age}세 ${genderLabel} 기준 분석 결과`;
  resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── 메인 영양 분석 (인라인) ───────────────────────────────
const MAIN_NUTR_LIST = ['비타민A','비타민C','비타민D','비타민E','비타민B1','비타민B2','비타민B6','비타민B12','엽산','칼슘','마그네슘','철분','아연','오메가3'];

// 영양소별 아이콘
const NUTR_ICONS = {
  '비타민A':'🟠','비타민C':'🍊','비타민D':'☀️','비타민E':'🌿',
  '비타민B1':'⚡','비타민B2':'🔆','비타민B6':'🧬','비타민B12':'💜',
  '엽산':'🌱','칼슘':'🦴','마그네슘':'🪨','철분':'🔴','아연':'🔬','오메가3':'🐟'
};

function renderMainNutrFields(extracted = {}) {
  const wrap = document.getElementById('mainNutrFields');
  if (!wrap) return;
  const toShow = MAIN_NUTR_LIST.filter(n =>
    extracted[n] || ['비타민C','비타민D','칼슘','마그네슘','철분','오메가3','아연','비타민B군'].includes(n)
  ).filter(n => NUTR_DRI[n]);
  wrap.innerHTML = toShow.map(name => `
    <div class="nn-field-row">
      <span class="nn-field-icon">${NUTR_ICONS[name]||'💊'}</span>
      <span class="nn-field-name">${name}</span>
      <input type="number" id="mnf-${name}" value="${extracted[name]||''}" placeholder="0"
        min="0" step="0.1" class="nn-field-input">
      <span class="nn-field-unit">${NUTR_DRI[name].unit}</span>
    </div>`).join('');
  document.getElementById('mainNutrInputArea').style.display = '';
}

// Claude Vision OCR로 이미지 분석
async function handleMainNutrImage(input) {
  const file = input.files[0];
  if (!file) return;
  const thumb = document.getElementById('mainNutrThumb');
  const preview = document.getElementById('mainNutrPreview');
  preview.src = URL.createObjectURL(file);
  thumb.style.display = '';
  const loadingEl = document.getElementById('mainOcrLoading');
  loadingEl.style.display = 'block';
  document.getElementById('mainNutrInputArea').style.display = 'none';
  document.getElementById('mainNutrResult').style.display = 'none';
  try {
    const nutrients = await callClaudeOCR(file);
    renderMainNutrFields(nutrients);
    const found = Object.values(nutrients).filter(v => v > 0).length;
    if (found > 0) toast(`📷 ${found}개 영양소를 인식했어요! 값을 확인해 주세요.`);
    else toast('인식이 어려워요. 직접 입력해 주세요.');
  } catch {
    renderMainNutrFields({});
    toast('OCR 오류. 직접 입력해 주세요.');
  } finally {
    loadingEl.style.display = 'none';
  }
}

function analyzeMainNutrition() {
  const age = parseInt(document.getElementById('mainNutrAge')?.value);
  const gender = document.getElementById('mainNutrGender')?.value || 'female';
  if (!age || age < 1) { toast('나이를 입력해 주세요'); return; }
  const ageIdx = getAgeGroupIdx(age);
  const results = [];
  MAIN_NUTR_LIST.forEach(name => {
    const inp = document.getElementById(`mnf-${name}`);
    if (!inp) return;
    const val = parseFloat(inp.value);
    if (isNaN(val) || val <= 0) return;
    const dri = NUTR_DRI[name];
    const rda = dri[gender][ageIdx];
    if (!rda) return;
    const ul = dri.ul;
    const pct = Math.round((val / rda) * 100);
    let status, label;
    if (ul && val > ul)  { status='high'; label='과다'; }
    else if (pct >= 80)  { status='ok';   label='적절'; }
    else if (pct >= 30)  { status='low';  label='부족'; }
    else                 { status='low';  label='많이 부족'; }
    results.push({ name, val, unit: dri.unit, rda, pct: Math.min(pct, 150), status, label });
  });
  if (!results.length) { toast('영양소 값을 하나 이상 입력해 주세요'); return; }

  // 요약 점수 계산
  const okCount   = results.filter(r => r.status === 'ok').length;
  const highCount = results.filter(r => r.status === 'high').length;
  const score = Math.round((okCount / results.length) * 100);
  const scoreEmoji = score >= 80 ? '🏆' : score >= 60 ? '✅' : score >= 40 ? '⚠️' : '❌';
  const scoreBg = score >= 80 ? '#00B761' : score >= 60 ? '#3182F6' : score >= 40 ? '#FF9500' : '#F04452';
  const productName = document.getElementById('mainNutrProduct')?.value.trim() || '영양제';
  const genderLabel = gender === 'male' ? '남성' : '여성';

  // 요약 헤더
  document.getElementById('mainNutrResultHeader').innerHTML = `
    <div class="nn-result-header__score" style="background:${scoreBg}">${scoreEmoji}</div>
    <div class="nn-result-header__info">
      <div class="nn-result-header__product">${productName}</div>
      <div class="nn-result-header__sub">${age}세 ${genderLabel} 기준 · 적절 ${okCount}/${results.length}개${highCount>0?` · 과다 ${highCount}개 주의`:''}</div>
    </div>`;

  // 영양소 카드 (적절→부족→과다 순 정렬)
  const sorted = [...results].sort((a,b) => {
    const order = { ok:0, low:1, high:2 };
    return order[a.status] - order[b.status];
  });
  document.getElementById('mainNutrResultCards').innerHTML = sorted.map(r => `
    <div class="nn-nutr-card ${r.status}">
      <div class="nn-nutr-card__top">
        <span class="nn-nutr-card__icon">${NUTR_ICONS[r.name]||'💊'}</span>
        <span class="nn-nutr-card__name">${r.name}</span>
        <span class="nn-nutr-card__badge ${r.status}">${r.label}</span>
      </div>
      <div class="nn-bar-wrap">
        <div class="nn-bar ${r.status}" style="width:0%" data-target="${r.pct}%"></div>
      </div>
      <div class="nn-nutr-card__vals">
        <div>
          <span class="nn-nutr-card__amount">${r.val}</span>
          <span class="nn-nutr-card__unit">${r.unit}</span>
        </div>
        <div class="nn-nutr-card__rda">
          권장 ${r.rda}${r.unit}<br>
          <span class="nn-nutr-card__pct ${r.status}">${r.pct}%</span>
        </div>
      </div>
    </div>`).join('');

  document.getElementById('mainNutrResult').style.display = '';

  // 바 애니메이션 (약간 딜레이)
  setTimeout(() => {
    document.querySelectorAll('.nn-bar[data-target]').forEach(bar => {
      bar.style.width = bar.dataset.target;
    });
  }, 100);

  // 약통 추가 버튼
  const addBtn = document.getElementById('addToCabFromNutr');
  const realProduct = document.getElementById('mainNutrProduct')?.value.trim();
  if (addBtn) addBtn.style.display = realProduct ? '' : 'none';

  document.getElementById('mainNutrResult').scrollIntoView({ behavior:'smooth', block:'start' });
}

function addNutrToCabinet() {
  const productName = document.getElementById('mainNutrProduct')?.value.trim();
  if (!productName) { toast('영양제 이름을 입력해 주세요'); return; }
  // 이미 있는지 확인
  if (cabDrugs.find(d => d.name === productName)) {
    toast(`'${productName}'은 이미 약통에 있어요`); return;
  }
  const color = COLORS[cabDrugs.length % COLORS.length];
  cabDrugs.push({ seq: 'nutr-' + Date.now(), name: productName, category: 'supplement', color });
  localStorage.setItem('cab_drugs', JSON.stringify(cabDrugs));
  renderCabList();
  toast(`💊 '${productName}'을 내 약통에 추가했어요!`);
  document.getElementById('addToCabFromNutr').textContent = '✅ 약통에 추가됨';
  document.getElementById('addToCabFromNutr').style.background = '#E8FAF0';
  document.getElementById('addToCabFromNutr').style.color = '#00B761';
  document.getElementById('addToCabFromNutr').onclick = null;
}

// ── 초기화 ────────────────────────────────────────────────
renderSymptoms();
renderCabList();
loadStats();
renderAlarms();
renderDrugTags();
renderNutrTable();
updatePermBadge();
setInterval(renderAlarms, 60000);
