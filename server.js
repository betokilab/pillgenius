require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'db', 'pill-genius.json');

// DB 파일 없으면 자동 setup
if (!fs.existsSync(DB_PATH)) {
  console.log('📦 DB 파일이 없습니다. 샘플 데이터 초기화 중...');
  require('./db/setup.js');
}

const adapter = new FileSync(DB_PATH);
const db = low(adapter);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── 검색 API ────────────────────────────────────────────
app.get('/api/search', (req, res) => {
  const { q = '', category = 'all', limit = 10 } = req.query;
  if (!q.trim()) return res.json([]);
  const kw = q.toLowerCase();
  let results = db.get('drugs').filter(d => {
    const nameMatch = d.item_name.toLowerCase().includes(kw);
    const ingMatch = (d.ingredient || '').toLowerCase().includes(kw);
    return (nameMatch || ingMatch) && (category === 'all' || d.category === category);
  }).value();
  // 시작 문자 우선 정렬
  results.sort((a, b) => {
    const aStarts = a.item_name.toLowerCase().startsWith(kw) ? 0 : 1;
    const bStarts = b.item_name.toLowerCase().startsWith(kw) ? 0 : 1;
    return aStarts - bStarts || a.item_name.length - b.item_name.length;
  });
  res.json(results.slice(0, Number(limit)));
});

// ── 상호작용 체크 ────────────────────────────────────────
app.post('/api/interactions/check', (req, res) => {
  const { drug_seqs } = req.body;
  if (!Array.isArray(drug_seqs) || drug_seqs.length < 2)
    return res.status(400).json({ error: '약을 2개 이상 입력해주세요' });

  const pairs = [];
  for (let i = 0; i < drug_seqs.length; i++) {
    for (let j = i + 1; j < drug_seqs.length; j++) {
      const a = drug_seqs[i], b = drug_seqs[j];
      const drugA = db.get('drugs').find({ item_seq: a }).value();
      const drugB = db.get('drugs').find({ item_seq: b }).value();
      const inter = db.get('interactions').find(x =>
        (x.drug_a_seq === a && x.drug_b_seq === b) || (x.drug_a_seq === b && x.drug_b_seq === a)
      ).value();
      pairs.push({
        drug_a: drugA || { item_seq: a, item_name: a },
        drug_b: drugB || { item_seq: b, item_name: b },
        interaction: inter || null,
        severity: inter ? inter.severity : 1,
        severity_label: inter ? inter.severity_label : '안전',
        has_interaction: !!(inter && inter.severity > 1),
      });
    }
  }

  const maxSev = Math.max(...pairs.map(p => p.severity));
  const labels = { 1:'안전', 2:'주의', 3:'경고', 4:'위험' };
  res.json({ overall_severity: maxSev, overall_label: labels[maxSev], pairs, checked_at: new Date().toISOString() });
});

// ── 약 상세 ──────────────────────────────────────────────
app.get('/api/drugs/:seq', (req, res) => {
  const drug = db.get('drugs').find({ item_seq: req.params.seq }).value();
  if (!drug) return res.status(404).json({ error: '약품을 찾을 수 없습니다' });
  const interactions = db.get('interactions').filter(x =>
    x.drug_a_seq === req.params.seq || x.drug_b_seq === req.params.seq
  ).value();
  res.json({ ...drug, interactions });
});

// ── 증상 검색 ────────────────────────────────────────────
const SYMPTOM_MAP = {
  '두통': ['D001','D002','D003'], '발열': ['D001','D002'],
  '소화불량': ['D008'], '알레르기': ['D010'], '불면': ['D012'],
  '혈전예방': ['D003','D013'], '당뇨': ['D005'], '고혈압': ['D006'],
  '고지혈증': ['D007'], '위염': ['D008'], '갑상선': ['D011'], '감염': ['D009'],
};
app.get('/api/symptoms', (req, res) => {
  const { symptom } = req.query;
  if (!symptom) return res.json(Object.keys(SYMPTOM_MAP).map(n => ({ name: n })));
  const seqs = SYMPTOM_MAP[symptom] || [];
  const drugs = db.get('drugs').filter(d => seqs.includes(d.item_seq)).value();
  res.json({ symptom, drugs });
});

// ── Admin: 통계 ──────────────────────────────────────────
app.get('/api/admin/stats', (req, res) => {
  const drugs = db.get('drugs').filter({ category: 'drug' }).size().value();
  const supps = db.get('drugs').filter({ category: 'supplement' }).size().value();
  const inters = db.get('interactions').size().value();
  const danger = db.get('interactions').filter(x => x.severity >= 3).size().value();
  const lastSync = db.get('sync_logs').last().value();
  res.json({ drugs, supplements: supps, interactions: inters, danger_interactions: danger, last_sync: lastSync || null });
});

// ── Admin: 의약품 목록 ────────────────────────────────────
app.get('/api/admin/drugs', (req, res) => {
  const { q = '', category = 'all', page = 1, limit = 20 } = req.query;
  const kw = q.toLowerCase();
  let list = db.get('drugs').filter(d => {
    const match = !kw || d.item_name.toLowerCase().includes(kw) || (d.ingredient || '').toLowerCase().includes(kw);
    return match && (category === 'all' || d.category === category);
  }).value();
  const total = list.length;
  const offset = (Number(page) - 1) * Number(limit);
  res.json({ total, page: Number(page), limit: Number(limit), data: list.slice(offset, offset + Number(limit)) });
});

app.post('/api/admin/drugs', (req, res) => {
  const { item_name } = req.body;
  if (!item_name) return res.status(400).json({ error: '약품명은 필수입니다' });
  const nextId = db.get('next_drug_id').value();
  const newDrug = { id: nextId, item_seq: req.body.item_seq || `MANUAL-${nextId}`, ...req.body, created_at: new Date().toISOString() };
  db.get('drugs').push(newDrug).write();
  db.set('next_drug_id', nextId + 1).write();
  res.json({ success: true, id: nextId });
});

app.delete('/api/admin/drugs/:id', (req, res) => {
  db.get('drugs').remove({ id: Number(req.params.id) }).write();
  res.json({ success: true });
});

// ── Admin: 상호작용 목록 ──────────────────────────────────
app.get('/api/admin/interactions', (req, res) => {
  const { severity, page = 1, limit = 20 } = req.query;
  const drugsMap = {};
  db.get('drugs').value().forEach(d => { drugsMap[d.item_seq] = d; });

  let list = db.get('interactions').filter(x =>
    !severity || severity === 'all' || x.severity === Number(severity)
  ).value().map(x => ({
    ...x,
    drug_a_name: drugsMap[x.drug_a_seq]?.item_name || x.drug_a_seq,
    drug_a_ingredient: drugsMap[x.drug_a_seq]?.ingredient || '',
    drug_b_name: drugsMap[x.drug_b_seq]?.item_name || x.drug_b_seq,
    drug_b_ingredient: drugsMap[x.drug_b_seq]?.ingredient || '',
  })).sort((a, b) => b.severity - a.severity);

  const total = list.length;
  const offset = (Number(page) - 1) * Number(limit);
  res.json({ total, page: Number(page), data: list.slice(offset, offset + Number(limit)) });
});

app.post('/api/admin/interactions', (req, res) => {
  const { drug_a_seq, drug_b_seq } = req.body;
  if (!drug_a_seq || !drug_b_seq) return res.status(400).json({ error: '약물 A, B 모두 필요합니다' });
  const nextId = db.get('next_inter_id').value();
  const labels = { 1:'안전', 2:'주의', 3:'경고', 4:'위험' };
  const sev = Number(req.body.severity) || 1;
  db.get('interactions').push({ id: nextId, ...req.body, severity: sev, severity_label: labels[sev] }).write();
  db.set('next_inter_id', nextId + 1).write();
  res.json({ success: true });
});

// SPA 라우팅
app.get('/admin*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => {
  console.log(`\n🚀 약천재 서버 시작!`);
  console.log(`   http://localhost:${PORT}         ← 사용자 화면`);
  console.log(`   http://localhost:${PORT}/admin    ← 백오피스\n`);
});
