# 학식 티어리스트 — Claude Code 작업 메모

서울대 학식 메뉴 티어리스트 웹앱. 사용자는 한국어로 소통함.

## 스택
- Next.js 16 (App Router) + React 19 + TypeScript, 스타일은 `app/globals.css` 하나(프레임워크 없음)
- Supabase: 이메일 매직링크 로그인(`signInWithOtp` + `emailRedirectTo`, 세션은 리다이렉트 URL에서 자동 감지·`detectSessionInUrl`), Postgres + RLS
- 클라이언트 전용 구조: 모든 데이터 접근은 브라우저에서 anon key로 하고, 권한은 RLS가 강제함. 서버 라우트 없음.
- 배포: Vercel. 환경변수 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 데이터 모델 (`supabase/schema.sql`)
- `restaurants`, `menus`, `votes`(menu_id+user_id PK, score 0~5 = F~S), `reviews`(menu_id+user_id unique, 300자)
- `menu_stats` 뷰(security_invoker): 메뉴별 투표 수, 평균, 티어별 개수, 리뷰 수
- `public.is_snu()`: JWT 이메일이 @snu.ac.kr인지 확인 → 모든 쓰기 RLS에 사용
- `auth.users` BEFORE INSERT 트리거 `enforce_snu_email`: 서울대 메일이 아니면 가입 거부
- 스키마는 재실행해도 안전하게(idempotent) 유지할 것

## 메뉴 데이터
- `supabase/menus_*.txt` (사람이 읽는 원본) → `python scripts/build_seed.py` → `supabase/seed_menus.sql`
- `scripts/sync-menus.mjs`: snuco.snu.ac.kr/foodmenu?date=YYYY-MM-DD 를 읽어 새 메뉴만 upsert(ignore-duplicates). service_role 키 필요, GitHub Actions에서 매일 실행
- 파서는 `scripts/parse-menus.mjs`. 가격 있는 줄은 그대로 메뉴로, `<셀프코너> 7,000원`처럼 코너 전체가 정액인 경우엔 반찬 이름을 가격 null로 등록(뷔페형 코너 보강). `--dry-run`으로 확인 가능

## 규칙
- 서울대 메일 제한은 화면·트리거·RLS 세 곳에서 모두 유지할 것
- 리뷰는 익명 표시(`anonName(user_id)`). 이메일을 다른 사용자에게 노출하지 말 것
- 변경 후 `npm run build`로 타입·빌드 확인

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
