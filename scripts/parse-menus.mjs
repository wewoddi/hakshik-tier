// 서울대 생협 식단 페이지(snuco.snu.ac.kr/foodmenu) HTML → 메뉴 목록
// 의존성 없는 순수 함수라서 브라우저·Node 어디서든 동작합니다.

const SKIP_NAME =
  /^(공기밥|탄산음료|계란후라이|스팸|솥밥|곱빼기|콤비메뉴|사리|음료|밥|김치|포기김치|잡곡밥|그린샐러드|오늘의차|후식|맛김)|운영|혼잡|이벤트|아메리카노|문의|추가|음료|에이드/;

// 뷔페/셀프코너 하루치 구성에서 국물류·곁들이 반찬을 빼고 메인 요리만 고를 때 쓰는 규칙
const BUFFET_SOUP = /(국|탕|찌개|전골|스프|국밥|육개장)$/;
const BUFFET_SIDE_OR_DESSERT =
  /(무침|자반|피클|단무지|깍두기|김치|지$|웨하스|과자|마들렌|모닝빵|브레드|케이크|모찌|초코|팝콘|츄러스|요구르트|짜요짜요|잼|바게트|와플|겔)/;

function pickBuffetMain(items) {
  const rest = items.filter((x) => !BUFFET_SOUP.test(x) && !BUFFET_SIDE_OR_DESSERT.test(x));
  if (rest.length) return rest[0];
  return items.filter((x) => !BUFFET_SOUP.test(x))[0] ?? items[0];
}

const decode = (s) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

function cellText(html) {
  return decode(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li)>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  );
}

export function normalizeRestaurant(raw) {
  return raw.trim().replace(/^\*\s*/, "").replace(/\s*\([\d-]+\)\s*$/, "").trim();
}

export function normalizeName(name) {
  let n = name.replace(/\(#\)/g, "").replace(/\s+/g, " ").replace(/\s*&\s*/g, "&").trim();
  n = n
    .replace(/우삽겹/g, "우삼겹")
    .replace(/냉짤국수/g, "냉쌀국수")
    .replace(/^\[[^\]]*\]\s*/, "") // [미식회] 같은 이벤트 머리말 제거
    .replace(/\(채식변경가능\)/g, "")
    .replace(/\s*\((S|L|R)\)$/, "") // 사이즈 표기
    .replace(/\s*\+\s*/g, " + ")
    .trim();
  if (/^삼각김밥&/.test(n)) n = "삼각김밥 세트";
  return n;
}

/** @returns {{restaurant:string, name:string, price:number|null, corner:string|null, meal:string}[]} */
export function parseMenuPage(html) {
  const out = [];
  const table = html.match(/<table[\s\S]*?<\/table>/i);
  if (!table) return out;
  const rows = table[0].match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
  const meals = ["아침", "점심", "저녁"];
  for (const row of rows.slice(1)) {
    const cells = [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) => cellText(m[1]));
    if (cells.length < 4) continue;
    const restaurant = normalizeRestaurant(cells[0].replace(/\s+/g, " "));
    for (let i = 1; i <= 3; i++) {
      let corner = null;
      let buffetCorner = false; // <셀프코너> 7,000원 처럼 코너 전체가 정액인 경우
      let buffetPrice = null; // 그 정액 가격
      let buffetItems = []; // 그 코너에서 모은 반찬들(요일당 하나의 메뉴로 합침)
      const flushBuffet = () => {
        if (buffetCorner && buffetItems.length) {
          const name = normalizeName(pickBuffetMain(buffetItems));
          const price = buffetPrice !== null && buffetPrice >= 500 && buffetPrice <= 50000 ? buffetPrice : null;
          out.push({ restaurant, name, price, corner, meal: meals[i - 1] });
        }
        buffetItems = [];
      };
      for (let line of cells[i].split("\n")) {
        line = line.replace(/ /g, " ").trim();
        if (!line || line.startsWith("※")) continue;
        const header = line.match(/^<\s*([^>]+?)\s*>\s*(.*)$/);
        if (header) {
          flushBuffet(); // 이전 코너에서 모은 반찬들을 하나의 메뉴로 저장
          corner = header[1].replace(/\s+/g, " ").replace(/^\+/, "");
          line = header[2].trim();
          buffetCorner = !line || /^[\d,\s]+원$/.test(line);
          const priceMatch = line.match(/^([\d,]+)\s*원$/);
          buffetPrice = priceMatch ? Number(priceMatch[1].replace(/,/g, "")) : null;
          if (!line || /^[\d,\s]+원$/.test(line)) continue; // "<뷔페> 6,500원" 같은 머리말
        }
        if (line.includes("=")) continue; // 세트 구성 설명
        const m = line.match(/^(.+?)\s*:\s*([\d,]+)\s*원?/);
        if (!m) {
          // 뷔페/셀프코너 안에서 가격 없이 반찬 이름만 나온 줄은 그 코너의 하루치 세트 메뉴 구성요소
          if (!buffetCorner) continue;
          const name = normalizeName(line);
          if (!name || SKIP_NAME.test(name)) continue;
          buffetItems.push(name);
          continue;
        }
        const name = normalizeName(m[1]);
        if (!name || SKIP_NAME.test(name)) continue;
        const price = Number(m[2].replace(/,/g, ""));
        out.push({
          restaurant,
          name,
          price: price >= 500 && price <= 50000 ? price : null,
          corner: corner && !/^메 ?뉴$|^사 ?이 ?드$/.test(corner) ? corner : null,
          meal: meals[i - 1],
        });
      }
      flushBuffet(); // 셀 마지막 코너 처리
    }
  }
  return out;
}
