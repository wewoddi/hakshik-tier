"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { TIERS, anonName, tierFromAvg, type MenuStat, type Review } from "@/lib/tiers";

type Props = {
  stat: MenuStat;
  restaurantName: string;
  userId: string | null;
  myVote: number | undefined;
  onClose: () => void;
  onNeedLogin: () => void;
  onChanged: () => Promise<void> | void;
};

export default function MenuDetail({ stat, restaurantName, userId, myVote, onClose, onNeedLogin, onChanged }: Props) {
  const supabase = getSupabase();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const myReview = userId ? reviews.find((r) => r.user_id === userId) : undefined;

  const loadReviews = useCallback(async () => {
    const { data } = await supabase
      .from("reviews")
      .select("*")
      .eq("menu_id", stat.menu_id)
      .order("created_at", { ascending: false })
      .limit(200);
    setReviews(data ?? []);
  }, [supabase, stat.menu_id]);

  useEffect(() => { loadReviews(); }, [loadReviews]);
  useEffect(() => { setDraft(myReview?.body ?? ""); }, [myReview?.body]);

  // ESC로 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function vote(score: number) {
    if (!userId) return onNeedLogin();
    setBusy(true);
    setMsg(null);
    const { error } =
      myVote === score
        ? await supabase.from("votes").delete().eq("menu_id", stat.menu_id).eq("user_id", userId)
        : await supabase.from("votes").upsert(
            { menu_id: stat.menu_id, user_id: userId, score, updated_at: new Date().toISOString() },
            { onConflict: "menu_id,user_id" },
          );
    if (error) setMsg("투표하지 못했어요: " + error.message);
    await onChanged();
    setBusy(false);
  }

  async function saveReview(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return onNeedLogin();
    const body = draft.trim();
    if (!body) return;
    setBusy(true);
    setMsg(null);
    const { error } = myReview
      ? await supabase.from("reviews").update({ body, updated_at: new Date().toISOString() }).eq("id", myReview.id)
      : await supabase.from("reviews").insert({ menu_id: stat.menu_id, user_id: userId, body });
    if (error) setMsg("리뷰를 저장하지 못했어요: " + error.message);
    await loadReviews();
    await onChanged();
    setBusy(false);
  }

  async function deleteReview() {
    if (!myReview) return;
    setBusy(true);
    await supabase.from("reviews").delete().eq("id", myReview.id);
    setDraft("");
    await loadReviews();
    await onChanged();
    setBusy(false);
  }

  const counts = [stat.s_count, stat.a_count, stat.b_count, stat.c_count, stat.d_count, stat.f_count];
  const maxCount = Math.max(1, ...counts);
  const tier = tierFromAvg(stat.avg_score);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={onClose} aria-label="닫기">×</button>
        <p className="muted small">
          {restaurantName}
          {stat.corner && ` · ${stat.corner}`}
          {stat.price && ` · ${stat.price.toLocaleString()}원`}
        </p>
        <h2>
          {stat.name}{" "}
          {tier && (
            <span className="badge" style={{ background: TIERS.find((t) => t.key === tier)?.color }}>{tier}</span>
          )}
        </h2>
        <p className="muted">
          {stat.vote_count > 0 ? `평균 ${stat.avg_score?.toFixed(2)}점 · ${stat.vote_count}명 투표` : "아직 투표가 없어요"}
        </p>

        <div className="dist">
          {TIERS.map((t, i) => (
            <div className="dist-row" key={t.key}>
              <span className="dist-k">{t.key}</span>
              <span className="dist-bar"><span style={{ width: `${(counts[i] / maxCount) * 100}%`, background: t.color }} /></span>
              <span className="dist-n">{counts[i]}</span>
            </div>
          ))}
        </div>

        <h3>내 평가</h3>
        <div className="vote">
          {TIERS.map((t) => (
            <button
              key={t.key}
              disabled={busy}
              className={myVote === t.score ? "vote-btn on" : "vote-btn"}
              style={{ borderColor: t.color, background: myVote === t.score ? t.color : undefined }}
              onClick={() => vote(t.score)}
            >
              {t.key}
            </button>
          ))}
        </div>
        {!userId && <p className="muted small">투표와 리뷰는 서울대 메일 인증 후 할 수 있어요.</p>}

        <h3>리뷰 {reviews.length > 0 && <span className="muted">({reviews.length})</span>}</h3>
        <form className="review-form" onSubmit={saveReview}>
          <textarea
            value={draft}
            maxLength={300}
            rows={3}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={() => !userId && onNeedLogin()}
            placeholder={userId ? "한 줄 평을 남겨 주세요 (최대 300자)" : "로그인하면 리뷰를 쓸 수 있어요"}
          />
          <div className="review-actions">
            <span className="muted small">{draft.length}/300 · 익명으로 표시돼요</span>
            {myReview && <button type="button" className="ghost" disabled={busy} onClick={deleteReview}>삭제</button>}
            <button className="primary" disabled={busy || !draft.trim()}>{myReview ? "수정" : "등록"}</button>
          </div>
        </form>
        {msg && <p className="err">{msg}</p>}

        <ul className="reviews">
          {reviews.map((r) => (
            <li key={r.id} className={r.user_id === userId ? "mine" : undefined}>
              <div className="rv-head">
                <strong>{r.user_id === userId ? "나" : anonName(r.user_id)}</strong>
                <span className="muted small">{new Date(r.created_at).toLocaleDateString("ko-KR")}</span>
              </div>
              <p>{r.body}</p>
            </li>
          ))}
          {reviews.length === 0 && <li className="muted">첫 리뷰를 남겨 보세요.</li>}
        </ul>
      </div>
    </div>
  );
}
