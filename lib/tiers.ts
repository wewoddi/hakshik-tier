export const TIERS = [
  { key: "S", score: 5, color: "#ff6b6b" },
  { key: "A", score: 4, color: "#ffa94d" },
  { key: "B", score: 3, color: "#ffd43b" },
  { key: "C", score: 2, color: "#8ce99a" },
  { key: "D", score: 1, color: "#74c0fc" },
  { key: "F", score: 0, color: "#b197fc" },
] as const;

export type TierKey = (typeof TIERS)[number]["key"];

export function tierFromAvg(avg: number | null): TierKey | null {
  if (avg === null || Number.isNaN(avg)) return null;
  if (avg >= 4.5) return "S";
  if (avg >= 3.5) return "A";
  if (avg >= 2.5) return "B";
  if (avg >= 1.5) return "C";
  if (avg >= 0.5) return "D";
  return "F";
}

export function tierOfScore(score: number): TierKey {
  return TIERS.find((t) => t.score === score)?.key ?? "F";
}

export function isSnuEmail(email: string) {
  return /^[^\s@]+@snu\.ac\.kr$/i.test(email.trim());
}

/** 리뷰 작성자를 익명으로 표시하기 위한 짧은 별칭 */
export function anonName(userId: string) {
  let h = 0;
  for (const c of userId) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const animals = ["학관 고양이", "관악산 다람쥐", "자하연 오리", "버들골 고양이", "정문 비둘기", "도서관 부엉이", "공대 너구리", "인문대 참새"];
  return `${animals[h % animals.length]} #${(h % 9000) + 1000}`;
}

export type MenuStat = {
  menu_id: number;
  restaurant_id: number;
  name: string;
  price: number | null;
  corner: string | null;
  created_at: string;
  vote_count: number;
  avg_score: number | null;
  s_count: number; a_count: number; b_count: number;
  c_count: number; d_count: number; f_count: number;
  review_count: number;
};

export type Restaurant = { id: number; name: string; location: string | null; sort_order: number };

export type Review = {
  id: number; menu_id: number; user_id: string; body: string;
  created_at: string; updated_at: string;
};
