"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase, supabaseConfigured } from "@/lib/supabase";
import type { MenuStat, Restaurant } from "@/lib/tiers";
import TierBoard from "./TierBoard";
import MenuDetail from "./MenuDetail";
import LoginModal from "./LoginModal";

const ALL = -1;

export default function App() {
  if (!supabaseConfigured) return <SetupNotice />;
  return <Main />;
}

function Main() {
  const supabase = getSupabase();
  const [session, setSession] = useState<Session | null>(null);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [stats, setStats] = useState<MenuStat[]>([]);
  const [myVotes, setMyVotes] = useState<Record<number, number>>({});
  const [selected, setSelected] = useState<number>(ALL);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userId = session?.user.id ?? null;

  // 로그인 상태
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthChecked(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  const loadStats = useCallback(async () => {
    // Supabase는 한 번에 최대 1000줄까지만 주므로 나눠서 불러옴
    const all: MenuStat[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from("menu_stats")
        .select("*")
        .order("menu_id")
        .range(from, from + 999);
      if (error) return setError("메뉴를 불러오지 못했어요: " + error.message);
      all.push(...(data ?? []).map((r) => ({ ...r, avg_score: r.avg_score === null ? null : Number(r.avg_score) })));
      if (!data || data.length < 1000) break;
    }
    setStats(all);
  }, [supabase]);

  const loadMyVotes = useCallback(async () => {
    if (!userId) return setMyVotes({});
    const { data } = await supabase.from("votes").select("menu_id, score").eq("user_id", userId);
    const map: Record<number, number> = {};
    (data ?? []).forEach((v) => (map[v.menu_id] = v.score));
    setMyVotes(map);
  }, [supabase, userId]);

  // 로그인 후에만 데이터를 불러옴
  useEffect(() => {
    if (!userId) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.from("restaurants").select("*").order("sort_order");
      if (error) setError("식당 목록을 불러오지 못했어요: " + error.message);
      setRestaurants(data ?? []);
      await loadStats();
      setLoading(false);
    })();
  }, [supabase, loadStats, userId]);

  useEffect(() => {
    loadMyVotes();
  }, [loadMyVotes]);

  const refresh = useCallback(async () => {
    await Promise.all([loadStats(), loadMyVotes()]);
  }, [loadStats, loadMyVotes]);

  const restaurantName = useMemo(() => {
    const m: Record<number, string> = {};
    restaurants.forEach((r) => (m[r.id] = r.name));
    return m;
  }, [restaurants]);

  const visible = selected === ALL ? stats : stats.filter((s) => s.restaurant_id === selected);
  const detail = stats.find((s) => s.menu_id === detailId) ?? null;

  if (!authChecked) {
    return (
      <div className="wrap">
        <p className="muted center">불러오는 중…</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="wrap">
        <header className="top">
          <div>
            <h1>🍚 학식 티어리스트</h1>
            <p className="sub">서울대생이 직접 매기는 학식 메뉴 순위</p>
          </div>
        </header>
        <div className="center">
          <p className="muted">서울대 메일(@snu.ac.kr)로 로그인하면 티어리스트를 볼 수 있어요.</p>
          <button className="primary" onClick={() => setLoginOpen(true)}>서울대 메일로 로그인</button>
        </div>
        {loginOpen && <LoginModal onClose={() => setLoginOpen(false)} />}
      </div>
    );
  }

  return (
    <div className="wrap">
      <header className="top">
        <div>
          <h1>🍚 학식 티어리스트</h1>
          <p className="sub">서울대생이 직접 매기는 학식 메뉴 순위</p>
        </div>
        <div className="me">
          <span className="email">{session.user.email}</span>
          <button className="ghost" onClick={() => supabase.auth.signOut()}>로그아웃</button>
        </div>
      </header>

      <nav className="tabs" aria-label="식당 선택">
        <button className={selected === ALL ? "tab on" : "tab"} onClick={() => setSelected(ALL)}>전체</button>
        {restaurants.map((r) => (
          <button key={r.id} className={selected === r.id ? "tab on" : "tab"} onClick={() => setSelected(r.id)}>
            {r.name}
          </button>
        ))}
      </nav>

      {error && <div className="alert">{error}</div>}

      {loading ? (
        <p className="muted center">불러오는 중…</p>
      ) : (
        <TierBoard
          stats={visible}
          myVotes={myVotes}
          showRestaurant={selected === ALL}
          restaurantName={restaurantName}
          onOpen={setDetailId}
        />
      )}

      <footer className="foot">
        평균 점수로 티어가 정해져요 (S=5 · A=4 · B=3 · C=2 · D=1 · F=0). 한 사람당 메뉴별 한 표, 다시 누르면 바뀌어요.
      </footer>

      {detail && (
        <MenuDetail
          stat={detail}
          restaurantName={restaurantName[detail.restaurant_id]}
          userId={userId}
          myVote={myVotes[detail.menu_id]}
          onClose={() => setDetailId(null)}
          onNeedLogin={() => setLoginOpen(true)}
          onChanged={refresh}
        />
      )}

      {loginOpen && <LoginModal onClose={() => setLoginOpen(false)} />}
    </div>
  );
}

function SetupNotice() {
  return (
    <div className="wrap">
      <h1>🍚 학식 티어리스트</h1>
      <div className="alert">
        Supabase 환경변수가 없어요. <code>env.example</code>을 <code>.env.local</code>로 복사하고
        URL과 anon key를 넣은 뒤 다시 실행하세요. (배포할 때는 Vercel 환경변수에 넣기)
      </div>
    </div>
  );
}
