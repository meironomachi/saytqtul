// 화면 확인용 가짜 Supabase 클라이언트 (메모리에만 저장). 실제 사이트에서는 쓰지 않습니다.
const uid = "u1";
const rid = () => Math.random().toString(36).slice(2, 10);
const now = () => new Date().toISOString();

const db = {
  profiles: [{ id: uid, nickname: "메이로", email: "me@example.com", approved: true, created_at: "2026-10-01T00:00:00Z" },
    { id: "u2", nickname: "친구", email: "friend@example.com", approved: false, created_at: "2026-10-20T00:00:00Z" }],
  user_roles: [{ id: "r1", user_id: uid, role: "admin" }],
  labels: [
    { id: "happy", user_id: uid, kind: "mood", name: "행복", color: "#e8590c", created_at: "1" },
    { id: "calm", user_id: uid, kind: "mood", name: "평온", color: "#2b8a3e", created_at: "2" },
    { id: "tired", user_id: uid, kind: "mood", name: "피곤", color: "#5f3dc4", created_at: "3" },
    { id: "study", user_id: uid, kind: "activity", name: "공부", color: "#0031b0", created_at: "4" },
    { id: "sleep", user_id: uid, kind: "activity", name: "잠", color: "#868e96", created_at: "5" },
    { id: "walk", user_id: uid, kind: "activity", name: "산책", color: "#2f9e44", created_at: "6" },
  ],
  entries: [],
  comments: [],
};
const tt = (ranges) => { const t = {}; for (const [a, b, id] of ranges) for (let s = a; s <= b; s++) t[s] = id; return t; };
const days = [
  ["2026-10-03", "가을 산책", "공원을 한 바퀴 돌았다. 바람이 시원했다.", [["happy", 80], ["calm", 70]], "sunny", [[18, 29, "study"], [60, 65, "walk"]]],
  ["2026-10-08", "시험 공부", "도서관에서 하루 종일 공부했다.\n내일은 조금 쉬어야지.", [["tired", 75]], "cloudy", [[12, 47, "study"]]],
  ["2026-10-15", "비 오는 날", "창밖으로 비 내리는 소리를 들으며 책을 읽었다.", [["calm", 85]], "rainy", [[24, 35, "study"]]],
  ["2026-10-21", "친구와 저녁", "오랜만에 친구를 만나 맛있는 걸 먹었다.", [["happy", 92]], "sunny", [[72, 83, "walk"]]],
  ["2026-10-23", "", "오늘은 일기장을 새로 옮겼다. 생각보다 금방 끝났다.", [["happy", 70], ["tired", 40]], "windy", [[0, 5, "sleep"], [18, 35, "study"], [66, 71, "walk"]]],
];
for (const [d, title, content, moods, weather, ranges] of days) {
  db.entries.push({ id: `e-${d}`, user_id: uid, entry_date: d, title, content, moods: moods.map(([label_id, score]) => ({ label_id, score })),
    timetable: tt(ranges), photos: [], weather, created_at: `${d}T12:00:00Z`, updated_at: `${d}T12:00:00Z` });
}
// 사진이 있는 일기 (가짜 사진은 색 칠한 SVG)
db.entries.find((e) => e.entry_date === "2026-10-21").photos = [`${uid}/dinner.jpg`, `${uid}/street.jpg`];
db.entries.find((e) => e.entry_date === "2026-10-03").photos = [`${uid}/park.jpg`];
const fakePhoto = (path) => {
  const hue = [...path].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 3"><rect width="4" height="3" fill="hsl(${hue} 55% 60%)"/><circle cx="3" cy="1" r=".5" fill="hsl(${hue} 70% 85%)"/><path d="M0 3 1.5 1.4 2.6 2.4 3.2 1.9 4 3Z" fill="hsl(${hue} 45% 35%)"/></svg>`);
};
db.comments.push({ id: "c1", entry_id: "e-2026-10-21", user_id: uid, content: "다음에 또 가자!", created_at: "2026-10-21T22:10:00Z" });

class Query {
  constructor(table) { this.table = table; this.filters = []; this.op = "select"; this.one = null; this.sort = null; }
  select() { if (this.op === "select") this.op = "select"; this.returning = true; return this; }
  eq(k, v) { this.filters.push([k, v]); return this; }
  order(k, o = {}) { this.sort = [k, o.ascending !== false]; return this; }
  insert(row) { this.op = "insert"; this.row = row; return this; }
  update(patch) { this.op = "update"; this.patch = patch; return this; }
  delete() { this.op = "delete"; return this; }
  maybeSingle() { this.one = "maybe"; return this; }
  single() { this.one = "single"; return this; }
  run() {
    const rows = db[this.table];
    const match = (r) => this.filters.every(([k, v]) => String(r[k]) === String(v));
    let out;
    if (this.op === "insert") { const r = { id: rid(), user_id: uid, created_at: now(), updated_at: now(), ...this.row }; rows.push(r); out = [r]; }
    else if (this.op === "update") { out = rows.filter(match); out.forEach((r) => Object.assign(r, this.patch)); }
    else if (this.op === "delete") { out = rows.filter(match); db[this.table] = rows.filter((r) => !match(r)); }
    else {
      out = rows.filter(match);
      if (this.table === "entries" || this.table === "labels" || this.table === "comments") out = out.filter((r) => r.user_id === uid);
      if (this.sort) { const [k, asc] = this.sort; out = [...out].sort((a, b) => String(a[k]).localeCompare(String(b[k])) * (asc ? 1 : -1)); }
    }
    out = structuredClone(out);
    if (this.one) return { data: out[0] ?? null, error: this.one === "single" && !out[0] ? { message: "none" } : null };
    return { data: out, error: null };
  }
  then(res, rej) { return Promise.resolve(this.run()).then(res, rej); }
}

const session = { user: { id: uid, email: "me@example.com" } };
const signedIn = !location.hash.includes("/auth");
window.__DIARY_TEST_CLIENT__ = {
  from: (t) => new Query(t),
  rpc: async (name, args) => {
    if (name === "server_time") return { data: new Date().toISOString(), error: null }; const p = db.profiles.find((x) => x.id === args._user_id); if (p) p.approved = args._approved; return { error: null }; },
  auth: {
    getSession: async () => ({ data: { session: signedIn ? session : null } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signInWithPassword: async () => ({ error: { message: "test" } }),
    signUp: async () => ({ data: {}, error: null }),
    signOut: async () => ({ error: null }),
  },
  storage: { from: () => ({ upload: async () => ({ error: null }), remove: async () => ({ error: null }), createSignedUrls: async (paths) => ({ data: paths.map((path) => ({ path, signedUrl: fakePhoto(path) })) }) }) },
};
