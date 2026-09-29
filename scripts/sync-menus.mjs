// 서울대 생협 식단을 읽어서 새로 나온 메뉴를 Supabase에 추가합니다.
// 이미 있는 메뉴(식당+이름이 같은 것)는 건드리지 않아서 투표·리뷰가 그대로 유지됩니다.
//
// 사용법 (Node 20 이상):
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/sync-menus.mjs            # 오늘~7일 뒤
//   ... node scripts/sync-menus.mjs 2026-09-01 2026-09-30                                # 기간 지정
//   ... node scripts/sync-menus.mjs --dry-run                                            # DB에 안 쓰고 출력만
//
// ⚠️ SERVICE_ROLE_KEY 는 관리자 키입니다. 절대 화면 코드나 GitHub에 올리지 말고
//    내 컴퓨터 환경변수나 GitHub Actions Secrets 에만 넣으세요.

import { parseMenuPage } from "./parse-menus.mjs";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const dates = args.filter((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));

const kst = (d) => new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
const today = new Date();
const from = dates[0] ?? kst(today);
const to = dates[1] ?? dates[0] ?? kst(new Date(today.getTime() + 7 * 86400 * 1000));

function* eachDate(a, b) {
  for (let d = new Date(a + "T00:00:00Z"); d <= new Date(b + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + 1)) {
    yield d.toISOString().slice(0, 10);
  }
}

const found = new Map(); // key: 식당|이름
for (const date of eachDate(from, to)) {
  const url = `https://snuco.snu.ac.kr/foodmenu/?date=${date}&orderby=DESC`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "hakshik-tier-sync (student project)" } });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const items = parseMenuPage(await res.text());
    for (const it of items) {
      const key = it.restaurant + "|" + it.name;
      if (!found.has(key)) found.set(key, it);
    }
    console.log(`${date}: ${items.length}줄`);
  } catch (e) {
    console.warn(`${date}: 실패 (${e.message})`);
  }
  await new Promise((r) => setTimeout(r, 400)); // 생협 서버에 부담 주지 않도록 천천히
}

const menus = [...found.values()];
console.log(`\n${from} ~ ${to}: 서로 다른 메뉴 ${menus.length}개`);

if (dryRun) {
  for (const m of menus) console.log(`${m.restaurant}\t${m.corner ?? ""}\t${m.name}\t${m.price ?? ""}`);
  process.exit(0);
}

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !KEY) {
  console.error("SUPABASE_URL 과 SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다. (--dry-run 은 없이도 됨)");
  process.exit(1);
}
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

// 식당 이름 → id (없는 식당은 새로 만듦)
const restRes = await fetch(`${SUPABASE_URL}/rest/v1/restaurants?select=id,name,sort_order`, { headers });
const restaurants = await restRes.json();
const restId = new Map(restaurants.map((r) => [r.name, r.id]));
let nextOrder = Math.max(0, ...restaurants.map((r) => r.sort_order)) + 1;
for (const name of new Set(menus.map((m) => m.restaurant))) {
  if (restId.has(name)) continue;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/restaurants`, {
    method: "POST",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify({ name, sort_order: nextOrder++ }),
  });
  const [row] = await r.json();
  restId.set(name, row.id);
  console.log(`새 식당 추가: ${name}`);
}

// 새 메뉴만 추가 (이미 있으면 무시)
const rows = menus.map((m) => ({
  restaurant_id: restId.get(m.restaurant),
  name: m.name,
  price: m.price,
  corner: m.corner,
  created_by: null,
}));
for (let i = 0; i < rows.length; i += 200) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/menus?on_conflict=restaurant_id,name`, {
    method: "POST",
    headers: { ...headers, Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify(rows.slice(i, i + 200)),
  });
  if (!r.ok) {
    console.error("저장 실패:", r.status, await r.text());
    process.exit(1);
  }
}
console.log("완료: 새 메뉴가 있으면 추가됐어요.");
