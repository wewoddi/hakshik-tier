"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { isSnuEmail } from "@/lib/tiers";

function friendlyError(message: string) {
  const m = message.toLowerCase();
  if (m.includes("database error") || m.includes("snu.ac.kr")) return "서울대 메일(@snu.ac.kr)만 가입할 수 있어요.";
  if (m.includes("rate limit") || m.includes("security purposes")) return "요청이 너무 잦아요. 잠시 후 다시 시도해 주세요.";
  return message;
}

export default function LoginModal({ onClose }: { onClose: () => void }) {
  const supabase = getSupabase();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function sendLink(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    // 아이디만 입력해도 되도록
    const full = email.includes("@") ? email.trim() : `${email.trim()}@snu.ac.kr`;
    if (!isSnuEmail(full)) return setError("서울대 메일(@snu.ac.kr)만 사용할 수 있어요.");
    setEmail(full);
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: full,
      options: { shouldCreateUser: true, emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (error) return setError(friendlyError(error.message));
    setSent(true);
    setCooldown(60);
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal narrow" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={onClose} aria-label="닫기">×</button>
        <h2>서울대 메일 인증</h2>

        {!sent ? (
          <form onSubmit={sendLink} className="login">
            <p className="muted">서울대 메일로 로그인 링크를 보내 드려요. 비밀번호는 필요 없어요.</p>
            <div className="email-input">
              <input
                autoFocus
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="mysnu 아이디"
              />
              {!email.includes("@") && <span className="suffix">@snu.ac.kr</span>}
            </div>
            <button className="primary block" disabled={busy || !email.trim()}>
              {busy ? "보내는 중…" : "로그인 링크 받기"}
            </button>
          </form>
        ) : (
          <div className="login">
            <p className="muted">
              <strong>{email}</strong>로 로그인 링크를 보냈어요. 메일함(스팸함도)에서 링크를 눌러 주세요.
              누르면 이 사이트로 바로 돌아와 로그인돼요.
            </p>
            <button type="button" className="ghost block" disabled={cooldown > 0 || busy} onClick={() => sendLink()}>
              {cooldown > 0 ? `다시 보내기 (${cooldown}초)` : "다시 보내기"}
            </button>
            <button type="button" className="link" onClick={() => { setSent(false); setEmail(""); }}>메일 주소 바꾸기</button>
          </div>
        )}
        {error && <p className="err">{error}</p>}
      </div>
    </div>
  );
}
