import { createServer } from "node:http";
import { mkdirSync, existsSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";

const root = fileURLToPath(new URL(".", import.meta.url));
const dataDir = join(root, "data");
mkdirSync(dataDir, { recursive: true });
const storePath = join(dataDir, "robur-index.json");
const day = (offset = 0) => new Date(Date.now() + offset * 86400000).toISOString();
const now = () => new Date().toISOString();

const emptyStore = () => ({
  customers: [],
  projects: [],
  keywords: [],
  rank_history: [],
  search_logs: [],
  seq: { customers: 1, projects: 1, keywords: 1, rank_history: 1, search_logs: 1 }
});
const store = existsSync(storePath) ? { ...emptyStore(), ...JSON.parse(readFileSync(storePath, "utf8")) } : emptyStore();
store.seq ||= emptyStore().seq;
const save = () => writeFileSync(storePath, JSON.stringify(store, null, 2), "utf8");
const id = table => store.seq[table]++;
const json = (res, status, data) => {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(data));
};
const body = req => new Promise((ok, fail) => {
  let data = "";
  req.on("data", c => data += c);
  req.on("end", () => { try { ok(data ? JSON.parse(data) : {}); } catch (e) { fail(e); } });
});
const like = (value, q) => String(value || "").toLowerCase().includes(String(q || "").toLowerCase());
const joinKeyword = k => ({
  ...k,
  projectName: store.projects.find(p => p.id === k.projectId)?.name || "",
  customerName: store.customers.find(c => c.id === k.customerId)?.companyName || ""
});
const seed = () => {
  if (store.customers.length) return;
  store.customers.push(
    { id: id("customers"), name: "김하늘", companyName: "로부르컴퍼니 테스트 고객 A", managerName: "김하늘", phone: "010-2345-6789", email: "sky@robur.kr", memo: "주간 보고 선호", status: "진행중", createdAt: now() },
    { id: id("customers"), name: "이도윤", companyName: "법률사무소 온", managerName: "이도윤", phone: "010-5281-1134", email: "hello@lawon.kr", memo: "상담 키워드 집중", status: "진행중", createdAt: now() },
    { id: id("customers"), name: "박서준", companyName: "프랜차이즈 브릭", managerName: "박서준", phone: "010-8821-4242", email: "seo@brick.kr", memo: "월간 리포트", status: "진행중", createdAt: now() }
  );
  store.projects.push(
    { id: id("projects"), customerId: 1, name: "A사 블로그 상위노출", serviceType: "BLOG", status: "진행중", startDate: "2026-05-01", endDate: "2026-09-30", manager: "정지채", description: "", createdAt: now() },
    { id: id("projects"), customerId: 2, name: "법률 상담 카페 바이럴", serviceType: "CAFE", status: "진행중", startDate: "2026-05-15", endDate: "2026-08-31", manager: "정지채", description: "", createdAt: now() },
    { id: id("projects"), customerId: 3, name: "브릭 파워링크 운영", serviceType: "POWERLINK", status: "진행중", startDate: "2026-06-01", endDate: "2026-12-31", manager: "박시우", description: "", createdAt: now() },
    { id: id("projects"), customerId: 3, name: "브릭 구글 SEO", serviceType: "GOOGLE_SEO", status: "진행중", startDate: "2026-06-01", endDate: "2026-12-31", manager: "박시우", description: "", createdAt: now() }
  );
  const samples = [
    [1, 1, "플라스틱 프로텍트", "https://blog.naver.com/robur/123", "NAVER_BLOG", "BLOG", 8],
    [1, 1, "블로그 상위노출", "https://blog.naver.com/robur/124", "NAVER_BLOG", "BLOG", 12],
    [1, 1, "창업 아이템", "https://blog.naver.com/robur/125", "NAVER_BLOG", "BLOG", null],
    [2, 2, "개인회생 상담", "https://cafe.naver.com/lawon/21", "NAVER_CAFE", "CAFE", 5],
    [3, 3, "프랜차이즈 창업", "https://brick.kr/start", "NAVER_POWERLINK", "POWERLINK", 3],
    [4, 3, "구글 SEO 업체", "https://brick.kr/seo", "GOOGLE", "GOOGLE_SEO", 14]
  ];
  for (const [projectId, customerId, keyword, targetUrl, searchEngine, serviceType, currentRank] of samples) {
    const kid = id("keywords");
    store.keywords.push({ id: kid, projectId, customerId, keyword, targetUrl, searchEngine, serviceType, device: "PC", region: "전국", targetRank: 10, currentRank, previousRank: currentRank ? currentRank + 2 : null, bestRank: currentRank, firstRank: currentRank, status: currentRank ? "NEW" : "NOT_FOUND", matchType: "EXACT", lastCheckedAt: day(), createdAt: now() });
    for (let d = -7; d <= 0; d++) store.rank_history.push({ id: id("rank_history"), keywordId: kid, rank: currentRank, previousRank: currentRank ? currentRank + 1 : null, changeAmount: currentRank ? 1 : null, status: currentRank ? "SAME" : "NOT_FOUND", found: currentRank ? 1 : 0, checkedAt: day(d) });
  }
  save();
};
seed();

const normalizeUrl = value => {
  try {
    const u = new URL(value);
    u.hostname = u.hostname.toLowerCase().replace(/^m\./, "").replace(/^www\./, "");
    if (/\/PostView\.naver$/i.test(u.pathname)) {
      const blogId = u.searchParams.get("blogId");
      const logNo = u.searchParams.get("logNo");
      if (blogId && logNo) return `blog.naver.com/${blogId}/${logNo}`.toLowerCase();
    }
    u.hash = ""; u.search = "";
    return `${u.hostname}${decodeURIComponent(u.pathname)}`.replace(/\/+$/, "").toLowerCase();
  } catch {
    return String(value || "").replace(/^https?:\/\//, "").replace(/^m\./, "").replace(/^www\./, "").replace(/[?#].*$/, "").replace(/\/+$/, "").toLowerCase();
  }
};
const matches = (resultUrl, targetUrl, matchType) => {
  const result = normalizeUrl(resultUrl);
  const target = normalizeUrl(targetUrl);
  if (matchType === "DOMAIN") return result.split("/")[0] === target.split("/")[0];
  if (matchType === "PATH") return result.includes(target) || target.includes(result);
  return result === target || result.startsWith(`${target}/`);
};
const runRankScript = (script, keyword) => new Promise(resolve => {
  const python = process.platform === "win32" ? "python" : "python3";
  execFile(python, [join(root, "scripts", script), keyword.keyword, keyword.targetUrl, keyword.matchType || "EXACT"], { encoding: "utf8", timeout: 25000, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
    if (error) return resolve({ success: false, errorMessage: stderr?.trim() || error.message, durationMs: 0 });
    try { resolve(JSON.parse(stdout.trim())); }
    catch { resolve({ success: false, errorMessage: "검색 결과를 해석하지 못했습니다.", durationMs: 0 }); }
  });
});
const checkRank = async keyword => {
  if (keyword.searchEngine === "NAVER_BLOG") return runRankScript("naver_rank.py", keyword);
  if (keyword.searchEngine === "GOOGLE") return runRankScript("google_rank.py", keyword);
  return { success: false, errorMessage: `${keyword.searchEngine}는 아직 실측 Provider가 연결되지 않았습니다.`, durationMs: 0 };
};

async function api(req, res, url) {
  if (url.pathname === "/api/providers/status") return json(res, 200, {
    naverBlog: { configured: true, officialApi: false, mode: "NAVER_PUBLIC_SEARCH", note: "비로그인 PC 통합검색 블로그 영역 기준" },
    google: { configured: true, mode: "GOOGLE_PUBLIC_SEARCH", note: "비로그인 PC Google 검색 100위 기준. 차단 시 실패 처리" },
    otherSearchEngines: { mode: "UNSUPPORTED", note: "임의 순위 생성 안 함" }
  });
  if (url.pathname === "/api/dashboard") {
    const summaryMap = new Map();
    store.keywords.forEach(k => summaryMap.set(k.status, (summaryMap.get(k.status) || 0) + 1));
    const trendMap = new Map();
    store.rank_history.filter(h => h.rank != null).forEach(h => {
      const date = h.checkedAt.slice(0, 10);
      const arr = trendMap.get(date) || [];
      arr.push(h.rank); trendMap.set(date, arr);
    });
    return json(res, 200, {
      customers: store.customers.length,
      projects: store.projects.filter(p => p.status === "진행중").length,
      keywords: store.keywords.length,
      summary: [...summaryMap].map(([status, count]) => ({ status, count })),
      recent: store.keywords.map(joinKeyword).sort((a, b) => String(b.lastCheckedAt || "").localeCompare(String(a.lastCheckedAt || ""))).slice(0, 8),
      trend: [...trendMap].sort(([a], [b]) => a.localeCompare(b)).map(([date, ranks]) => ({ date, avgRank: Math.round((ranks.reduce((a, b) => a + b, 0) / ranks.length) * 10) / 10 }))
    });
  }
  if (url.pathname === "/api/customers" && req.method === "GET") return json(res, 200, store.customers.map(c => ({ ...c, projectCount: store.projects.filter(p => p.customerId === c.id).length, keywordCount: store.keywords.filter(k => k.customerId === c.id).length })).sort((a, b) => b.id - a.id));
  if (url.pathname === "/api/customers" && req.method === "POST") {
    const x = await body(req);
    const row = { id: id("customers"), name: x.name, companyName: x.companyName, managerName: x.managerName || x.name, phone: x.phone || "", email: x.email || "", memo: x.memo || "", status: x.status || "진행중", createdAt: now() };
    store.customers.push(row); save(); return json(res, 201, row);
  }
  if (url.pathname === "/api/projects" && req.method === "GET") return json(res, 200, store.projects.map(p => ({ ...p, customerName: store.customers.find(c => c.id === p.customerId)?.companyName || "", keywordCount: store.keywords.filter(k => k.projectId === p.id).length })).sort((a, b) => b.id - a.id));
  if (url.pathname === "/api/projects" && req.method === "POST") {
    const x = await body(req);
    const row = { id: id("projects"), customerId: Number(x.customerId), name: x.name, serviceType: x.serviceType, status: x.status || "진행중", startDate: x.startDate || "", endDate: x.endDate || "", manager: x.manager || "", description: x.description || "", createdAt: now() };
    store.projects.push(row); save(); return json(res, 201, row);
  }
  if (url.pathname === "/api/keywords" && req.method === "GET") {
    const q = url.searchParams.get("q") || "";
    const status = url.searchParams.get("status") || "";
    let rows = store.keywords.map(joinKeyword).filter(k => like(k.keyword, q) || like(k.customerName, q) || like(k.projectName, q));
    if (status) rows = rows.filter(k => k.status === status);
    return json(res, 200, rows.sort((a, b) => b.id - a.id));
  }
  if (url.pathname === "/api/keywords" && req.method === "POST") {
    const x = await body(req);
    if (!/^https?:\/\//i.test(x.targetUrl || "")) return json(res, 400, { message: "올바른 URL을 입력해 주세요." });
    const project = store.projects.find(p => p.id === Number(x.projectId));
    if (!project) return json(res, 404, { message: "프로젝트를 찾을 수 없습니다." });
    if (store.keywords.some(k => k.projectId === project.id && k.keyword === x.keyword && k.targetUrl === x.targetUrl)) return json(res, 409, { message: "동일 프로젝트에 같은 키워드와 URL이 이미 있습니다." });
    const row = { id: id("keywords"), projectId: project.id, customerId: project.customerId, keyword: x.keyword, targetUrl: x.targetUrl, searchEngine: x.searchEngine, serviceType: project.serviceType, device: x.device || "PC", region: x.region || "전국", targetRank: Number(x.targetRank || 10), currentRank: null, previousRank: null, bestRank: null, firstRank: null, status: "NEW", matchType: x.matchType || "EXACT", lastCheckedAt: null, createdAt: now() };
    store.keywords.push(row); save(); return json(res, 201, joinKeyword(row));
  }
  const check = url.pathname.match(/^\/api\/keywords\/(\d+)\/check$/);
  if (check && req.method === "POST") {
    const row = store.keywords.find(k => k.id === Number(check[1]));
    if (!row) return json(res, 404, { message: "키워드를 찾을 수 없습니다." });
    const result = await checkRank(row);
    if (!result.success) {
      row.status = "FAILED"; row.lastCheckedAt = day();
      store.search_logs.push({ id: id("search_logs"), keywordId: row.id, success: 0, errorMessage: result.errorMessage, durationMs: result.durationMs || 0, provider: result.provider || "SearchProvider", createdAt: now() });
      save(); return json(res, 500, { message: result.errorMessage });
    }
    const previous = row.currentRank;
    const rank = result.rank;
    row.previousRank = previous; row.currentRank = rank;
    if (rank != null && (row.bestRank == null || rank < row.bestRank)) row.bestRank = rank;
    row.firstRank ??= rank;
    row.status = !result.found ? "NOT_FOUND" : previous == null ? "NEW" : rank < previous ? "UP" : rank > previous ? "DOWN" : "SAME";
    row.lastCheckedAt = day();
    store.rank_history.push({ id: id("rank_history"), keywordId: row.id, rank, previousRank: previous, changeAmount: rank == null || previous == null ? null : previous - rank, status: row.status, found: result.found ? 1 : 0, checkedAt: day() });
    store.search_logs.push({ id: id("search_logs"), keywordId: row.id, success: 1, rank, durationMs: result.durationMs || 0, provider: result.provider || "SearchProvider", createdAt: now() });
    save(); return json(res, 200, joinKeyword(row));
  }
  const history = url.pathname.match(/^\/api\/keywords\/(\d+)\/history$/);
  if (history) return json(res, 200, store.rank_history.filter(h => h.keywordId === Number(history[1])).sort((a, b) => String(a.checkedAt).localeCompare(String(b.checkedAt))));
  const del = url.pathname.match(/^\/api\/(customers|projects|keywords)\/(\d+)$/);
  if (del && req.method === "DELETE") {
    const table = del[1], targetId = Number(del[2]);
    const before = store[table].length;
    store[table] = store[table].filter(x => x.id !== targetId);
    if (table === "customers") { store.projects = store.projects.filter(p => p.customerId !== targetId); store.keywords = store.keywords.filter(k => k.customerId !== targetId); }
    if (table === "projects") store.keywords = store.keywords.filter(k => k.projectId !== targetId);
    save(); return json(res, before === store[table].length ? 404 : 200, { ok: before !== store[table].length });
  }
  return false;
}

const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png" };
const port = Number(process.env.PORT || 8787);
createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  try {
    if (url.pathname.startsWith("/api/")) {
      const handled = await api(req, res, url);
      if (handled === false) json(res, 404, { message: "API를 찾을 수 없습니다." });
      return;
    }
    const dist = resolve(root, "dist");
    let file = join(dist, url.pathname === "/" ? "index.html" : url.pathname);
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(dist, "index.html");
    if (!existsSync(file)) return json(res, 404, { message: "먼저 npm run build를 실행해 주세요." });
    res.writeHead(200, { "Content-Type": mime[extname(file)] || "application/octet-stream" });
    res.end(readFileSync(file));
  } catch (e) {
    console.error(e);
    if (!res.headersSent) json(res, 500, { message: e.message || "서버 오류" });
  }
}).listen(port, () => console.log(`ROBUR INDEX http://localhost:${port}`));
