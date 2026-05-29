/**
 * 약천재 OG 이미지 + 파비콘 생성 스크립트
 * 실행: node generate-og.js
 */
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'public');

// ── 폰트 로드 (Pretendard) ──────────────────────────────
const fontDirs = [
  // Windows 시스템 폰트
  'C:/Windows/Fonts',
  // Pretendard 로컬 설치 경로
  path.join(process.env.LOCALAPPDATA || '', 'Microsoft/Windows/Fonts'),
];
const fontFiles = [
  'PretendardVariable.ttf',
  'Pretendard-Bold.ttf',
  'Pretendard-Regular.ttf',
  // 없으면 맑은 고딕 사용
  'malgunbd.ttf',   // 맑은 고딕 Bold
  'malgun.ttf',     // 맑은 고딕
];

let fontLoaded = false;
for (const dir of fontDirs) {
  for (const file of fontFiles) {
    const fp = path.join(dir, file);
    if (fs.existsSync(fp)) {
      try {
        GlobalFonts.registerFromPath(fp, 'KO');
        console.log('폰트 로드:', fp);
        fontLoaded = true;
        break;
      } catch(e) {}
    }
  }
  if (fontLoaded) break;
}
if (!fontLoaded) console.warn('⚠️  폰트를 찾지 못했어요. 기본 폰트를 사용합니다.');

const FONT = fontLoaded ? 'KO' : 'sans-serif';

// ── OG 이미지 1200×630 ──────────────────────────────────
function makeOG() {
  const W = 1200, H = 630;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // 배경 그라디언트
  const grad = ctx.createLinearGradient(0, 0, W * 0.6, H);
  grad.addColorStop(0,   '#1B6EE4');
  grad.addColorStop(0.5, '#3182F6');
  grad.addColorStop(1,   '#5B9EF8');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // 우측 흰 패널
  ctx.fillStyle = '#FFFFFF';
  roundRect(ctx, 680, 80, 460, 470, 28);
  ctx.fill();

  // 좌하단 원형 장식
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  circle(ctx, -60, H + 60, 260); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  circle(ctx, -120, H + 80, 380); ctx.fill();

  // 우상단 원형 장식
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  circle(ctx, W + 80, -80, 320); ctx.fill();

  // ── 캡슐 아이콘 ──
  const cx = 130, cy = 160, pw = 140, ph = 60, cr = 30;
  // 왼쪽 반 (흰색)
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(cx - pw/2 + cr, cy, cr, Math.PI/2, -Math.PI/2, true);
  ctx.arc(cx, cy, cr, -Math.PI/2, Math.PI/2, false);
  ctx.closePath(); ctx.fill();
  // 오른쪽 반 (연한 파란)
  ctx.fillStyle = '#93C5FD';
  ctx.beginPath();
  ctx.arc(cx, cy, cr, -Math.PI/2, Math.PI/2, true);
  ctx.arc(cx + pw/2 - cr, cy, cr, Math.PI/2, -Math.PI/2, false);
  ctx.closePath(); ctx.fill();
  // 구분선
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx, cy - cr + 8);
  ctx.lineTo(cx, cy + cr - 8);
  ctx.stroke();

  // ── 왼쪽 텍스트 ──
  // 약천재
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `bold 100px "${FONT}"`;
  ctx.fillText('약천재', 72, 340);

  // 구분선
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillRect(72, 360, 6, 46);

  // Pill Genius
  ctx.fillStyle = 'rgba(210,230,255,0.95)';
  ctx.font = `italic 48px "${FONT}"`;
  ctx.fillText('Pill Genius', 92, 398);

  // 태그라인
  ctx.fillStyle = 'rgba(200,220,255,0.92)';
  ctx.font = `500 34px "${FONT}"`;
  ctx.fillText('약 먹기 전에, 한 번만 물어보세요', 72, 464);

  // 서브 카피
  ctx.fillStyle = 'rgba(180,208,255,0.85)';
  ctx.font = `400 22px "${FONT}"`;
  ctx.fillText('복잡한 약 조합, 천재가 3초 만에 분석해 드립니다', 72, 506);

  // URL 배지
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  roundRect(ctx, 72, 540, 248, 40, 20); ctx.fill();
  ctx.fillStyle = 'rgba(220,235,255,0.95)';
  ctx.font = `500 20px "${FONT}"`;
  ctx.fillText('pillgenius.co.kr', 96, 566);

  // ── 우측 카드 내용 ──
  const items = [
    { icon: '🔍', text: '식약처 DUR 기반 분석' },
    { icon: '💊', text: '44,000+ 의약품 데이터' },
    { icon: '⚡', text: '3초 만에 상호작용 확인' },
    { icon: '🛡️', text: '건강기능식품 포함' },
  ];
  items.forEach((item, i) => {
    const ty = 130 + i * 106;
    ctx.font = `32px "${FONT}"`;
    ctx.fillText(item.icon, 710, ty + 6);
    ctx.fillStyle = '#191F28';
    ctx.font = `600 26px "${FONT}"`;
    ctx.fillText(item.text, 760, ty + 6);
    if (i < items.length - 1) {
      ctx.strokeStyle = '#E5E8EB';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(710, ty + 40);
      ctx.lineTo(1110, ty + 40);
      ctx.stroke();
    }
    ctx.fillStyle = '#191F28';
  });

  fs.writeFileSync(path.join(OUT, 'og-image.png'), canvas.toBuffer('image/png'));
  console.log('✅ og-image.png 생성 완료');
}

// ── 파비콘 192×192 ──────────────────────────────────────
function makeFavicon() {
  const S = 192;
  const canvas = createCanvas(S, S);
  const ctx = canvas.getContext('2d');

  // 파란 원
  ctx.fillStyle = '#3182F6';
  ctx.beginPath(); ctx.arc(S/2, S/2, S/2, 0, Math.PI*2); ctx.fill();

  // 캡슐
  const cx = S/2, cy = S/2, pw = 120, ph = 52, cr = 26;
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(cx - pw/2 + cr, cy, cr, Math.PI/2, -Math.PI/2, true);
  ctx.arc(cx, cy, cr, -Math.PI/2, Math.PI/2, false);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#93C5FD';
  ctx.beginPath();
  ctx.arc(cx, cy, cr, -Math.PI/2, Math.PI/2, true);
  ctx.arc(cx + pw/2 - cr, cy, cr, Math.PI/2, -Math.PI/2, false);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(cx, cy-cr+8); ctx.lineTo(cx, cy+cr-8); ctx.stroke();

  fs.writeFileSync(path.join(OUT, 'icon-192.png'), canvas.toBuffer('image/png'));
  // 32x32 파비콘
  const fav = createCanvas(32, 32);
  const fc = fav.getContext('2d');
  fc.drawImage(canvas, 0, 0, 32, 32);
  fs.writeFileSync(path.join(OUT, 'favicon.png'), fav.toBuffer('image/png'));
  console.log('✅ favicon 생성 완료');
}

// ── 헬퍼 ────────────────────────────────────────────────
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
function circle(ctx, x, y, r) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.closePath();
}

makeOG();
makeFavicon();
console.log('\n🎉 완료! public/ 폴더에 저장됐어요.');
