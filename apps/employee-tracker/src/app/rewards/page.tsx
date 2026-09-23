"use client";

import { apiBase, readApiJson } from "@/lib/api";
import { authHeaders, getToken } from "@/lib/auth-storage";
import { DAILY_QUIZZES, pickForDay } from "@/lib/staff-hub-data";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type DailyQuizApi = { id: string; question: string; choices: string[] };

export default function RewardsPage() {
  const router = useRouter();
  const localQuiz = useMemo(() => pickForDay(DAILY_QUIZZES, new Date()), []);
  const [ready, setReady] = useState(false);
  const [points, setPoints] = useState(0);
  const [question, setQuestion] = useState<DailyQuizApi | null>(null);
  const [choice, setChoice] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const base = apiBase();
    const h = { ...authHeaders() };
    const [qRes, rRes] = await Promise.all([
      fetch(`${base}/staff/self/quiz/daily`, { headers: h }),
      fetch(`${base}/staff/self/rewards/summary`, { headers: h })
    ]);
    const qJson = await readApiJson<{ question?: DailyQuizApi | null; error?: string }>(qRes);
    setQuestion(qRes.ok ? (qJson.data?.question ?? null) : null);
    const rJson = await readApiJson<{ totalPoints?: number; error?: string }>(rRes);
    setPoints(rRes.ok ? (rJson.data?.totalPoints ?? 0) : 0);
    if (!qRes.ok || !rRes.ok) {
      setError(qJson.data?.error ?? rJson.data?.error ?? "Could not load rewards.");
    }
  }, []);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    let cancelled = false;
    void load().finally(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [load, router]);

  async function answer(i: number) {
    setChoice(i);
    setFeedback(null);
    if (!question) {
      setFeedback(i === localQuiz.correctIndex ? localQuiz.praise : "Not quite. Try again tomorrow.");
      return;
    }
    const res = await fetch(`${apiBase()}/staff/self/quiz/attempt`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ questionId: question.id, selectedIndex: i })
    });
    const { data } = await readApiJson<{ correct?: boolean; explanation?: string | null; error?: string }>(res);
    if (!res.ok) {
      setFeedback(data?.error ?? "Could not submit answer.");
      return;
    }
    setFeedback(data?.correct ? (data.explanation ?? "Correct. Points added.") : "Not quite. Try again tomorrow.");
    await load();
  }

  if (!ready) {
    return <div className="mx-auto flex min-h-screen max-w-md items-center justify-center text-slate-500">Loading...</div>;
  }

  const prompt = question?.question ?? localQuiz.question;
  const options = question?.choices ?? localQuiz.options;

  return (
    <div className="mx-auto min-h-screen max-w-md px-4 py-6">
      <header className="mb-5 flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Staff Hub</p>
          <h1 className="text-xl font-semibold text-slate-900">Rewards</h1>
        </div>
        <Link href="/" className="rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-700">
          Home
        </Link>
      </header>

      <section className="mb-4 rounded-2xl bg-[#0f2f38] p-4 text-white">
        <p className="text-xs uppercase tracking-widest text-white/60">Points</p>
        <p className="mt-1 text-3xl font-bold">{points}</p>
      </section>

      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Daily quiz</p>
        <h2 className="mt-2 font-semibold text-slate-950">{prompt}</h2>
        <div className="mt-4 space-y-2">
          {options.map((opt, i) => (
            <button
              key={opt}
              type="button"
              disabled={choice !== null}
              onClick={() => void answer(i)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-left text-sm text-slate-800 disabled:opacity-70"
            >
              {opt}
            </button>
          ))}
        </div>
        {feedback ? <p className="mt-3 text-sm font-medium text-slate-800">{feedback}</p> : null}
      </section>
    </div>
  );
}
