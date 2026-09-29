# 🍚 학식 티어리스트

서울대생이 서울대 메일(@snu.ac.kr)로 인증한 뒤 학식 메뉴에 S~F 티어를 투표하고 리뷰를 남기는 웹앱입니다.

- **화면**: Next.js (이 폴더)
- **로그인·DB**: Supabase (메일 로그인 링크 발송 + 데이터 저장)
- **배포**: Vercel (무료)

## 기능

- **로그인해야 티어리스트가 보임** — 로그인 전엔 로그인 화면만 나옴
- 메뉴 검색(자동완성 드롭다운 포함), 식당별 탭과 전체 탭, 평균 점수로 자동 정렬되는 S/A/B/C/D/F 티어표
- 메뉴를 누르면 티어 분포, 내 투표(한 사람당 1표, 다시 누르면 취소), 익명 리뷰(한 사람당 1개, 수정·삭제 가능)
- 메뉴 목록은 생협 식단 기준으로 미리 채워져 있고, 사용자가 새 메뉴를 직접 추가하는 기능은 없음(`scripts/sync-menus.mjs`가 자동으로 채움)
- 서울대 메일 제한을 **세 군데서** 적용: 화면 입력 검사, 가입 거부 트리거, DB 보안 규칙(RLS)

---

## 배포 가이드 (처음 한 번, 약 30분)

### 1단계 — Supabase 프로젝트 만들기

1. https://supabase.com 에 가입하고 **New project**를 누릅니다.
   - Region은 **Northeast Asia (Seoul)** 를 고르세요.
   - DB 비밀번호는 아무거나 정하고 따로 적어 두세요 (앱에는 필요 없음).
2. 프로젝트가 만들어지면 왼쪽 메뉴 **SQL Editor**를 엽니다. `supabase/schema.sql` 내용을 **전부** 붙여넣고 **Run**을 누릅니다.
   - "Success"가 나오면 테이블, 보안 규칙, 생협 식당 14곳이 생성된 것입니다.
3. 새 쿼리 창에서 `supabase/seed_menus.sql` 내용을 붙여넣고 **Run** 합니다.
   - 2026년 8월 3일~10월 2일 생협 식단에서 모은 메뉴 **911개**가 가격·코너와 함께 들어갑니다.
   - 302동 뷔페, 두레미담 셀프코너처럼 반찬이 매일 바뀌는 곳은 반찬 대신 "뷔페" 자체를 하나의 메뉴로 넣었어요.
   - 식당·메뉴 이름은 **Table Editor**에서 바로 고칠 수 있어요.

### 2단계 — 로그인 주소(Redirect URL) 등록

로그인은 메일로 온 링크를 누르면 바로 되는 방식이라 이메일 템플릿은 고칠 필요가 없어요(기본 템플릿이 이미 링크 방식). 대신 링크를 눌렀을 때 어느 주소로 돌아올지 등록해야 해요.

**Authentication → URL Configuration** 에서:

- **Site URL**: `http://localhost:3000` (배포 후엔 Vercel 주소로 바꾸기)
- **Redirect URLs**: **Add URL**로 `http://localhost:3000/**` 추가 (배포 후엔 Vercel 주소도 `https://내주소.vercel.app/**` 형태로 하나 더 추가)

> ⚠️ Supabase 기본(무료) 메일 서버는 **시간당 몇 통만** 보낼 수 있어요. 테스트 중에 "요청이 너무 잦아요" 오류가 뜨면 이 한도에 걸린 거예요. 잠시 기다리거나, 아래 [메일 발송 서비스 연결](#운영할-때-꼭-할-것-메일-발송-서비스-연결)을 먼저 해두면 훨씬 여유롭게 테스트할 수 있어요.

### 3단계 — 키 복사

**Project Settings → API (또는 API Keys)** 에서 두 값을 복사해 둡니다.

- **Project URL**: `https://xxxx.supabase.co`
- **anon public key** (새 화면에서는 **Publishable key**, `sb_publishable_...`): 둘 중 어느 것이든 됩니다.

⚠️ `service_role` / `secret` 키는 절대 쓰지 마세요.

### 4단계 — 내 컴퓨터에서 실행해 보기 (선택)

Node.js 20 이상이 필요합니다 (https://nodejs.org).

```bash
npm install
cp env.example .env.local   # Windows는 copy env.example .env.local
# .env.local 을 열어 3단계에서 복사한 두 값을 넣기
npm run dev
```

브라우저에서 http://localhost:3000 을 열고 서울대 메일로 로그인해 보세요.

### 5단계 — GitHub에 올리기

1. https://github.com 에서 새 저장소(예: `hakshik-tier`)를 만듭니다.
2. 이 폴더에서:

```bash
git init
git add .
git commit -m "학식 티어리스트 첫 버전"
git branch -M main
git remote add origin https://github.com/<내아이디>/hakshik-tier.git
git push -u origin main
```

(`.env.local`은 `.gitignore`에 들어 있어서 올라가지 않아요.)

### 6단계 — Vercel로 배포

1. https://vercel.com 에 GitHub 계정으로 가입합니다.
2. **Add New → Project**에서 방금 만든 저장소를 **Import**합니다.
3. **Environment Variables**에 두 개를 추가합니다.
   - `NEXT_PUBLIC_SUPABASE_URL` = Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = anon(또는 publishable) key
4. **Deploy**를 누르면 1~2분 뒤 `https://hakshik-tier-xxx.vercel.app` 주소가 생깁니다.
5. Supabase **Authentication → URL Configuration → Site URL** 에 이 주소를 넣어 둡니다.

이제 이 링크를 에브리타임 등에 올리면 서울대생 누구나 쓸 수 있어요. 이후 GitHub에 push하면 자동으로 다시 배포됩니다.

---

## 새 메뉴 자동 추가 (생협 식단 동기화)

학식 메뉴는 돌아가면서 나오기 때문에, 처음 넣은 911개 말고도 새 메뉴가 계속 생겨요. `scripts/sync-menus.mjs`가 생협 식단 페이지를 읽어서 **없던 메뉴만** 추가합니다. 이미 있는 메뉴와 투표·리뷰는 건드리지 않아요.

**자동으로 (추천)**: GitHub 저장소 **Settings → Secrets and variables → Actions**에 두 개를 등록하세요.
- `SUPABASE_URL` = Project URL
- `SUPABASE_SERVICE_ROLE_KEY` = Supabase **Project Settings → API**의 `service_role` 키 (또는 새 화면의 **Secret key**)

> 📁 처음 한 번: 폴더에 있는 `sync-menus.yml.txt`를 `.github/workflows/sync-menus.yml`로 옮기세요. (Claude Code에 "sync-menus.yml.txt를 GitHub Actions 폴더로 옮겨줘"라고 해도 돼요.)

그러면 `.github/workflows/sync-menus.yml`이 매일 아침 7시에 앞으로 7일치 식단을 확인해요. **Actions** 탭에서 "학식 메뉴 동기화"를 골라 **Run workflow**로 바로 실행할 수도 있어요.

**직접 실행**:
```bash
# 어떤 메뉴가 잡히는지 확인만 (DB에 안 씀)
node scripts/sync-menus.mjs 2026-09-01 2026-09-30 --dry-run
# 실제로 추가 (Windows PowerShell은 $env:SUPABASE_URL="..." 형식으로 설정)
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/sync-menus.mjs 2026-09-01 2026-09-30
```

⚠️ `service_role`/Secret 키는 모든 보안 규칙을 무시하는 관리자 키예요. Vercel 환경변수나 코드에 넣지 말고 **GitHub Secrets에만** 넣으세요.
⚠️ 생협 사이트 구조가 바뀌면 동기화가 멈출 수 있어요. 그땐 `scripts/parse-menus.mjs`를 고치면 됩니다.

## 운영할 때 꼭 할 것: 메일 발송 서비스 연결

Supabase 기본 메일 서버는 **시간당 발송량이 아주 적고** 테스트용이에요. 사람이 몰리면 "요청이 너무 잦아요"라는 오류가 납니다.

1. https://resend.com 에 가입하고 API Key를 발급받습니다. (도메인이 있다면 도메인을 인증하면 스팸함에 덜 들어가요.)
2. Supabase **Authentication → Emails → SMTP Settings**에서 **Enable custom SMTP**를 켜고 아래 값을 넣습니다.
   - Host `smtp.resend.com`, Port `465`, Username `resend`, Password = Resend API Key
   - Sender email: Resend에서 인증한 주소
3. **Authentication → Rate Limits**에서 시간당 메일 발송 한도를 적당히 올립니다.

> 무료 요금제 한도는 서비스마다 바뀔 수 있으니 가입할 때 확인하세요.

## 자주 묻는 것

- **메일이 안 와요**: 서울대 메일 스팸함을 먼저 확인하세요. 계속 안 오면 위의 SMTP 연결을 하세요.
- **gmail로 가입을 시도하면?** 화면에서 막히고, 우회해도 DB 트리거가 가입을 거부합니다.
- **관리자가 메뉴·리뷰를 지우려면?** Supabase **Table Editor**에서 해당 줄을 삭제하면 됩니다.
- **티어 기준**: 평균 4.5 이상 S, 3.5 이상 A, 2.5 이상 B, 1.5 이상 C, 0.5 이상 D, 그 아래 F. `lib/tiers.ts`의 `tierFromAvg`에서 바꿀 수 있어요.

## 폴더 구조

```
app/            layout, 페이지, 전체 스타일(globals.css)
components/     App(메인), TierBoard(티어표), MenuDetail(투표·리뷰), LoginModal(메일 인증)
lib/            supabase 클라이언트, 티어 계산·타입
supabase/       schema.sql (테이블·보안 규칙·식당), seed_menus.sql (메뉴 911개), menus_*.txt (seed 원본)
scripts/        sync-menus.mjs (생협 식단 동기화), parse-menus.mjs (식단 페이지 해석), build_seed.py (txt → seed SQL)
.github/        매일 메뉴 동기화 GitHub Actions
```
