// 약천재 — 식약처 공공데이터 동기화
// 사용법: node scripts/sync-mfds.js
require('dotenv').config();
const fetch = require('node-fetch');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path = require('path');

const API_KEY = process.env.MFDS_API_KEY;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'db', 'pill-genius.json');
const BASE = 'https://apis.data.go.kr/1471000';

if (!API_KEY || API_KEY === '여기에_API_키_입력') {
  console.error('\n❌ API 키가 없습니다.');
  console.error('   1. https://data.go.kr 회원가입');
  console.error('   2. "의약품개요정보(e약은요)" 검색 → 활용신청');
  console.error('   3. .env 파일에 MFDS_API_KEY=발급받은키 입력');
  console.error('   4. node scripts/sync-mfds.js 재실행\n');
  process.exit(1);
}

const db = low(new FileSync(DB_PATH));

async function fetchPage(url) {
  const res = await fetch(url);
  const json = await res.json();
  return json?.body || {};
}

async function syncDrugs() {
  console.log('  💊 의약품 수집 중...');
  let page = 1, total = 0;
  while (true) {
    const url = `${BASE}/DrbEasyDrugInfoService/getDrbEasyDrugList?serviceKey=${encodeURIComponent(API_KEY)}&type=json&numOfRows=100&pageNo=${page}`;
    const body = await fetchPage(url);
    const items = body.items || [];
    if (!items.length) break;

    items.forEach(d => {
      const existing = db.get('drugs').find({ item_seq: d.itemSeq }).value();
      const drug = { item_seq: d.itemSeq, item_name: d.itemName, entp_name: d.entpName, ingredient: d.material, class_name: d.className, category: 'drug', effect: d.efcyQesitm, dosage: d.useMethodQesitm, caution: d.atpnQesitm, updated_at: new Date().toISOString() };
      if (existing) {
        db.get('drugs').find({ item_seq: d.itemSeq }).assign(drug).write();
      } else {
        const id = db.get('next_drug_id').value();
        db.get('drugs').push({ id, ...drug }).write();
        db.set('next_drug_id', id + 1).write();
      }
    });
    total += items.length;
    console.log(`     페이지 ${page} 완료 (누적 ${total}건)`);
    if (page * 100 >= (body.totalCount || 0)) break;
    page++;
    await new Promise(r => setTimeout(r, 200));
  }
  return total;
}

async function syncInteractions() {
  console.log('  ⚡ DUR 상호작용 수집 중...');
  let page = 1, total = 0;
  while (true) {
    const url = `${BASE}/DURPrdlstInfoService03/getUsjntTabooInfoList03?serviceKey=${encodeURIComponent(API_KEY)}&type=json&numOfRows=100&pageNo=${page}&typeName=병용금기`;
    const body = await fetchPage(url);
    const items = body.items || [];
    if (!items.length) break;

    items.forEach(d => {
      if (!d.itemSeq || !d.mixtureItem) return;
      const existing = db.get('interactions').find({ drug_a_seq: d.itemSeq, drug_b_seq: d.mixtureItem }).value();
      if (!existing) {
        const id = db.get('next_inter_id').value();
        db.get('interactions').push({ id, drug_a_seq: d.itemSeq, drug_b_seq: d.mixtureItem, severity: 4, severity_label: '위험', mechanism: d.prhibtContent || '', clinical_effect: d.DETAIL || '', management: '병용 금기', source: 'DUR', updated_at: new Date().toISOString() }).write();
        db.set('next_inter_id', id + 1).write();
      }
    });
    total += items.length;
    if (page * 100 >= (body.totalCount || 0)) break;
    page++;
    await new Promise(r => setTimeout(r, 200));
  }
  return total;
}

async function main() {
  console.log('\n🔄 식약처 데이터 동기화 시작...\n');
  const start = Date.now();
  const drugCount = await syncDrugs();
  const interCount = await syncInteractions();
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  db.get('sync_logs').push({ type: 'full', status: 'success', count: drugCount + interCount, message: `의약품 ${drugCount}건, 상호작용 ${interCount}건`, ran_at: new Date().toISOString() }).write();
  console.log(`\n🎉 동기화 완료! (${elapsed}초)`);
  console.log(`   의약품 ${drugCount}건 | 상호작용 ${interCount}건\n`);
}

main().catch(e => { console.error('❌ 오류:', e.message); process.exit(1); });
