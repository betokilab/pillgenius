require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const path     = require('path');
const fetch    = require('node-fetch');

const PORT        = process.env.PORT || 3000;
const MFDS_KEY    = process.env.MFDS_API_KEY || '';
const MFDS_BASE   = 'https://apis.data.go.kr/1471000';
const DRUG_EP     = `${MFDS_BASE}/DrbEasyDrugInfoService/getDrbEasyDrugList`;
const DUR_EP      = `${MFDS_BASE}/DURPrdlstInfoService03/getDURPrdlstInfoList03`;

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── 식약처 API 호출 헬퍼 ─────────────────────────────────────
async function callMFDS(endpoint, params) {
  const url = new URL(endpoint);
  url.searchParams.set('ServiceKey', MFDS_KEY);
  url.searchParams.set('type', 'json');
  url.searchParams.set('numOfRows', params.numOfRows || 10);
  url.searchParams.set('pageNo', params.pageNo || 1);
  if (params.itemName) url.searchParams.set('itemName', params.itemName);
  if (params.itemSeq)  url.searchParams.set('itemSeq',  params.itemSeq);

  const res  = await fetch(url.toString(), { timeout: 5000 });
  const json = await res.json();
  const body = json?.body;
  if (!body) return [];
  const items = body.items;
  if (!items) return [];
  return Array.isArray(items) ? items : [items];
}

// e약은요 응답 → 내부 포맷 변환
function transformDrug(item) {
  // 성분명: itemName 괄호 안에 있는 경우가 많음
  const ingMatch = (item.itemName || '').match(/\(([^)]+)\)$/);
  const ingredient = ingMatch ? ingMatch[1] : '';
  return {
    item_seq:   String(item.itemSeq  || item.ITEM_SEQ  || ''),
    item_name:  String(item.itemName || item.ITEM_NAME || ''),
    entp_name:  String(item.entpName || item.ENTP_NAME || ''),
    ingredient,
    category:   'drug',
    effect:     String(item.efcyQesitm      || ''),
    dosage:     String(item.useMethodQesitm || ''),
    caution:    String(item.atpnQesitm      || ''),
    interaction:String(item.intrcQesitm     || ''),
    _source:    'mfds',
  };
}

// ══════════════════════════════════════════════════════════════
//  인메모리 데이터 (Vercel 서버리스 호환 — 파일 시스템 불필요)
// ══════════════════════════════════════════════════════════════
const DRUGS = [
  // ─── 의약품 ───────────────────────────────────────────────
  { id:1,  item_seq:'D001', item_name:'타이레놀 500mg',         entp_name:'한국얀센',       ingredient:'아세트아미노펜 500mg',      class_name:'해열진통제',   category:'drug',        effect:'두통, 치통, 발열, 근육통 완화',       dosage:'성인 1회 1~2정, 4~6시간 간격', caution:'음주 중 복용 금지, 간 질환 환자 주의' },
  { id:2,  item_seq:'D002', item_name:'이부프로펜 200mg',       entp_name:'삼일제약',       ingredient:'이부프로펜 200mg',           class_name:'소염진통제',   category:'drug',        effect:'소염, 진통, 해열',                   dosage:'성인 1회 1~2정, 식후 복용',    caution:'위장장애 주의, 임부 금기' },
  { id:3,  item_seq:'D003', item_name:'아스피린 100mg',         entp_name:'바이엘코리아',   ingredient:'아세틸살리실산 100mg',      class_name:'항혈소판제',   category:'drug',        effect:'혈전 예방, 해열진통',                dosage:'1일 1회 1정',                  caution:'출혈 경향 주의, 수술 전 중단' },
  { id:4,  item_seq:'D004', item_name:'와파린 5mg',             entp_name:'중외제약',       ingredient:'와파린나트륨 5mg',          class_name:'항응고제',     category:'drug',        effect:'혈전색전증 예방 및 치료',             dosage:'의사 처방에 따라 조절',        caution:'출혈 위험, INR 정기 모니터링 필수' },
  { id:5,  item_seq:'D005', item_name:'메트포르민 500mg',       entp_name:'보령제약',       ingredient:'메트포르민염산염 500mg',    class_name:'당뇨약',       category:'drug',        effect:'제2형 당뇨병 혈당 조절',             dosage:'식사와 함께 1회 1정',          caution:'신장기능 저하 시 주의' },
  { id:6,  item_seq:'D006', item_name:'암로디핀 5mg',           entp_name:'한미약품',       ingredient:'암로디핀베실산염 5mg',      class_name:'고혈압약',     category:'drug',        effect:'고혈압, 협심증 치료',                dosage:'1일 1회 1정',                  caution:'자몽 주스 금기, 저혈압 주의' },
  { id:7,  item_seq:'D007', item_name:'로수바스타틴 10mg',      entp_name:'아스트라제네카', ingredient:'로수바스타틴칼슘 10mg',     class_name:'고지혈증약',   category:'drug',        effect:'LDL 콜레스테롤 감소',               dosage:'1일 1회 1정',                  caution:'근육통 주의, 임부 금기' },
  { id:8,  item_seq:'D008', item_name:'오메프라졸 20mg',        entp_name:'아스트라제네카', ingredient:'오메프라졸 20mg',           class_name:'위산억제제',   category:'drug',        effect:'위궤양, 역류성식도염 치료',          dosage:'식전 30분 복용',               caution:'장기복용 시 마그네슘 감소' },
  { id:9,  item_seq:'D009', item_name:'메트로니다졸 250mg',     entp_name:'동화약품',       ingredient:'메트로니다졸 250mg',        class_name:'항생제',       category:'drug',        effect:'혐기성균 감염 치료',                 dosage:'1회 1정, 하루 3회',            caution:'음주 절대 금기 (복용 후 48시간)' },
  { id:10, item_seq:'D010', item_name:'세티리진 10mg',          entp_name:'UCB',            ingredient:'세티리진염산염 10mg',       class_name:'항히스타민제', category:'drug',        effect:'알레르기 비염, 두드러기',            dosage:'1일 1회 1정',                  caution:'졸음 유발, 운전 주의' },
  { id:11, item_seq:'D011', item_name:'레보티록신 50mcg',       entp_name:'한국다케다',     ingredient:'레보티록신나트륨 50mcg',   class_name:'갑상선약',     category:'drug',        effect:'갑상선기능저하증 치료',              dosage:'아침 공복, 물과 함께 복용',    caution:'커피·칼슘 1시간 이후' },
  { id:12, item_seq:'D012', item_name:'독실아민 25mg',          entp_name:'유한양행',       ingredient:'독실아민숙신산염 25mg',    class_name:'수면보조제',   category:'drug',        effect:'일시적 수면장애 완화',               dosage:'취침 30분 전 1정',             caution:'음주 금기, 운전 금지' },
  { id:13, item_seq:'D013', item_name:'클로피도그렐 75mg',      entp_name:'사노피',         ingredient:'클로피도그렐황산수소염 75mg', class_name:'항혈소판제', category:'drug',        effect:'혈전 예방',                          dosage:'1일 1회 1정',                  caution:'출혈 주의, 수술 전 7일 중단' },
  { id:14, item_seq:'D014', item_name:'아세트아미노펜 650mg',   entp_name:'대웅제약',       ingredient:'아세트아미노펜 650mg',     class_name:'해열진통제',   category:'drug',        effect:'두통, 발열, 근육통',                dosage:'1회 1정, 4~6시간 간격',        caution:'하루 최대 4g 초과 금지' },
  { id:15, item_seq:'D015', item_name:'나프록센 500mg',         entp_name:'한독',           ingredient:'나프록센 500mg',           class_name:'소염진통제',   category:'drug',        effect:'관절염, 근골격계 통증',              dosage:'1회 1정, 1일 2회',             caution:'심혈관 질환자 주의' },
  { id:16, item_seq:'D016', item_name:'로라타딘 10mg',          entp_name:'유한양행',       ingredient:'로라타딘 10mg',            class_name:'항히스타민제', category:'drug',        effect:'알레르기 비염, 두드러기',            dosage:'1일 1회 1정',                  caution:'졸음 적음, 운전 가능' },
  { id:17, item_seq:'D017', item_name:'덱사메타손 0.5mg',       entp_name:'동아제약',       ingredient:'덱사메타손 0.5mg',         class_name:'스테로이드',   category:'drug',        effect:'항염증, 면역억제',                   dosage:'의사 처방에 따라',             caution:'장기복용 금기, 감염 주의' },
  { id:18, item_seq:'D018', item_name:'리피토 10mg',            entp_name:'화이자',         ingredient:'아토르바스타틴칼슘 10mg', class_name:'고지혈증약',   category:'drug',        effect:'LDL 콜레스테롤 감소',               dosage:'1일 1회, 식사와 무관',         caution:'근육 이상 증상 시 즉시 중단' },
  { id:19, item_seq:'D019', item_name:'딜티아젬 60mg',          entp_name:'부광약품',       ingredient:'딜티아젬염산염 60mg',      class_name:'칼슘채널차단제',category:'drug',       effect:'협심증, 고혈압',                     dosage:'1일 3회',                      caution:'서맥 주의, 저혈압' },
  { id:20, item_seq:'D020', item_name:'프레드니솔론 5mg',       entp_name:'신풍제약',       ingredient:'프레드니솔론 5mg',         class_name:'스테로이드',   category:'drug',        effect:'염증, 알레르기 치료',                dosage:'의사 처방에 따라',             caution:'당뇨, 고혈압 주의' },
  { id:21, item_seq:'D021', item_name:'메토클로프라미드 10mg',  entp_name:'일동제약',       ingredient:'메토클로프라미드염산염 10mg', class_name:'위장관운동촉진제', category:'drug',  effect:'구역, 구토 완화',                    dosage:'1회 1정, 식전 30분',           caution:'졸음, 추체외로 부작용' },
  { id:22, item_seq:'D022', item_name:'에스오메프라졸 40mg',    entp_name:'아스트라제네카', ingredient:'에스오메프라졸마그네슘 40mg', class_name:'위산억제제', category:'drug',       effect:'역류성식도염, 위궤양',               dosage:'식전 1시간 복용',              caution:'장기복용 시 골다공증' },
  { id:23, item_seq:'D023', item_name:'알프라졸람 0.25mg',      entp_name:'한국화이자',     ingredient:'알프라졸람 0.25mg',        class_name:'항불안제',     category:'drug',        effect:'불안장애, 공황장애',                 dosage:'의사 처방에 따라',             caution:'의존성, 음주 금기' },
  { id:24, item_seq:'D024', item_name:'졸피뎀 10mg',            entp_name:'사노피',         ingredient:'졸피뎀타르타르산염 10mg', class_name:'수면제',       category:'drug',        effect:'불면증 치료',                        dosage:'취침 직전 1정',                caution:'의존성, 음주 절대 금기' },
  { id:25, item_seq:'D025', item_name:'아테놀롤 50mg',          entp_name:'아스트라제네카', ingredient:'아테놀롤 50mg',            class_name:'베타차단제',   category:'drug',        effect:'고혈압, 협심증',                     dosage:'1일 1~2회',                    caution:'천식 금기, 갑자기 중단 금지' },
  // ─── 건강기능식품 ──────────────────────────────────────────
  { id:30, item_seq:'S001', item_name:'오메가3 1000mg',         entp_name:'종근당건강',     ingredient:'EPA/DHA 혼합오일 1000mg', class_name:'건강기능식품', category:'supplement',  effect:'혈중 중성지질 개선, 혈행 개선',      dosage:'1일 1~2캡슐',                  caution:'항응고제 복용자 주의' },
  { id:31, item_seq:'S002', item_name:'비타민D 2000IU',         entp_name:'고려은단',       ingredient:'비타민D3 50mcg',           class_name:'건강기능식품', category:'supplement',  effect:'뼈·치아 건강, 면역 기능',            dosage:'1일 1정',                      caution:'고용량 장기복용 시 고칼슘혈증' },
  { id:32, item_seq:'S003', item_name:'마그네슘 300mg',         entp_name:'나우푸드',       ingredient:'산화마그네슘 300mg',       class_name:'건강기능식품', category:'supplement',  effect:'에너지 생성, 신경·근육 기능',        dosage:'1일 1~2정',                    caution:'설사 유발 가능' },
  { id:33, item_seq:'S004', item_name:'코엔자임Q10 100mg',      entp_name:'솔가',           ingredient:'유비퀴논 100mg',           class_name:'건강기능식품', category:'supplement',  effect:'항산화, 에너지 대사',                dosage:'1일 1정',                      caution:'와파린 상호작용 가능' },
  { id:34, item_seq:'S005', item_name:'홍삼 600mg',             entp_name:'정관장',         ingredient:'홍삼분말 600mg',           class_name:'건강기능식품', category:'supplement',  effect:'면역력 증진, 피로 회복',             dosage:'1일 3회 2캡슐',                caution:'항응고제·혈압약 상호작용' },
  { id:35, item_seq:'S006', item_name:'은행잎 추출물 80mg',     entp_name:'한국인스팜',     ingredient:'은행잎 표준화 추출물 80mg', class_name:'건강기능식품', category:'supplement', effect:'혈행 개선, 기억력 지원',             dosage:'1일 3회',                      caution:'항응고제·아스피린 병용 주의' },
  { id:36, item_seq:'S007', item_name:'철분제 30mg',            entp_name:'한미약품',       ingredient:'철(황산제일철) 30mg',     class_name:'건강기능식품', category:'supplement',  effect:'철 결핍성 빈혈 예방',                dosage:'공복 복용',                    caution:'변비·흑변, 우유·커피 2시간 간격' },
  { id:37, item_seq:'S008', item_name:'비타민C 1000mg',         entp_name:'고려은단',       ingredient:'아스코르브산 1000mg',      class_name:'건강기능식품', category:'supplement',  effect:'항산화, 면역력, 피부 건강',          dosage:'1일 1정',                      caution:'고용량 시 설사 가능' },
  { id:38, item_seq:'S009', item_name:'루테인 20mg',            entp_name:'종근당건강',     ingredient:'루테인 20mg',              class_name:'건강기능식품', category:'supplement',  effect:'눈 건강, 황반 보호',                 dosage:'1일 1정, 지방식사와 함께',     caution:'흡연자 고용량 주의' },
  { id:39, item_seq:'S010', item_name:'유산균 50억',            entp_name:'일동제약',       ingredient:'락토바실러스 50억 CFU',   class_name:'건강기능식품', category:'supplement',  effect:'장 건강, 면역 기능',                 dosage:'1일 1캡슐',                    caution:'항생제와 2시간 이상 간격' },
  { id:40, item_seq:'S011', item_name:'아연 15mg',              entp_name:'나우푸드',       ingredient:'아연(산화아연) 15mg',     class_name:'건강기능식품', category:'supplement',  effect:'면역력, 상처 회복',                  dosage:'1일 1정',                      caution:'빈속 복용 시 구역' },
  { id:41, item_seq:'S012', item_name:'비타민B 복합',           entp_name:'솔가',           ingredient:'티아민, 리보플라빈, B6, B12', class_name:'건강기능식품', category:'supplement', effect:'에너지 대사, 신경 기능',            dosage:'1일 1정',                      caution:'소변 노랗게 변할 수 있음 (정상)' },
  { id:42, item_seq:'S013', item_name:'칼슘 500mg',             entp_name:'종근당건강',     ingredient:'탄산칼슘 500mg',           class_name:'건강기능식품', category:'supplement',  effect:'뼈·치아 형성 및 유지',              dosage:'1일 2~3정',                    caution:'철분·레보티록신 흡수 방해' },
  { id:43, item_seq:'S014', item_name:'글루코사민 1500mg',      entp_name:'GNC',            ingredient:'글루코사민황산염 1500mg', class_name:'건강기능식품', category:'supplement',  effect:'관절 건강, 연골 보호',               dosage:'1일 1회',                      caution:'갑각류 알레르기 주의' },
  { id:44, item_seq:'S015', item_name:'밀크씨슬 130mg',         entp_name:'솔가',           ingredient:'실리마린 130mg',           class_name:'건강기능식품', category:'supplement',  effect:'간 건강 보호',                       dosage:'1일 3회',                      caution:'국화과 알레르기 주의' },
];

const INTERACTIONS = [
  { id:1,  drug_a_seq:'D001', drug_b_seq:'D004', severity:3, severity_label:'경고', mechanism:'아세트아미노펜이 CYP2C9를 억제하여 와파린 대사 감소, INR 상승', clinical_effect:'출혈 위험 증가', management:'INR 모니터링 강화, 아세트아미노펜 용량 최소화', source:'DUR' },
  { id:2,  drug_a_seq:'D002', drug_b_seq:'D004', severity:4, severity_label:'위험', mechanism:'NSAIDs가 위장관 점막 손상 + 와파린 항응고 효과 증강', clinical_effect:'심각한 위장관 출혈 위험', management:'병용 금기. 진통제 필요 시 아세트아미노펜으로 대체', source:'DUR' },
  { id:3,  drug_a_seq:'D003', drug_b_seq:'D004', severity:3, severity_label:'경고', mechanism:'아스피린 항혈소판 효과 + 와파린 항응고 효과 중첩', clinical_effect:'출혈 위험 대폭 증가', management:'반드시 의사 처방 하에 병용, INR 모니터링', source:'DUR' },
  { id:4,  drug_a_seq:'S001', drug_b_seq:'D004', severity:2, severity_label:'주의', mechanism:'오메가3 고용량이 혈소판 응집 억제 → 항응고 효과 상승 가능', clinical_effect:'출혈 경향 증가', management:'의사 상담 후 복용, INR 확인', source:'DUR' },
  { id:5,  drug_a_seq:'S005', drug_b_seq:'D004', severity:3, severity_label:'경고', mechanism:'홍삼이 와파린 대사 효소에 영향 → INR 불안정', clinical_effect:'항응고 효과 예측 불가 변동', management:'반드시 의사 상담, INR 모니터링 강화', source:'DUR' },
  { id:6,  drug_a_seq:'S006', drug_b_seq:'D004', severity:3, severity_label:'경고', mechanism:'은행잎 플라보노이드가 혈소판 응집 억제', clinical_effect:'출혈 위험 증가', management:'병용 주의, 수술 전 2주 중단', source:'DUR' },
  { id:7,  drug_a_seq:'D002', drug_b_seq:'D003', severity:3, severity_label:'경고', mechanism:'두 NSAIDs 계열 약물 병용 → 위장관 부작용 상가', clinical_effect:'위장관 출혈 위험 증가', management:'동일 계열 중복 복용 금기', source:'DUR' },
  { id:8,  drug_a_seq:'D007', drug_b_seq:'S004', severity:1, severity_label:'안전', mechanism:'스타틴 복용 시 CoQ10 보충은 근육통 완화 가능', clinical_effect:'부작용 완화 기대', management:'병용 가능', source:'문헌' },
  { id:9,  drug_a_seq:'D013', drug_b_seq:'D008', severity:2, severity_label:'주의', mechanism:'오메프라졸이 CYP2C19 억제 → 클로피도그렐 활성화 감소', clinical_effect:'혈전 예방 효과 감소', management:'판토프라졸로 대체 고려', source:'DUR' },
  { id:10, drug_a_seq:'S007', drug_b_seq:'D011', severity:2, severity_label:'주의', mechanism:'철분이 레보티록신 흡수 방해', clinical_effect:'갑상선 호르몬 흡수 감소', management:'4시간 간격 복용 필수', source:'DUR' },
  { id:11, drug_a_seq:'D003', drug_b_seq:'D013', severity:3, severity_label:'경고', mechanism:'두 항혈소판제 중복 → 출혈 위험 증가', clinical_effect:'심각한 출혈 위험', management:'의사 처방 필수 (심장질환자 제외)', source:'DUR' },
  { id:12, drug_a_seq:'D006', drug_b_seq:'D019', severity:2, severity_label:'주의', mechanism:'두 칼슘채널차단제 병용 → 혈압 과도하게 저하', clinical_effect:'저혈압, 서맥', management:'병용 시 혈압 모니터링 강화', source:'DUR' },
  { id:13, drug_a_seq:'S005', drug_b_seq:'D006', severity:2, severity_label:'주의', mechanism:'홍삼이 혈압 조절 기전에 영향', clinical_effect:'혈압 과도한 변동 가능', management:'복용 전 의사 상담', source:'문헌' },
  { id:14, drug_a_seq:'D024', drug_b_seq:'D012', severity:3, severity_label:'경고', mechanism:'두 중추신경억제제 병용 → 진정 효과 상가', clinical_effect:'과도한 진정, 호흡 억제', management:'동시 복용 금기', source:'DUR' },
  { id:15, drug_a_seq:'D023', drug_b_seq:'D024', severity:3, severity_label:'경고', mechanism:'벤조디아제핀 + 수면제 중복 → CNS 억제 심화', clinical_effect:'과진정, 호흡 억제 위험', management:'병용 금기, 반드시 의사 처방', source:'DUR' },
  { id:16, drug_a_seq:'S013', drug_b_seq:'D011', severity:2, severity_label:'주의', mechanism:'칼슘이 레보티록신 흡수 방해', clinical_effect:'갑상선 호르몬 흡수 감소', management:'4시간 이상 간격 복용', source:'DUR' },
  { id:17, drug_a_seq:'D014', drug_b_seq:'D004', severity:3, severity_label:'경고', mechanism:'아세트아미노펜 + 와파린 INR 상승', clinical_effect:'출혈 위험', management:'INR 모니터링', source:'DUR' },
  { id:18, drug_a_seq:'S001', drug_b_seq:'D003', severity:2, severity_label:'주의', mechanism:'오메가3 + 아스피린 항혈소판 효과 중첩', clinical_effect:'출혈 경향 증가', management:'의사 상담 후 병용', source:'문헌' },
];

let nextDrugId  = DRUGS.length + 1;
let nextInterId = INTERACTIONS.length + 1;

// 약품·상호작용 런타임 배열 (메모리)
const drugs        = [...DRUGS];
const interactions = [...INTERACTIONS];

// ══════════════════════════════════════════════════════════════
//  API 라우트
// ══════════════════════════════════════════════════════════════

// ── 검색 (식약처 실데이터 우선 → 샘플 폴백) ──────────────────
app.get('/api/search', async (req, res) => {
  const { q = '', category = 'all', limit = 10 } = req.query;
  if (!q.trim()) return res.json([]);

  // 1) 식약처 실API 시도
  if (MFDS_KEY) {
    try {
      const items = await callMFDS(DRUG_EP, { itemName: q, numOfRows: Number(limit) });
      if (items.length > 0) {
        let results = items.map(transformDrug);
        if (category !== 'all') results = results.filter(d => d.category === category);
        return res.json(results.slice(0, Number(limit)));
      }
    } catch (e) {
      console.warn('[MFDS API 오류, 샘플 폴백]', e.message);
    }
  }

  // 2) 샘플 데이터 폴백
  const kw = q.toLowerCase();
  let results = drugs.filter(d => {
    const nameMatch = d.item_name.toLowerCase().includes(kw);
    const ingMatch  = (d.ingredient || '').toLowerCase().includes(kw);
    const enpMatch  = (d.entp_name  || '').toLowerCase().includes(kw);
    return (nameMatch || ingMatch || enpMatch) && (category === 'all' || d.category === category);
  });
  results.sort((a, b) => {
    const aStarts = a.item_name.toLowerCase().startsWith(kw) ? 0 : 1;
    const bStarts = b.item_name.toLowerCase().startsWith(kw) ? 0 : 1;
    return aStarts - bStarts || a.item_name.length - b.item_name.length;
  });
  res.json(results.slice(0, Number(limit)));
});

// ── 상호작용 체크 ────────────────────────────────────────────
app.post('/api/interactions/check', (req, res) => {
  const { drug_seqs } = req.body;
  if (!Array.isArray(drug_seqs) || drug_seqs.length < 2)
    return res.status(400).json({ error: '약을 2개 이상 입력해주세요' });

  const pairs = [];
  for (let i = 0; i < drug_seqs.length; i++) {
    for (let j = i + 1; j < drug_seqs.length; j++) {
      const a = drug_seqs[i], b = drug_seqs[j];
      const drugA = drugs.find(d => d.item_seq === a);
      const drugB = drugs.find(d => d.item_seq === b);
      const inter = interactions.find(x =>
        (x.drug_a_seq === a && x.drug_b_seq === b) ||
        (x.drug_a_seq === b && x.drug_b_seq === a)
      );
      pairs.push({
        drug_a:         drugA || { item_seq: a, item_name: a },
        drug_b:         drugB || { item_seq: b, item_name: b },
        interaction:    inter || null,
        severity:       inter ? inter.severity : 1,
        severity_label: inter ? inter.severity_label : '안전',
        has_interaction: !!(inter && inter.severity > 1),
      });
    }
  }
  const maxSev = Math.max(...pairs.map(p => p.severity));
  const labels = { 1:'안전', 2:'주의', 3:'경고', 4:'위험' };
  res.json({ overall_severity: maxSev, overall_label: labels[maxSev], pairs, checked_at: new Date().toISOString() });
});

// ── 약 상세 ──────────────────────────────────────────────────
app.get('/api/drugs/:seq', (req, res) => {
  const drug = drugs.find(d => d.item_seq === req.params.seq);
  if (!drug) return res.status(404).json({ error: '약품을 찾을 수 없습니다' });
  const inters = interactions.filter(x => x.drug_a_seq === req.params.seq || x.drug_b_seq === req.params.seq);
  res.json({ ...drug, interactions: inters });
});

// ── 증상 검색 ────────────────────────────────────────────────
const SYMPTOM_MAP = {
  '두통':     ['D001','D002','D014','D015'],
  '발열':     ['D001','D002','D014'],
  '소화불량': ['D008','D022'],
  '알레르기': ['D010','D016'],
  '불면':     ['D012','D024'],
  '혈전예방': ['D003','D013'],
  '당뇨':     ['D005'],
  '고혈압':   ['D006','D025'],
  '고지혈증': ['D007','D018'],
  '위염':     ['D008','D022'],
  '갑상선':   ['D011'],
  '감염':     ['D009'],
};
app.get('/api/symptoms', (req, res) => {
  const { symptom } = req.query;
  if (!symptom) return res.json(Object.keys(SYMPTOM_MAP).map(n => ({ name: n })));
  const seqs  = SYMPTOM_MAP[symptom] || [];
  const found = drugs.filter(d => seqs.includes(d.item_seq));
  res.json({ symptom, drugs: found });
});

// ── 통계 ─────────────────────────────────────────────────────
app.get('/api/admin/stats', (req, res) => {
  res.json({
    drugs:              drugs.filter(d => d.category === 'drug').length,
    supplements:        drugs.filter(d => d.category === 'supplement').length,
    interactions:       interactions.length,
    danger_interactions: interactions.filter(x => x.severity >= 3).length,
    last_sync:          null,
  });
});

// ── Admin: 약품 목록 ──────────────────────────────────────────
app.get('/api/admin/drugs', (req, res) => {
  const { q = '', category = 'all', page = 1, limit = 20 } = req.query;
  const kw  = q.toLowerCase();
  let list  = drugs.filter(d => {
    const m = !kw || d.item_name.toLowerCase().includes(kw) || (d.ingredient || '').toLowerCase().includes(kw);
    return m && (category === 'all' || d.category === category);
  });
  const total  = list.length;
  const offset = (Number(page) - 1) * Number(limit);
  res.json({ total, page: Number(page), limit: Number(limit), data: list.slice(offset, offset + Number(limit)) });
});

app.post('/api/admin/drugs', (req, res) => {
  const { item_name } = req.body;
  if (!item_name) return res.status(400).json({ error: '약품명은 필수입니다' });
  const newDrug = { id: nextDrugId++, item_seq: req.body.item_seq || `MANUAL-${nextDrugId}`, ...req.body, created_at: new Date().toISOString() };
  drugs.push(newDrug);
  res.json({ success: true, id: newDrug.id });
});

app.delete('/api/admin/drugs/:id', (req, res) => {
  const idx = drugs.findIndex(d => d.id === Number(req.params.id));
  if (idx !== -1) drugs.splice(idx, 1);
  res.json({ success: true });
});

// ── Admin: 상호작용 ───────────────────────────────────────────
app.get('/api/admin/interactions', (req, res) => {
  const { severity, page = 1, limit = 20 } = req.query;
  const drugsMap = {};
  drugs.forEach(d => { drugsMap[d.item_seq] = d; });
  let list = interactions
    .filter(x => !severity || severity === 'all' || x.severity === Number(severity))
    .map(x => ({
      ...x,
      drug_a_name:       drugsMap[x.drug_a_seq]?.item_name || x.drug_a_seq,
      drug_a_ingredient: drugsMap[x.drug_a_seq]?.ingredient || '',
      drug_b_name:       drugsMap[x.drug_b_seq]?.item_name || x.drug_b_seq,
      drug_b_ingredient: drugsMap[x.drug_b_seq]?.ingredient || '',
    }))
    .sort((a, b) => b.severity - a.severity);
  const total  = list.length;
  const offset = (Number(page) - 1) * Number(limit);
  res.json({ total, page: Number(page), data: list.slice(offset, offset + Number(limit)) });
});

app.post('/api/admin/interactions', (req, res) => {
  const { drug_a_seq, drug_b_seq } = req.body;
  if (!drug_a_seq || !drug_b_seq) return res.status(400).json({ error: '약물 A, B 모두 필요합니다' });
  const labels = { 1:'안전', 2:'주의', 3:'경고', 4:'위험' };
  const sev    = Number(req.body.severity) || 1;
  const newInt = { id: nextInterId++, ...req.body, severity: sev, severity_label: labels[sev] };
  interactions.push(newInt);
  res.json({ success: true });
});

// ── SPA 라우팅 ────────────────────────────────────────────────
app.get('/admin*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('*',       (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => {
  console.log(`\n🚀 약천재 서버 시작!`);
  console.log(`   http://localhost:${PORT}         ← 사용자 화면`);
  console.log(`   http://localhost:${PORT}/admin    ← 백오피스`);
  console.log(`   의약품 ${drugs.filter(d=>d.category==='drug').length}개 · 건기식 ${drugs.filter(d=>d.category==='supplement').length}개 · 상호작용 ${interactions.length}건\n`);
});
