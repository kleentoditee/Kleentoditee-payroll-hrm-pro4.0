import { prisma, Role, StaffAnnouncementAudience, UserStatus } from "@kleentoditee/db";
import { Hono } from "hono";
import { authRequired, requireRole, type AuthVariables } from "../middleware/auth.js";

const SELF = [Role.employee_tracker_user] as const;

async function getLinkedEmployeeId(
  c: { json: (b: { error: string }, n: number) => Response; get: (k: "userId") => string }
): Promise<string | Response> {
  const user = await prisma.user.findUnique({
    where: { id: c.get("userId") },
    select: { employeeId: true, status: true }
  });
  if (!user?.employeeId) {
    return c.json(
      { error: "This account is not linked to an employee. Ask your administrator to connect your profile." },
      403
    );
  }
  if (user.status !== UserStatus.active) {
    return c.json({ error: "Account is not active" }, 403);
  }
  return user.employeeId;
}

function parseYmd(ymd: string | undefined): Date | null {
  const s = (ymd ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return null;
  }
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function addUtcDays(d: Date, n: number): Date {
  const x = new Date(d.getTime());
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

function mapWorkAssignment(r: {
  id: string;
  date: Date;
  startTime: string | null;
  endTime: string | null;
  locationName: string;
  locationAddress: string | null;
  notes: string | null;
  status: string;
}) {
  return {
    id: r.id,
    date: r.date.toISOString().slice(0, 10),
    startTime: r.startTime,
    endTime: r.endTime,
    locationName: r.locationName,
    locationAddress: r.locationAddress,
    notes: r.notes,
    status: r.status
  };
}

export const staffRoutes = new Hono<{ Variables: AuthVariables }>()
  .get("/self/schedule", authRequired, requireRole(...SELF), async (c) => {
    const eid = await getLinkedEmployeeId(c);
    if (eid instanceof Response) {
      return eid;
    }
    const fromQ = c.req.query("from");
    const toQ = c.req.query("to");
    if (!fromQ || !toQ) {
      return c.json({ error: "from and to query params are required (YYYY-MM-DD)" }, 400);
    }
    const from = parseYmd(fromQ);
    const to = parseYmd(toQ);
    if (!from || !to || from > to) {
      return c.json({ error: "Invalid from/to date range" }, 400);
    }
    const toEnd = addUtcDays(to, 1);
    const items = await prisma.workAssignment.findMany({
      where: {
        employeeId: eid,
        date: { gte: from, lt: toEnd }
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }]
    });
    return c.json({ items: items.map(mapWorkAssignment) });
  })
  .get("/self/schedule/today", authRequired, requireRole(...SELF), async (c) => {
    const eid = await getLinkedEmployeeId(c);
    if (eid instanceof Response) {
      return eid;
    }
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const end = addUtcDays(start, 1);
    const items = await prisma.workAssignment.findMany({
      where: { employeeId: eid, date: { gte: start, lt: end } },
      orderBy: [{ startTime: "asc" }]
    });
    return c.json({ date: start.toISOString().slice(0, 10), items: items.map(mapWorkAssignment) });
  })
  .get("/self/announcements", authRequired, requireRole(...SELF), async (c) => {
    const eid = await getLinkedEmployeeId(c);
    if (eid instanceof Response) {
      return eid;
    }
    void eid;
    const now = new Date();
    const items = await prisma.staffAnnouncement.findMany({
      where: {
        active: true,
        audience: { in: [StaffAnnouncementAudience.ALL, StaffAnnouncementAudience.EMPLOYEES] },
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] }
        ]
      },
      orderBy: { createdAt: "desc" },
      take: 100
    });
    return c.json({
      items: items.map((a) => ({
        id: a.id,
        title: a.title,
        body: a.body,
        category: a.category,
        createdAt: a.createdAt
      }))
    });
  })
  .get("/self/quiz/daily", authRequired, requireRole(...SELF), async (c) => {
    const eid = await getLinkedEmployeeId(c);
    if (eid instanceof Response) {
      return eid;
    }
    void eid;
    const questions = await prisma.staffQuizQuestion.findMany({
      where: { active: true },
      orderBy: { createdAt: "asc" }
    });
    if (questions.length === 0) {
      return c.json({ question: null });
    }
    const day = Math.floor(Date.now() / 86_400_000);
    const q = questions[day % questions.length]!;
    const choices = q.choices;
    if (!Array.isArray(choices) || choices.length < 2) {
      return c.json({ error: "Quiz misconfigured" }, 500);
    }
    return c.json({
      question: {
        id: q.id,
        question: q.question,
        choices: choices.map((x) => String(x))
      }
    });
  })
  .post("/self/quiz/attempt", authRequired, requireRole(...SELF), async (c) => {
    const eid = await getLinkedEmployeeId(c);
    if (eid instanceof Response) {
      return eid;
    }
    const body = await c.req.json<Record<string, unknown>>();
    const questionId = String(body.questionId ?? "");
    const selectedIndex = Number(body.selectedIndex);
    if (!questionId) {
      return c.json({ error: "questionId is required" }, 400);
    }
    if (!Number.isInteger(selectedIndex) || selectedIndex < 0) {
      return c.json({ error: "selectedIndex is required" }, 400);
    }
    const q = await prisma.staffQuizQuestion.findFirst({ where: { id: questionId, active: true } });
    if (!q) {
      return c.json({ error: "Question not found" }, 404);
    }
    const choices = q.choices;
    if (!Array.isArray(choices) || selectedIndex >= choices.length) {
      return c.json({ error: "Invalid selection" }, 400);
    }
    const start = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
    const end = addUtcDays(start, 1);
    const already = await prisma.staffQuizAttempt.findFirst({
      where: {
        employeeId: eid,
        questionId: q.id,
        createdAt: { gte: start, lt: end }
      }
    });
    if (already) {
      return c.json(
        { error: "You already answered this question today", correct: already.correct, pointsAwarded: 0 },
        409
      );
    }
    const correct = selectedIndex === q.correctIndex;
    const pointsAwarded = correct ? 10 : 0;
    await prisma.$transaction(async (tx) => {
      await tx.staffQuizAttempt.create({
        data: {
          employeeId: eid,
          questionId: q.id,
          selectedIndex,
          correct,
          pointsAwarded
        }
      });
      if (correct && pointsAwarded > 0) {
        await tx.rewardLedger.create({
          data: {
            employeeId: eid,
            points: pointsAwarded,
            reason: "Daily quiz (correct answer)"
          }
        });
      }
    });
    return c.json({ correct, pointsAwarded, explanation: correct ? q.explanation : null });
  })
  .get("/self/rewards/summary", authRequired, requireRole(...SELF), async (c) => {
    const eid = await getLinkedEmployeeId(c);
    if (eid instanceof Response) {
      return eid;
    }
    const rows = await prisma.rewardLedger.aggregate({
      where: { employeeId: eid },
      _sum: { points: true }
    });
    return c.json({ totalPoints: rows._sum.points ?? 0 });
  });
