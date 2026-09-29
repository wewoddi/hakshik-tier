"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { TIERS, tierFromAvg, tierOfScore, type MenuStat } from "@/lib/tiers";

type Props = {
  stats: MenuStat[];
  myVotes: Record<number, number>;
  showRestaurant: boolean;
  restaurantName: Record<number, string>;
  onOpen: (menuId: number) => void;
};

const UNRATED_PREVIEW = 24;
const SUGGEST_MAX = 8;

export default function TierBoard({ stats: allStats, myVotes, showRestaurant, restaurantName, onOpen }: Props) {
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const q = query.trim().replace(/\s+/g, "");
  const stats = q ? allStats.filter((s) => s.name.replace(/\s+/g, "").includes(q)) : allStats;

  // 검색어와 일치하는 메뉴를 앞에서부터 일치하는 순으로 최대 SUGGEST_MAX개 추천
  const suggestions = useMemo(() => {
    if (!q) return [];
    const starts: MenuStat[] = [];
    const includes: MenuStat[] = [];
    for (const s of allStats) {
      const n = s.name.replace(/\s+/g, "");
      if (n.startsWith(q)) starts.push(s);
      else if (n.includes(q)) includes.push(s);
      if (starts.length >= SUGGEST_MAX) break;
    }
    return [...starts, ...includes].slice(0, SUGGEST_MAX);
  }, [allStats, q]);

  useEffect(() => setHighlight(0), [query]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setSuggestOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function pick(s: MenuStat) {
    onOpen(s.menu_id);
    setQuery("");
    setSuggestOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!suggestOpen || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter" && highlight < suggestions.length) {
      e.preventDefault();
      pick(suggestions[highlight]);
    } else if (e.key === "Escape") {
      setSuggestOpen(false);
    }
  }
  const rows = TIERS.map((t) => ({
    ...t,
    items: stats
      .filter((s) => tierFromAvg(s.avg_score) === t.key)
      .sort((a, b) => (b.avg_score ?? 0) - (a.avg_score ?? 0) || b.vote_count - a.vote_count),
  }));
  const unrated = stats.filter((s) => s.vote_count === 0);

  if (allStats.length === 0) {
    return <p className="muted center">아직 등록된 메뉴가 없어요. 첫 메뉴를 추가해 보세요!</p>;
  }
  const unratedShown = showAll || q ? unrated : unrated.slice(0, UNRATED_PREVIEW);

  const chip = (s: MenuStat) => {
    const mine = myVotes[s.menu_id];
    return (
      <button key={s.menu_id} className="chip" onClick={() => onOpen(s.menu_id)}>
        <span className="chip-name">{s.name}</span>
        {showRestaurant && <span className="chip-rest">{restaurantName[s.restaurant_id]}</span>}
        <span className="chip-meta">
          {s.price ? `${s.price.toLocaleString()}원 · ` : ""}
          {s.vote_count > 0 ? `${s.avg_score?.toFixed(1)} · ${s.vote_count}표` : "투표 없음"}
          {s.review_count > 0 && ` · 💬${s.review_count}`}
        </span>
        {mine !== undefined && <span className="chip-mine">내 표 {tierOfScore(mine)}</span>}
      </button>
    );
  };

  return (
    <>
    <div className="search-box" ref={boxRef}>
      <input
        className="search"
        type="search"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setSuggestOpen(true); }}
        onFocus={() => query && setSuggestOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={`메뉴 검색 (${allStats.length}개)`}
        role="combobox"
        aria-expanded={suggestOpen && suggestions.length > 0}
        aria-autocomplete="list"
      />
      {suggestOpen && suggestions.length > 0 && (
        <ul className="suggest">
          {suggestions.map((s, i) => (
            <li key={s.menu_id}>
              <button
                type="button"
                className={i === highlight ? "suggest-item on" : "suggest-item"}
                onMouseEnter={() => setHighlight(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(s)}
              >
                <span className="suggest-name">{s.name}</span>
                <span className="suggest-meta">
                  {showRestaurant && restaurantName[s.restaurant_id]}
                  {s.price ? ` · ${s.price.toLocaleString()}원` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
    {q && stats.length === 0 && <p className="muted center">‘{query}’ 메뉴가 없어요.</p>}
    <section className="board">
      {rows.map((r) => (
        <div className="row" key={r.key}>
          <div className="label" style={{ background: r.color }}>{r.key}</div>
          <div className="items">{r.items.length ? r.items.map(chip) : <span className="empty">—</span>}</div>
        </div>
      ))}
      {unrated.length > 0 && (
        <div className="row">
          <div className="label unrated">?</div>
          <div className="items">
            {unratedShown.map(chip)}
            {unratedShown.length < unrated.length && (
              <button className="chip more" onClick={() => setShowAll(true)}>
                아직 투표 없는 메뉴 {unrated.length - unratedShown.length}개 더 보기
              </button>
            )}
          </div>
        </div>
      )}
    </section>
    </>
  );
}
