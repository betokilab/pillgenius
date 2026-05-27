# 약천재 — 약/영양제 상호작용 체커

식품의약품안전처 공공데이터 기반 복약 안전 서비스

## 빠른 시작 (3단계)

### 1단계 — Node.js 설치 확인
```bash
node --version   # v18 이상 필요
```
없으면 https://nodejs.org 에서 LTS 버전 설치

### 2단계 — 실행
```bash
npm install       # 패키지 설치 (최초 1회)
npm start         # 서버 시작
```

### 3단계 — 브라우저에서 열기
- 사용자 화면: http://localhost:3000
- 백오피스:    http://localhost:3000/admin

> 처음 실행 시 샘플 데이터(20종 약품, 10건 상호작용)가 자동으로 준비됩니다.

---

## 식약처 실데이터 연동 (선택)

### API 키 발급
1. https://data.go.kr 회원가입
2. 검색창에서 아래 4개 API 신청 (모두 무료, 1~2일 소요)
   - 의약품개요정보(e약은요)
   - DUR품목정보 서비스
   - 건강기능식품 정보 서비스
   - 의약품 낱알식별 서비스

### 키 설정
```bash
# .env.example → .env 복사 후 편집
cp .env.example .env
# .env 파일에서 아래 줄 수정:
MFDS_API_KEY=발급받은_API_키
```

### 동기화 실행
```bash
npm run sync
# 의약품 44,120건 + 상호작용 637,480건 자동 수집 (약 10~20분)
```

---

## 인터넷 서버에 올리기 (Railway — 무료)

1. https://github.com 계정 만들기
2. 이 폴더를 GitHub 저장소에 올리기
3. https://railway.app 접속 → GitHub으로 로그인
4. "New Project" → "Deploy from GitHub repo" → 저장소 선택
5. 자동 배포 완료! URL이 생성됩니다

> Railway 무료 플랜: 월 500시간 (약 21일) 무료

---

## 파일 구조

```
ayak/
├── server.js          ← 메인 서버 (Express API)
├── db/
│   ├── setup.js       ← 샘플 데이터 초기화
│   └── pill-genius.json      ← 데이터베이스 파일 (자동생성)
├── scripts/
│   └── sync-mfds.js   ← 식약처 API 동기화
├── public/
│   ├── index.html     ← 사용자 화면
│   └── admin.html     ← 백오피스
├── .env               ← API 키 설정 (직접 생성)
├── .env.example       ← 설정 예시
└── package.json
```

---

## API 엔드포인트 요약

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | /api/search?q=타이레놀 | 약 이름 검색 |
| POST | /api/interactions/check | 상호작용 체크 |
| GET | /api/drugs/:seq | 약 상세정보 |
| GET | /api/symptoms?symptom=두통 | 증상별 약 목록 |
| GET | /api/admin/stats | 관리자 통계 |
| GET | /api/admin/drugs | 의약품 목록 |
| POST | /api/admin/drugs | 의약품 추가 |
| GET | /api/admin/interactions | 상호작용 목록 |

---

## 주의사항

이 서비스는 의학적 진단이나 치료를 제공하지 않습니다.
반드시 의사 또는 약사와 상담하세요.
데이터 출처: 식품의약품안전처 공공데이터
