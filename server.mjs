import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import { execFile } from "node:child_process";

const root = fileURLToPath(new URL(".", import.meta.url));
try { process.loadEnvFile(join(root, ".env")); } catch {}
mkdirSync(join(root, "data"), { recursive: true });
const db = new DatabaseSync(join(root, "data", "robur-index.db"));
db.exec(`
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, companyName TEXT NOT NULL,
    managerName TEXT, phone TEXT, email TEXT, memo TEXT, status TEXT DEFAULT '진행중',
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT, customerId INTEGER NOT NULL, name TEXT NOT NULL,
    serviceType TEXT NOT NULL, status TEXT DEFAULT '진행중', startDate TEXT, endDate TEXT,
    manager TEXT, description TEXT, createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(customerId) REFERENCES customers(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS keywords (
    id INTEGER PRIMARY KEY AUTOINCREMENT, projectId INTEGER NOT NULL, customerId INTEGER NOT NULL,
    keyword TEXT NOT NULL, targetUrl TEXT NOT NULL, searchEngine TEXT NOT NULL,
    serviceType TEXT NOT NULL, device TEXT DEFAULT 'PC', region TEXT DEFAULT '전국',
    targetRank INTEGER DEFAULT 10, currentRank INTEGER, previousRank INTEGER, bestRank INTEGER,
    firstRank INTEGER, status TEXT DEFAULT 'NEW', matchType TEXT DEFAULT 'EXACT',
    lastCheckedAt TEXT, createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(projectId, keyword, targetUrl),
    FOREIGN KEY(projectId) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY(customerId) REFERENCES customers(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS rank_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT, keywordId INTEGER NOT NULL, rank INTEGER,
    previousRank INTEGER, changeAmount INTEGER, status TEXT NOT NULL, found INTEGER DEFAULT 1,
    checkedAt TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(keywordId) REFERENCES keywords(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS search_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT, keywordId INTEGER NOT NULL, success INTEGER,
    rank INTEGER, errorMessage TEXT, durationMs INTEGER, provider TEXT, createdAt TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

const one = (sql, ...args) => db.prepare(sql).get(...args);
const all = (sql, ...args) => db.prepare(sql).all(...args);
const run = (sql, ...args) => db.prepare(sql).run(...args);
const day = (offset = 0) => new Date(Date.now() + offset * 86400000).toISOString();

function seed() {
  if (one("SELECT COUNT(*) count FROM customers").count) return;
  const customers = [
    ["김하늘", "로부르컴퍼니 테스트 고객 A", "김하늘", "010-2345-6789", "sky@robur.kr", "주간 보고 선호", "진행중"],
    ["이도윤", "법률사무소 온", "이도윤", "010-5281-1134", "hello@lawon.kr", "상담 키워드 집중", "진행중"],
    ["박서아", "프랜차이즈 브릭", "박서아", "010-8821-4242", "seo@brick.kr", "월간 리포트", "진행중"]
  ];
  const insC = db.prepare("INSERT INTO customers(name,companyName,managerName,phone,email,memo,status) VALUES(?,?,?,?,?,?,?)");
  customers.forEach(c => insC.run(...c));
  const projects = [
    [1, "A사 블로그 상위노출", "BLOG", "진행중", "2026-05-01", "2026-09-30", "정은채"],
    [2, "법률 상담 카페 바이럴", "CAFE", "진행중", "2026-05-15", "2026-08-31", "정은채"],
    [3, "브릭 파워링크 운영", "POWERLINK", "진행중", "2026-06-01", "2026-12-31", "박시온"],
    [3, "브릭 구글 SEO", "GOOGLE_SEO", "진행중", "2026-06-01", "2026-12-31", "박시온"]
  ];
  const insP = db.prepare("INSERT INTO projects(customerId,name,serviceType,status,startDate,endDate,manager) VALUES(?,?,?,?,?,?,?)");
  projects.forEach(p => insP.run(...p));
  const keys = [
    [1,1,"플라스틱 프로텍트","https://blog.naver.com/robur/123","NAVER_BLOG","BLOG",8],
    [1,1,"블로그 상위노출","https://blog.naver.com/robur/124","NAVER_BLOG","BLOG",12],
    [1,1,"창업 아이템","https://blog.naver.com/robur/125","NAVER_BLOG","BLOG",null],
    [2,2,"개인회생 상담","https://cafe.naver.com/lawon/21","NAVER_CAFE","CAFE",5],
    [2,2,"카페 바이럴","https://cafe.naver.com/lawon/22","NAVER_CAFE","CAFE",18],
    [3,3,"프랜차이즈 창업","https://brick.kr/start","NAVER_POWERLINK","POWERLINK",3],
    [3,3,"파워링크 광고대행","https://brick.kr/ads","NAVER_POWERLINK","POWERLINK",9],
    [4,3,"구글 SEO 업체","https://brick.kr/seo","GOOGLE","GOOGLE_SEO",14]
  ];
  const insK = db.prepare(`INSERT INTO keywords(projectId,customerId,keyword,targetUrl,searchEngine,serviceType,currentRank,previousRank,bestRank,firstRank,status,lastCheckedAt)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`);
  keys.forEach((k, i) => {
    const curr = k[6], prev = curr == null ? 23 : curr + ([2,-3,0,5][i%4]);
    const status = curr == null ? "NOT_FOUND" : curr < prev ? "UP" : curr > prev ? "DOWN" : "SAME";
    insK.run(k[0],k[1],k[2],k[3],k[4],k[5],curr,prev,curr ? Math.max(1,curr-2) : 19,curr ? curr+8 : 31,status,day());
  });
  const insH = db.prepare("INSERT INTO rank_history(keywordId,rank,previousRank,changeAmount,status,found,checkedAt) VALUES(?,?,?,?,?,?,?)");
  for (let keywordId=1; keywordId<=8; keywordId++) {
    let rank = 10 + keywordId * 2;
    for (let d=-29; d<=0; d++) {
      rank = Math.max(1, Math.min(42, rank + ((keywordId * 7 + d * 3) % 5 - 2)));
      const missing = (keywordId === 3 && d > -3);
      const previous = rank + ((d + keywordId) % 3 - 1);
      insH.run(keywordId, missing ? null : rank, previous, missing ? null : previous-rank, missing ? "NOT_FOUND" : previous > rank ? "UP" : previous < rank ? "DOWN" : "SAME", missing ? 0 : 1, day(d));
    }
  }
}
seed();

const json = (res, status, data) => {
  res.writeHead(status, {"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"});
  res.end(JSON.stringify(data));
};
const body = req => new Promise((ok, fail) => {
  let data=""; req.on("data", c => data += c); req.on("end", () => {
    try { ok(data ? JSON.parse(data) : {}); } catch(e) { fail(e); }
  });
});
const keywordQuery = `SELECT k.*, p.name projectName, c.companyName customerName
  FROM keywords k JOIN projects p ON p.id=k.projectId JOIN customers c ON c.id=k.customerId`;

class MockSearchProvider {
  async check(keyword) {
    const started = Date.now();
    await new Promise(r => setTimeout(r, 250 + Math.random()*350));
    if (Math.random() < .04) return { success:false, errorMessage:"Mock provider 일시 오류", durationMs:Date.now()-started };
    const old = keyword.currentRank ?? (12 + Math.floor(Math.random()*25));
    const found = Math.random() > .08;
    const rank = found ? Math.max(1, Math.min(100, old + Math.floor(Math.random()*11)-5)) : null;
    return { success:true, rank, found, durationMs:Date.now()-started };
  }
}
class UnsupportedSearchProvider {
  async check(keyword) {
    return {
      success: false,
      errorMessage: `${keyword.searchEngine} 실검색 Provider는 아직 연결되지 않았습니다. 임의 순위는 생성하지 않습니다.`,
      durationMs: 0
    };
  }
}
class NaverBlogProvider {
  constructor() {
    this.hubId = process.env.NAVER_API_HUB_CLIENT_ID;
    this.hubSecret = process.env.NAVER_API_HUB_CLIENT_SECRET;
    this.legacyId = process.env.NAVER_CLIENT_ID;
    this.legacySecret = process.env.NAVER_CLIENT_SECRET;
  }
  get configured() {
    return Boolean((this.hubId && this.hubSecret) || (this.legacyId && this.legacySecret));
  }
  normalizeUrl(value) {
    try {
      const url = new URL(value);
      url.hostname = url.hostname.toLowerCase().replace(/^m\./, "").replace(/^www\./, "");
      if (/\/PostView\.naver$/i.test(url.pathname)) {
        const blogId = url.searchParams.get("blogId");
        const logNo = url.searchParams.get("logNo");
        if (blogId && logNo) return `blog.naver.com/${blogId}/${logNo}`.toLowerCase();
      }
      url.hash = "";
      url.search = "";
      return `${url.hostname}${decodeURIComponent(url.pathname)}`.replace(/\/+$/, "").toLowerCase();
    } catch {
      return String(value || "").replace(/^https?:\/\//, "").replace(/^m\./, "").replace(/[?#].*$/, "").replace(/\/+$/, "").toLowerCase();
    }
  }
  matches(resultUrl, targetUrl, matchType) {
    const result = this.normalizeUrl(resultUrl);
    const target = this.normalizeUrl(targetUrl);
    const targetParts = target.split("/");
    if (targetParts[0] === "blog.naver.com" && targetParts.length === 2) {
      return result.startsWith(`${target}/`);
    }
    if (matchType === "DOMAIN") return result.split("/")[0] === target.split("/")[0];
    if (matchType === "PATH") return result.includes(target) || target.includes(result);
    return result === target;
  }
  stripHtml(value = "") {
    return value.replace(/<[^>]+>/g, "").replace(/&quot;/g, "\"").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  }
  async check(keyword) {
    const started = Date.now();
    if (!this.configured) {
      return {
        success: false,
        errorMessage: "네이버 API 키가 없습니다. 프로젝트의 .env 파일에 NAVER_API_HUB_CLIENT_ID와 NAVER_API_HUB_CLIENT_SECRET을 설정해 주세요.",
        durationMs: Date.now() - started
      };
    }
    const useHub = Boolean(this.hubId && this.hubSecret);
    const endpoint = useHub
      ? "https://naverapihub.apigw.ntruss.com/search/v1/blog"
      : "https://openapi.naver.com/v1/search/blog.json";
    const url = new URL(endpoint);
    url.searchParams.set("query", keyword.keyword);
    url.searchParams.set("display", "100");
    url.searchParams.set("start", "1");
    url.searchParams.set("sort", "sim");
    const headers = useHub
      ? { "X-NCP-APIGW-API-KEY-ID": this.hubId, "X-NCP-APIGW-API-KEY": this.hubSecret }
      : { "X-Naver-Client-Id": this.legacyId, "X-Naver-Client-Secret": this.legacySecret };
    try {
      const response = await fetch(url, { headers, signal: AbortSignal.timeout(12000) });
      const text = await response.text();
      if (!response.ok) {
        let message = `네이버 API 오류 (${response.status})`;
        try {
          const payload = JSON.parse(text);
          message = payload.errorMessage || payload.error?.message || message;
        } catch {}
        return { success: false, errorMessage: message, durationMs: Date.now() - started };
      }
      const payload = JSON.parse(text);
      const items = Array.isArray(payload.items) ? payload.items : [];
      const index = items.findIndex(item => this.matches(item.link, keyword.targetUrl, keyword.matchType));
      const item = index >= 0 ? items[index] : null;
      return {
        success: true,
        rank: item ? index + 1 : null,
        found: Boolean(item),
        resultUrl: item?.link || null,
        resultTitle: item ? this.stripHtml(item.title) : null,
        durationMs: Date.now() - started,
        provider: useHub ? "NaverApiHubBlogProvider" : "NaverLegacyBlogProvider"
      };
    } catch (error) {
      const message = error?.name === "TimeoutError"
        ? "네이버 API 응답 시간이 초과되었습니다."
        : `네이버 API 연결 실패: ${error?.message || "알 수 없는 오류"}`;
      return { success: false, errorMessage: message, durationMs: Date.now() - started };
    }
  }
}
class NaverPublicSearchProvider {
  constructor(matcher) {
    this.matcher = matcher;
    this.cache = new Map();
    this.lastRequestAt = 0;
    this.queue = Promise.resolve();
  }
  async check(keyword) {
    const cacheKey = `${keyword.keyword}|${keyword.targetUrl}|${keyword.matchType}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.savedAt < 300000) {
      return { ...cached.result, durationMs: 0, provider: "NaverPublicSearchProvider(cache)" };
    }
    const task = async () => {
      const started = Date.now();
      const waitMs = Math.max(0, 1500 - (Date.now() - this.lastRequestAt));
      if (waitMs) await new Promise(resolve => setTimeout(resolve, waitMs));
      this.lastRequestAt = Date.now();
      try {
        const bundledPython = join(
          process.env.USERPROFILE || "",
          ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "python", "python.exe"
        );
        const python = process.env.PYTHON_EXECUTABLE || (existsSync(bundledPython) ? bundledPython : (process.platform === "win32" ? "python" : "python3"));
        const result = await new Promise((resolve, reject) => {
          execFile(
            python,
            [join(root, "scripts", "naver_rank.py"), keyword.keyword, keyword.targetUrl, keyword.matchType || "EXACT"],
            { encoding: "utf8", timeout: 20000, windowsHide: true, maxBuffer: 1024 * 1024 },
            (error, stdout, stderr) => {
              if (error) return reject(new Error(stderr?.trim() || error.message));
              try { resolve(JSON.parse(stdout.trim())); }
              catch { reject(new Error("파이썬 검색 결과를 해석하지 못했습니다.")); }
            }
          );
        });
        if (!result.durationMs) result.durationMs = Date.now() - started;
        this.cache.set(cacheKey, { savedAt: Date.now(), result });
        return result;
      } catch (error) {
        const message = error?.name === "TimeoutError"
          ? "네이버 공개검색 응답 시간이 초과되었습니다."
          : `네이버 공개검색 연결 실패: ${error?.message || "알 수 없는 오류"}`;
        return { success: false, errorMessage: message, durationMs: Date.now() - started };
      }
    };
    const queued = this.queue.then(task, task);
    this.queue = queued.then(() => undefined, () => undefined);
    return queued;
  }
}
class GooglePublicSearchProvider {
  constructor() {
    this.cache = new Map();
    this.lastRequestAt = 0;
    this.queue = Promise.resolve();
  }
  async check(keyword) {
    const cacheKey = `${keyword.keyword}|${keyword.targetUrl}|${keyword.matchType}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.savedAt < 300000) {
      return { ...cached.result, durationMs: 0, provider: "GooglePublicSearchProvider(cache)" };
    }
    const task = async () => {
      const started = Date.now();
      const waitMs = Math.max(0, 2500 - (Date.now() - this.lastRequestAt));
      if (waitMs) await new Promise(resolve => setTimeout(resolve, waitMs));
      this.lastRequestAt = Date.now();
      try {
        const bundledPython = join(
          process.env.USERPROFILE || "",
          ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "python", "python.exe"
        );
        const python = process.env.PYTHON_EXECUTABLE || (existsSync(bundledPython) ? bundledPython : (process.platform === "win32" ? "python" : "python3"));
        const result = await new Promise((resolve, reject) => {
          execFile(
            python,
            [join(root, "scripts", "google_rank.py"), keyword.keyword, keyword.targetUrl, keyword.matchType || "EXACT"],
            { encoding: "utf8", timeout: 25000, windowsHide: true, maxBuffer: 1024 * 1024 },
            (error, stdout, stderr) => {
              if (error) return reject(new Error(stderr?.trim() || error.message));
              try { resolve(JSON.parse(stdout.trim())); }
              catch { reject(new Error("Google search result could not be parsed.")); }
            }
          );
        });
        if (!result.durationMs) result.durationMs = Date.now() - started;
        this.cache.set(cacheKey, { savedAt: Date.now(), result });
        return result;
      } catch (error) {
        return {
          success: false,
          errorMessage: `Google public search failed: ${error?.message || "unknown error"}`,
          durationMs: Date.now() - started
        };
      }
    };
    const queued = this.queue.then(task, task);
    this.queue = queued.then(() => undefined, () => undefined);
    return queued;
  }
}
class SerpApiGoogleProvider {
  constructor(matcher) {
    this.matcher = matcher;
    this.apiKey = process.env.SERPAPI_KEY || process.env.GOOGLE_SERPAPI_KEY || "";
  }
  get configured() {
    return Boolean(this.apiKey);
  }
  async check(keyword) {
    const started = Date.now();
    if (!this.configured) {
      return {
        success: false,
        errorMessage: "Google 순위 정확 조회용 SERPAPI_KEY가 설정되어 있지 않습니다. Google은 직접 수집을 자주 차단하므로 API 키가 필요합니다.",
        durationMs: Date.now() - started
      };
    }
    try {
      const url = new URL("https://serpapi.com/search.json");
      url.searchParams.set("engine", "google");
      url.searchParams.set("q", keyword.keyword);
      url.searchParams.set("google_domain", "google.co.kr");
      url.searchParams.set("gl", "kr");
      url.searchParams.set("hl", "ko");
      url.searchParams.set("num", "100");
      url.searchParams.set("api_key", this.apiKey);
      const response = await fetch(url, { signal: AbortSignal.timeout(25000) });
      const text = await response.text();
      if (!response.ok) {
        let message = `SerpAPI error (${response.status})`;
        try {
          const payload = JSON.parse(text);
          message = payload.error || message;
        } catch {}
        return { success: false, errorMessage: message, durationMs: Date.now() - started };
      }
      const payload = JSON.parse(text);
      const organic = Array.isArray(payload.organic_results) ? payload.organic_results : [];
      const index = organic.findIndex(item => this.matcher.matches(item.link, keyword.targetUrl, keyword.matchType));
      const item = index >= 0 ? organic[index] : null;
      return {
        success: true,
        rank: item ? index + 1 : null,
        found: Boolean(item),
        resultUrl: item?.link || null,
        resultTitle: item?.title || null,
        durationMs: Date.now() - started,
        provider: "SerpApiGoogleProvider"
      };
    } catch (error) {
      const message = error?.name === "TimeoutError"
        ? "SerpAPI 응답 시간이 초과되었습니다."
        : `SerpAPI 연결 실패: ${error?.message || "unknown error"}`;
      return { success: false, errorMessage: message, durationMs: Date.now() - started };
    }
  }
}
const mockProvider = new MockSearchProvider();
const unsupportedProvider = new UnsupportedSearchProvider();
const naverBlogProvider = new NaverBlogProvider();
const naverPublicSearchProvider = new NaverPublicSearchProvider(naverBlogProvider);
const googlePublicSearchProvider = new GooglePublicSearchProvider();
const serpApiGoogleProvider = new SerpApiGoogleProvider(naverBlogProvider);

async function api(req, res, url) {
  if (url.pathname === "/api/providers/status") {
    const hasOfficialApi = naverBlogProvider.configured;
    return json(res, 200, {
      naverBlog: {
        configured: true,
        officialApi: hasOfficialApi,
        mode: naverBlogProvider.hubId ? "NAVER_API_HUB" : naverBlogProvider.legacyId ? "NAVER_DEVELOPERS_LEGACY" : "NAVER_PUBLIC_SEARCH",
        note: hasOfficialApi ? "공식 API 기준 상위 100개" : "비로그인 PC 통합검색 블로그 영역 기준"
      },
      otherSearchEngines: { mode: "UNSUPPORTED", note: "임의 순위 생성 안 함" }
    });
  }
  if (url.pathname === "/api/dashboard") {
    const customers = one("SELECT COUNT(*) count FROM customers").count;
    const projects = one("SELECT COUNT(*) count FROM projects WHERE status='진행중'").count;
    const keywords = one("SELECT COUNT(*) count FROM keywords").count;
    const summary = all("SELECT status, COUNT(*) count FROM keywords GROUP BY status");
    const recent = all(keywordQuery + " ORDER BY k.lastCheckedAt DESC LIMIT 8");
    const trend = all(`SELECT substr(checkedAt,1,10) date, ROUND(AVG(rank),1) avgRank
      FROM rank_history WHERE rank IS NOT NULL AND checkedAt >= datetime('now','-7 day') GROUP BY substr(checkedAt,1,10) ORDER BY date`);
    return json(res,200,{customers,projects,keywords,summary,recent,trend});
  }
  if (url.pathname === "/api/customers" && req.method === "GET")
    return json(res,200,all(`SELECT c.*, COUNT(DISTINCT p.id) projectCount, COUNT(DISTINCT k.id) keywordCount
      FROM customers c LEFT JOIN projects p ON p.customerId=c.id LEFT JOIN keywords k ON k.customerId=c.id GROUP BY c.id ORDER BY c.id DESC`));
  if (url.pathname === "/api/customers" && req.method === "POST") {
    const x=await body(req); const r=run("INSERT INTO customers(name,companyName,managerName,phone,email,memo,status) VALUES(?,?,?,?,?,?,?)",
      x.name,x.companyName,x.managerName||x.name,x.phone||"",x.email||"",x.memo||"",x.status||"진행중");
    return json(res,201,one("SELECT * FROM customers WHERE id=?",r.lastInsertRowid));
  }
  if (url.pathname === "/api/projects" && req.method === "GET")
    return json(res,200,all(`SELECT p.*, c.companyName customerName, COUNT(k.id) keywordCount
      FROM projects p JOIN customers c ON c.id=p.customerId LEFT JOIN keywords k ON k.projectId=p.id GROUP BY p.id ORDER BY p.id DESC`));
  if (url.pathname === "/api/projects" && req.method === "POST") {
    const x=await body(req); const r=run("INSERT INTO projects(customerId,name,serviceType,status,startDate,endDate,manager,description) VALUES(?,?,?,?,?,?,?,?)",
      x.customerId,x.name,x.serviceType,x.status||"진행중",x.startDate||"",x.endDate||"",x.manager||"",x.description||"");
    return json(res,201,one("SELECT * FROM projects WHERE id=?",r.lastInsertRowid));
  }
  if (url.pathname === "/api/keywords" && req.method === "GET") {
    const q=url.searchParams.get("q")||"", status=url.searchParams.get("status")||"";
    let sql=keywordQuery+" WHERE (k.keyword LIKE ? OR c.companyName LIKE ? OR p.name LIKE ?)", args=[`%${q}%`,`%${q}%`,`%${q}%`];
    if(status){sql+=" AND k.status=?";args.push(status)} sql+=" ORDER BY k.id DESC";
    return json(res,200,all(sql,...args));
  }
  if (url.pathname === "/api/keywords" && req.method === "POST") {
    const x=await body(req);
    if(!/^https?:\/\//i.test(x.targetUrl||"")) return json(res,400,{message:"올바른 URL을 입력해 주세요."});
    try {
      const p=one("SELECT * FROM projects WHERE id=?",x.projectId);
      const r=run(`INSERT INTO keywords(projectId,customerId,keyword,targetUrl,searchEngine,serviceType,device,region,targetRank,matchType,status)
        VALUES(?,?,?,?,?,?,?,?,?,?,'NEW')`,x.projectId,p.customerId,x.keyword,x.targetUrl,x.searchEngine,p.serviceType,x.device||"PC",x.region||"전국",x.targetRank||10,x.matchType||"EXACT");
      return json(res,201,one(keywordQuery+" WHERE k.id=?",r.lastInsertRowid));
    } catch(e) { return json(res,409,{message:"동일 프로젝트에 같은 키워드와 URL이 이미 있습니다."}); }
  }
  const check=url.pathname.match(/^\/api\/keywords\/(\d+)\/check$/);
  if(check && req.method==="POST") {
    const id=Number(check[1]), k=one("SELECT * FROM keywords WHERE id=?",id);
    if(!k) return json(res,404,{message:"키워드를 찾을 수 없습니다."});
    const activeProvider = k.searchEngine === "NAVER_BLOG"
      ? (naverBlogProvider.configured ? naverBlogProvider : naverPublicSearchProvider)
      : k.searchEngine === "GOOGLE"
        ? (serpApiGoogleProvider.configured ? serpApiGoogleProvider : googlePublicSearchProvider)
      : unsupportedProvider;
    const result=await activeProvider.check(k);
    if(!result.success){
      const providerName = k.searchEngine === "NAVER_BLOG" ? "NaverBlogProvider" : k.searchEngine === "GOOGLE" ? "GooglePublicSearchProvider" : "UnsupportedProvider";
      run("INSERT INTO search_logs(keywordId,success,errorMessage,durationMs,provider) VALUES(?,0,?,?,?)",id,result.errorMessage,result.durationMs,providerName);
      run("UPDATE keywords SET status='FAILED',lastCheckedAt=? WHERE id=?",day(),id);
      return json(res,500,{message:result.errorMessage});
    }
    const previous=k.currentRank, rank=result.rank;
    const status=!result.found?"NOT_FOUND":previous==null?"NEW":rank<previous?"UP":rank>previous?"DOWN":"SAME";
    const change=rank==null||previous==null?null:previous-rank;
    run(`UPDATE keywords SET previousRank=?,currentRank=?,bestRank=CASE WHEN ? IS NULL THEN bestRank WHEN bestRank IS NULL OR ?<bestRank THEN ? ELSE bestRank END,
      firstRank=COALESCE(firstRank,?),status=?,lastCheckedAt=? WHERE id=?`,previous,rank,rank,rank,rank,rank,status,day(),id);
    run("INSERT INTO rank_history(keywordId,rank,previousRank,changeAmount,status,found,checkedAt) VALUES(?,?,?,?,?,?,?)",id,rank,previous,change,status,result.found?1:0,day());
    run("INSERT INTO search_logs(keywordId,success,rank,durationMs,provider) VALUES(?,1,?,?,?)",id,rank,result.durationMs,result.provider || "SearchProvider");
    return json(res,200,one(keywordQuery+" WHERE k.id=?",id));
  }
  const history=url.pathname.match(/^\/api\/keywords\/(\d+)\/history$/);
  if(history) return json(res,200,all("SELECT * FROM rank_history WHERE keywordId=? ORDER BY checkedAt",Number(history[1])));
  const del=url.pathname.match(/^\/api\/(customers|projects|keywords)\/(\d+)$/);
  if(del && req.method==="DELETE"){
    const table=del[1], r=run(`DELETE FROM ${table} WHERE id=?`,Number(del[2]));
    return json(res,r.changes?200:404,{ok:!!r.changes});
  }
  return false;
}

const mime={".html":"text/html; charset=utf-8",".js":"text/javascript",".css":"text/css",".svg":"image/svg+xml",".png":"image/png"};
const port = Number(process.env.PORT || 8787);
createServer(async (req,res)=>{
  const url=new URL(req.url,"http://localhost");
  try {
    if(url.pathname.startsWith("/api/")) {
      const handled=await api(req,res,url);
      if(handled===false) json(res,404,{message:"API를 찾을 수 없습니다."});
      return;
    }
    const dist=resolve(root,"dist");
    let file=join(dist,url.pathname==="/"?"index.html":url.pathname);
    if(!existsSync(file)||statSync(file).isDirectory()) file=join(dist,"index.html");
    if(!existsSync(file)) return json(res,404,{message:"먼저 npm run build를 실행해 주세요."});
    res.writeHead(200,{"Content-Type":mime[extname(file)]||"application/octet-stream"}); res.end(readFileSync(file));
  } catch(e) { console.error(e); if(!res.headersSent) json(res,500,{message:e.message||"서버 오류"}); }
}).listen(port,()=>console.log(`ROBUR INDEX http://localhost:${port}`));
