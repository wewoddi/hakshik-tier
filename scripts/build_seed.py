"""supabase/menus_*.txt 를 읽어 supabase/seed_menus.sql 을 만듭니다.  python scripts/build_seed.py"""
import glob
from collections import Counter

rows, rest, corner = [], None, None
for src in sorted(glob.glob("supabase/menus_*.txt")):
    for line in open(src, encoding="utf-8"):
        line = line.rstrip("\n")
        if not line or line.startswith("# "):
            continue
        if line.startswith("#"):
            rest, corner = line[1:].strip(), None
            continue
        if line.startswith("@"):
            corner = line[1:].strip()
            continue
        name, price = line.rsplit("|", 1)
        rows.append((rest, name.strip(), int(price) if price.strip() else None, corner))

def q(s):
    return "null" if s is None else "'" + s.replace("'", "''") + "'"

seen, vals = set(), []
for r, n, p, c in rows:
    if (r, n) in seen:
        continue
    seen.add((r, n))
    vals.append(f"  ({q(r)}, {q(n)}, {'null' if p is None else p}, {q(c)})")

body = ",\n".join(vals)
sql = (
    f"-- 서울대 생협 식단에서 모은 메뉴 {len(vals)}개\n"
    "-- schema.sql 실행 후 SQL Editor 에서 실행하세요. 여러 번 실행해도 중복되지 않습니다.\n"
    "insert into public.menus (restaurant_id, name, price, corner, created_by)\n"
    "select r.id, v.name, v.price, v.corner, null\n"
    f"from (values\n{body}\n) as v(restaurant, name, price, corner)\n"
    "join public.restaurants r on r.name = v.restaurant\n"
    "on conflict (restaurant_id, name) do update\n"
    "  set price = coalesce(excluded.price, menus.price),\n"
    "      corner = coalesce(excluded.corner, menus.corner);\n"
)
open("supabase/seed_menus.sql", "w", encoding="utf-8").write(sql)
print(len(vals), dict(Counter(r for r, *_ in rows)))
