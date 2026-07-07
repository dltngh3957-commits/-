import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  LayoutDashboard, Users, FolderKanban, KeyRound, BarChart3, FileText, Bell, Settings,
  Search, Plus, ArrowUpRight, ArrowDownRight, Minus, AlertTriangle, RefreshCw, Download,
  ChevronDown, MoreHorizontal, Menu, X, Check, Clock3, Eye, Sparkles, LogOut, CircleHelp,
  Link2, CalendarDays, Target, Building2
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import "./styles.css";

type Page = "dashboard"|"customers"|"projects"|"keywords"|"reports"|"notifications"|"settings";
type AnyRow = Record<string, any>;
const API="/api";
const serviceLabel:Record<string,string>={BLOG:"네이버 블로그",CAFE:"네이버 카페",POWERLINK:"파워링크",GOOGLE_SEO:"구글 SEO"};
const statusLabel:Record<string,string>={UP:"상승",DOWN:"하락",SAME:"유지",NEW:"신규",NOT_FOUND:"미노출",FAILED:"수집 실패"};
const nav=[
  ["dashboard","대시보드",LayoutDashboard],["customers","고객 관리",Users],["projects","프로젝트 관리",FolderKanban],
  ["keywords","키워드 관리",KeyRound],["keywords","순위 현황",BarChart3],["reports","리포트",FileText],
  ["notifications","알림",Bell],["settings","설정",Settings]
] as const;

async function request(path:string, options?:RequestInit){
  const res=await fetch(API+path,{...options,headers:{"Content-Type":"application/json",...(options?.headers||{})}});
  const data=await res.json(); if(!res.ok) throw new Error(data.message||"요청에 실패했습니다."); return data;
}
const fmt=(d?:string)=>d?new Intl.DateTimeFormat("ko-KR",{month:"short",day:"numeric"}).format(new Date(d)):"—";

function Status({value,rank,previous}:{value:string;rank?:number|null;previous?:number|null}){
  const icon=value==="UP"?<ArrowUpRight/>:value==="DOWN"?<ArrowDownRight/>:value==="SAME"?<Minus/>:value==="FAILED"?<AlertTriangle/>:null;
  const delta=rank!=null&&previous!=null?Math.abs(previous-rank):null;
  return <span className={`status s-${value.toLowerCase()}`}>{icon}{statusLabel[value]||value}{delta?` ${delta}`:""}</span>
}
function Modal({title,onClose,children}:{title:string;onClose:()=>void;children:React.ReactNode}){
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" onMouseDown={e=>e.stopPropagation()}>
    <div className="modal-head"><div><span className="eyebrow">ROBUR INDEX</span><h2>{title}</h2></div><button className="icon-btn" onClick={onClose}><X/></button></div>{children}
  </div></div>
}
function Empty({icon:Icon=FileText,title,desc}:{icon?:any;title:string;desc:string}){
  return <div className="empty"><div className="empty-icon"><Icon/></div><h3>{title}</h3><p>{desc}</p></div>
}

function App(){
  const [page,setPage]=useState<Page>("dashboard"), [mobile,setMobile]=useState(false), [toast,setToast]=useState("");
  const [detail,setDetail]=useState<AnyRow|null>(null);
  useEffect(()=>{if(toast){const t=setTimeout(()=>setToast(""),2600);return()=>clearTimeout(t)}},[toast]);
  const go=(p:Page)=>{setPage(p);setMobile(false);setDetail(null)};
  return <div className="app-shell">
    <aside className={mobile?"sidebar open":"sidebar"}>
      <div className="brand"><div className="brand-mark">R</div><div><b>ROBUR</b><span>INDEX</span></div><button className="mobile-close" onClick={()=>setMobile(false)}><X/></button></div>
      <div className="workspace"><div className="avatar small">RC</div><div><b>로부르컴퍼니</b><span>Business workspace</span></div><ChevronDown/></div>
      <nav><p>WORKSPACE</p>{nav.slice(0,6).map(([id,label,Icon],i)=><button key={i} className={page===id&&(label!=="순위 현황"||page==="keywords")?"active":""} onClick={()=>go(id as Page)}><Icon/><span>{label}</span>{label==="알림"&&<em>6</em>}</button>)}
      <p>SYSTEM</p>{nav.slice(6).map(([id,label,Icon],i)=><button key={i} className={page===id?"active":""} onClick={()=>go(id as Page)}><Icon/><span>{label}</span>{label==="알림"&&<em>6</em>}</button>)}</nav>
      <div className="help-card"><Sparkles/><b>도움이 필요하신가요?</b><span>로부르 인덱스 사용 가이드</span><button><CircleHelp/> 가이드 보기</button></div>
      <div className="profile"><div className="avatar">정</div><div><b>정은채</b><span>최고 관리자</span></div><MoreHorizontal/></div>
    </aside>
    {mobile&&<div className="side-dim" onClick={()=>setMobile(false)}/>}
    <main>
      <header><button className="menu-btn" onClick={()=>setMobile(true)}><Menu/></button><div className="header-search"><Search/><input placeholder="고객, 프로젝트, 키워드 검색" onKeyDown={e=>{if(e.key==="Enter"){go("keywords")}}}/><kbd>⌘ K</kbd></div>
        <div className="header-actions"><button className="icon-btn notification"><Bell/><i/></button><div className="divider"/><div className="user-mini"><div className="avatar">정</div><span><b>정은채</b><small>Administrator</small></span><ChevronDown/></div></div>
      </header>
      <div className="content">
        {page==="dashboard"&&<Dashboard go={go} setToast={setToast}/>}
        {page==="customers"&&<Customers setToast={setToast}/>}
        {page==="projects"&&<Projects setToast={setToast}/>}
        {page==="keywords"&&<Keywords setToast={setToast} detail={detail} setDetail={setDetail}/>}
        {page==="reports"&&<Coming page="리포트" desc="고객 공유 리포트와 PDF·엑셀 다운로드 기능은 2단계에서 연결됩니다." icon={FileText}/>}
        {page==="notifications"&&<Notifications/>}
        {page==="settings"&&<SettingsPage setToast={setToast}/>}
      </div>
    </main>{toast&&<div className="toast"><Check/>{toast}</div>}
  </div>
}

function PageHead({kicker,title,desc,action}:{kicker:string;title:string;desc:string;action?:React.ReactNode}){
  return <div className="page-head"><div><span className="eyebrow">{kicker}</span><h1>{title}</h1><p>{desc}</p></div>{action}</div>
}
function Dashboard({go,setToast}:{go:(p:Page)=>void;setToast:(s:string)=>void}){
  const [data,setData]=useState<any>(null),[loading,setLoading]=useState(true);
  const load=()=>{setLoading(true);request("/dashboard").then(setData).finally(()=>setLoading(false))};
  useEffect(load,[]);
  if(!data)return <div className="loading"><RefreshCw className="spin"/> 데이터를 불러오는 중...</div>;
  const count=(s:string)=>data.summary.find((x:any)=>x.status===s)?.count||0;
  const cards=[
    ["전체 고객",data.customers,"곳","지난달 대비 +2",Users,"indigo"],
    ["진행 프로젝트",data.projects,"개","완료 예정 3개",FolderKanban,"blue"],
    ["추적 키워드",data.keywords,"개","오늘 100% 수집",KeyRound,"purple"],
    ["오늘 순위 상승",count("UP"),"개",`하락 ${count("DOWN")}개`,ArrowUpRight,"green"],
    ["미노출 키워드",count("NOT_FOUND"),"개","확인 필요",AlertTriangle,"amber"]
  ];
  return <>
    <PageHead kicker="MONDAY, JULY 6" title="안녕하세요, 정은채 님 👋" desc="오늘의 검색 순위 현황을 한눈에 확인하세요."
      action={<><button className="btn ghost" onClick={()=>{load();setToast("현황을 새로고침했습니다.")}}><RefreshCw/> 새로고침</button><button className="btn primary" onClick={()=>go("keywords")}><Plus/> 키워드 등록</button></>}/>
    <section className="metric-grid">{cards.map(([label,value,unit,note,Icon,color]:any)=><article className="metric" key={label}><div className={`metric-icon ${color}`}><Icon/></div><div className="metric-label">{label}<MoreHorizontal/></div><div className="metric-value">{value}<small>{unit}</small></div><div className={`metric-note ${label.includes("상승")?"positive":""}`}>{note}</div></article>)}</section>
    <section className="dash-grid">
      <article className="panel chart-panel"><div className="panel-head"><div><h3>전체 순위 추이</h3><p>최근 7일 평균 검색 순위 변화</p></div><div className="seg"><button className="active">7일</button><button>30일</button></div></div>
        <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data.trend} margin={{top:10,right:8,left:-24,bottom:0}}><defs><linearGradient id="rankFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4f63d9" stopOpacity=".24"/><stop offset="100%" stopColor="#4f63d9" stopOpacity="0"/></linearGradient></defs><CartesianGrid strokeDasharray="4 5" vertical={false} stroke="#edf0f5"/><XAxis dataKey="date" tickFormatter={v=>fmt(v)} axisLine={false} tickLine={false}/><YAxis reversed domain={[1,30]} axisLine={false} tickLine={false}/><Tooltip formatter={(v:any)=>[`${v}위`,"평균 순위"]} labelFormatter={fmt}/><Area type="monotone" dataKey="avgRank" stroke="#4f63d9" strokeWidth={2.5} fill="url(#rankFill)" dot={{r:3,fill:"#fff",strokeWidth:2}}/></AreaChart></ResponsiveContainer></div>
        <div className="chart-legend"><span><i className="dot indigo"/>평균 순위</span><span className="muted">순위가 낮을수록 상단에 표시됩니다</span></div>
      </article>
      <article className="panel distribution"><div className="panel-head"><div><h3>키워드 분포</h3><p>오늘 수집 결과 기준</p></div><button className="text-btn" onClick={()=>go("keywords")}>전체 보기 <ArrowUpRight/></button></div>
        <div className="dist-main"><div className="donut" style={{background:`conic-gradient(#35b879 0 ${count("UP")/data.keywords*100}%, #f26473 0 ${(count("UP")+count("DOWN"))/data.keywords*100}%, #8892a6 0 ${(count("UP")+count("DOWN")+count("SAME"))/data.keywords*100}%, #f4b840 0 100%)`}}><div><b>{data.keywords}</b><span>전체</span></div></div>
          <div className="dist-list">{[["UP","상승","#35b879"],["DOWN","하락","#f26473"],["SAME","유지","#8892a6"],["NOT_FOUND","미노출","#f4b840"]].map(([s,l,c])=><div key={s}><i style={{background:c}}/><span>{l}</span><b>{count(s)}개</b><small>{Math.round(count(s)/data.keywords*100)}%</small></div>)}</div></div>
      </article>
    </section>
    <article className="panel table-panel"><div className="panel-head"><div><h3>오늘의 순위 변화</h3><p>최근 수집된 키워드의 순위 변동입니다.</p></div><button className="text-btn" onClick={()=>go("keywords")}>전체 키워드 보기 <ArrowUpRight/></button></div>
      <div className="table-scroll"><table><thead><tr><th>키워드</th><th>고객 / 프로젝트</th><th>상품 유형</th><th>어제</th><th>오늘</th><th>변화</th><th>최근 수집</th><th></th></tr></thead>
      <tbody>{data.recent.slice(0,6).map((r:any)=><tr key={r.id}><td><div className="keyword-cell"><span className={`service-icon ${r.serviceType.toLowerCase()}`}>{r.serviceType==="GOOGLE_SEO"?"G":"N"}</span><b>{r.keyword}</b></div></td><td><div className="two-line"><b>{r.customerName}</b><span>{r.projectName}</span></div></td><td><span className="tag">{serviceLabel[r.serviceType]}</span></td><td>{r.previousRank?`${r.previousRank}위`:"—"}</td><td className="rank">{r.currentRank?`${r.currentRank}위`:"—"}</td><td><Status value={r.status} rank={r.currentRank} previous={r.previousRank}/></td><td className="muted">{fmt(r.lastCheckedAt)} 09:00</td><td><MoreHorizontal/></td></tr>)}</tbody></table></div>
    </article>
  </>
}

function Toolbar({search,setSearch,children}:{search:string;setSearch:(s:string)=>void;children?:React.ReactNode}){
  return <div className="toolbar"><div className="search-box"><Search/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="검색어를 입력하세요"/><kbd>⌘ K</kbd></div>{children}</div>
}
function Customers({setToast}:{setToast:(s:string)=>void}){
  const [rows,setRows]=useState<AnyRow[]>([]),[search,setSearch]=useState(""),[open,setOpen]=useState(false);
  const load=()=>request("/customers").then(setRows); useEffect(()=>{load()},[]);
  const filtered=rows.filter(r=>(r.companyName+r.name+r.managerName).toLowerCase().includes(search.toLowerCase()));
  return <><PageHead kicker="CUSTOMERS" title="고객 관리" desc={`함께하고 있는 ${rows.length}곳의 고객을 관리합니다.`} action={<button className="btn primary" onClick={()=>setOpen(true)}><Plus/> 고객 등록</button>}/>
    <article className="panel table-panel"><Toolbar search={search} setSearch={setSearch}><button className="btn ghost"><ChevronDown/> 상태: 전체</button><button className="btn ghost"><Download/> 내보내기</button></Toolbar>
      <div className="table-scroll"><table><thead><tr><th>고객 / 회사명</th><th>담당자</th><th>연락처</th><th>프로젝트</th><th>키워드</th><th>상태</th><th>등록일</th><th></th></tr></thead><tbody>{filtered.map(r=><tr key={r.id}><td><div className="client-cell"><div className="client-logo">{r.companyName.slice(0,1)}</div><div><b>{r.companyName}</b><span>{r.email}</span></div></div></td><td>{r.managerName}</td><td>{r.phone||"—"}</td><td><b>{r.projectCount}</b>개</td><td><b>{r.keywordCount}</b>개</td><td><span className="status active-dot">{r.status}</span></td><td className="muted">{fmt(r.createdAt)}</td><td><MoreHorizontal/></td></tr>)}</tbody></table></div>
      <div className="table-foot"><span>총 {filtered.length}명의 고객</span><div><button disabled>이전</button><button className="active">1</button><button disabled>다음</button></div></div>
    </article>{open&&<CustomerForm close={()=>setOpen(false)} saved={()=>{setOpen(false);load();setToast("새 고객이 등록되었습니다.")}}/>}</>
}
function CustomerForm({close,saved}:{close:()=>void;saved:()=>void}){
  const submit=async(e:React.FormEvent<HTMLFormElement>)=>{e.preventDefault();const x=Object.fromEntries(new FormData(e.currentTarget));await request("/customers",{method:"POST",body:JSON.stringify(x)});saved()};
  return <Modal title="새 고객 등록" onClose={close}><form onSubmit={submit}><div className="form-grid"><label className="full">회사명<input name="companyName" required placeholder="예: 로부르컴퍼니"/></label><label>고객명<input name="name" required placeholder="이름"/></label><label>담당자명<input name="managerName" placeholder="담당자"/></label><label>연락처<input name="phone" placeholder="010-0000-0000"/></label><label>이메일<input name="email" type="email" placeholder="name@company.com"/></label><label className="full">메모<textarea name="memo" placeholder="고객 관련 메모를 남겨주세요."/></label></div><div className="modal-foot"><button type="button" className="btn ghost" onClick={close}>취소</button><button className="btn primary">고객 등록</button></div></form></Modal>
}
function Projects({setToast}:{setToast:(s:string)=>void}){
  const [rows,setRows]=useState<AnyRow[]>([]),[customers,setCustomers]=useState<AnyRow[]>([]),[search,setSearch]=useState(""),[open,setOpen]=useState(false);
  const load=()=>Promise.all([request("/projects"),request("/customers")]).then(([p,c])=>{setRows(p);setCustomers(c)});useEffect(()=>{load()},[]);
  const filtered=rows.filter(r=>(r.name+r.customerName).toLowerCase().includes(search.toLowerCase()));
  return <><PageHead kicker="PROJECTS" title="프로젝트 관리" desc="고객별 마케팅 프로젝트와 진행 상태를 관리합니다." action={<button className="btn primary" onClick={()=>setOpen(true)}><Plus/> 프로젝트 등록</button>}/>
    <div className="project-summary"><div><span>전체 프로젝트</span><b>{rows.length}</b></div><div><span>진행중</span><b className="green-text">{rows.filter(x=>x.status==="진행중").length}</b></div><div><span>이번 달 종료</span><b>2</b></div><div><span>담당 직원</span><b>2</b></div></div>
    <article className="panel table-panel"><Toolbar search={search} setSearch={setSearch}><button className="btn ghost"><ChevronDown/> 상품 유형</button><button className="btn ghost"><ChevronDown/> 진행 상태</button></Toolbar>
      <div className="table-scroll"><table><thead><tr><th>프로젝트명</th><th>고객</th><th>상품 유형</th><th>기간</th><th>담당자</th><th>키워드</th><th>상태</th><th></th></tr></thead><tbody>{filtered.map(r=><tr key={r.id}><td><div className="keyword-cell"><span className={`service-icon ${r.serviceType.toLowerCase()}`}>{r.serviceType==="GOOGLE_SEO"?"G":"N"}</span><b>{r.name}</b></div></td><td>{r.customerName}</td><td><span className="tag">{serviceLabel[r.serviceType]}</span></td><td className="muted">{fmt(r.startDate)} – {fmt(r.endDate)}</td><td>{r.manager||"미지정"}</td><td><b>{r.keywordCount}</b>개</td><td><span className="status active-dot">{r.status}</span></td><td><MoreHorizontal/></td></tr>)}</tbody></table></div></article>
    {open&&<ProjectForm customers={customers} close={()=>setOpen(false)} saved={()=>{setOpen(false);load();setToast("프로젝트가 등록되었습니다.")}}/>}</>
}
function ProjectForm({customers,close,saved}:{customers:AnyRow[];close:()=>void;saved:()=>void}){
  const submit=async(e:React.FormEvent<HTMLFormElement>)=>{e.preventDefault();const x=Object.fromEntries(new FormData(e.currentTarget));await request("/projects",{method:"POST",body:JSON.stringify(x)});saved()};
  return <Modal title="새 프로젝트 등록" onClose={close}><form onSubmit={submit}><div className="form-grid"><label className="full">고객 선택<select name="customerId" required><option value="">고객을 선택하세요</option>{customers.map(c=><option key={c.id} value={c.id}>{c.companyName}</option>)}</select></label><label className="full">프로젝트명<input name="name" required placeholder="예: 7월 블로그 상위노출"/></label><label>상품 유형<select name="serviceType"><option value="BLOG">네이버 블로그</option><option value="CAFE">네이버 카페</option><option value="POWERLINK">파워링크</option><option value="GOOGLE_SEO">구글 SEO</option></select></label><label>담당자<input name="manager" placeholder="담당 직원"/></label><label>시작일<input name="startDate" type="date"/></label><label>종료 예정일<input name="endDate" type="date"/></label></div><div className="modal-foot"><button type="button" className="btn ghost" onClick={close}>취소</button><button className="btn primary">프로젝트 등록</button></div></form></Modal>
}
function Keywords({setToast,detail,setDetail}:{setToast:(s:string)=>void;detail:AnyRow|null;setDetail:(r:AnyRow|null)=>void}){
  const [rows,setRows]=useState<AnyRow[]>([]),[projects,setProjects]=useState<AnyRow[]>([]),[providerStatus,setProviderStatus]=useState<any>(null),[search,setSearch]=useState(""),[status,setStatus]=useState(""),[open,setOpen]=useState(false),[checking,setChecking]=useState<number|null>(null);
  const load=()=>Promise.all([request(`/keywords?q=${encodeURIComponent(search)}&status=${status}`),request("/projects")]).then(([k,p])=>{setRows(k);setProjects(p)});
  useEffect(()=>{load()},[search,status]);
  useEffect(()=>{request("/providers/status").then(setProviderStatus)},[]);
  const check=async(id:number)=>{setChecking(id);try{await request(`/keywords/${id}/check`,{method:"POST"});setToast("최신 순위를 수집했습니다.");load()}catch(e:any){setToast(e.message)}finally{setChecking(null)}};
  if(detail)return <KeywordDetail row={detail} close={()=>setDetail(null)} check={check}/>;
  return <><PageHead kicker="RANK TRACKING" title="키워드 & 순위 현황" desc={`총 ${rows.length}개 키워드의 검색 순위를 추적하고 있습니다.`} action={<><button className="btn ghost"><Download/> 엑셀 다운로드</button><button className="btn primary" onClick={()=>setOpen(true)}><Plus/> 키워드 등록</button></>}/>
    {providerStatus && <div className={`provider-banner ${providerStatus.naverBlog.configured?"ready":"needs-key"}`}>
      <div>{providerStatus.naverBlog.configured?<Check/>:<AlertTriangle/>}<span><b>네이버 블로그 실검색</b>{providerStatus.naverBlog.configured
        ? `연결됨 · ${providerStatus.naverBlog.mode==="NAVER_API_HUB"?"NAVER API HUB":providerStatus.naverBlog.mode==="NAVER_DEVELOPERS_LEGACY"?"기존 Developers API":"공개 블로그 검색"} · ${providerStatus.naverBlog.note||""}`
        : "API 키 설정이 필요합니다. 키가 없으면 네이버 블로그 순위를 임의 생성하지 않습니다."}</span></div>
      <span className="provider-pill">{providerStatus.naverBlog.configured?"REAL DATA":"SETUP REQUIRED"}</span>
    </div>}
    <article className="panel table-panel"><Toolbar search={search} setSearch={setSearch}><select className="filter-select" value={status} onChange={e=>setStatus(e.target.value)}><option value="">상태: 전체</option><option value="UP">상승</option><option value="DOWN">하락</option><option value="SAME">유지</option><option value="NOT_FOUND">미노출</option></select><button className="btn ghost" onClick={()=>Promise.all(rows.map(r=>check(r.id)))}><RefreshCw/> 전체 수집</button></Toolbar>
      <div className="table-scroll"><table className="keyword-table"><thead><tr><th><input type="checkbox"/></th><th>키워드 / URL</th><th>고객 / 프로젝트</th><th>검색 엔진</th><th>현재</th><th>어제</th><th>변화</th><th>목표</th><th>최근 수집</th><th>관리</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td><input type="checkbox"/></td><td><button className="link-cell" onClick={()=>setDetail(r)}><b>{r.keyword}</b><span>{r.targetUrl.replace(/^https?:\/\//,"")}</span></button></td><td><div className="two-line"><b>{r.customerName}</b><span>{r.projectName}</span></div></td><td><span className="engine"><i className={r.searchEngine==="GOOGLE"?"google":""}>{r.searchEngine==="GOOGLE"?"G":"N"}</i>{serviceLabel[r.serviceType]}</span></td><td className="rank">{r.currentRank?`${r.currentRank}위`:<span className="not-found">미노출</span>}</td><td>{r.previousRank?`${r.previousRank}위`:"—"}</td><td><Status value={r.status} rank={r.currentRank} previous={r.previousRank}/></td><td>{r.targetRank}위</td><td className="muted">{r.lastCheckedAt?fmt(r.lastCheckedAt):"수집 전"}</td><td><button className="mini-action" disabled={checking===r.id} onClick={()=>check(r.id)}>{checking===r.id?<RefreshCw className="spin"/>:<RefreshCw/>}</button><button className="mini-action"><MoreHorizontal/></button></td></tr>)}</tbody></table></div>
      <div className="table-foot"><span>총 {rows.length}개의 키워드</span><div><button disabled>이전</button><button className="active">1</button><button disabled>다음</button></div></div>
    </article>{open&&<KeywordForm projects={projects} close={()=>setOpen(false)} saved={()=>{setOpen(false);load();setToast("추적 키워드가 등록되었습니다.")}}/>}</>
}
function KeywordForm({projects,close,saved}:{projects:AnyRow[];close:()=>void;saved:()=>void}){
  const [error,setError]=useState("");
  const submit=async(e:React.FormEvent<HTMLFormElement>)=>{e.preventDefault();setError("");try{const x=Object.fromEntries(new FormData(e.currentTarget));await request("/keywords",{method:"POST",body:JSON.stringify(x)});saved()}catch(e:any){setError(e.message)}};
  return <Modal title="추적 키워드 등록" onClose={close}><form onSubmit={submit}><div className="form-grid"><label className="full">프로젝트<select name="projectId" required><option value="">프로젝트를 선택하세요</option>{projects.map(p=><option key={p.id} value={p.id}>{p.customerName} · {p.name}</option>)}</select></label><label className="full">키워드<input name="keyword" required placeholder="추적할 검색 키워드"/></label><label className="full">추적 URL<div className="input-icon"><Link2/><input name="targetUrl" required placeholder="https://"/></div></label><label>검색 엔진<select name="searchEngine"><option value="NAVER_BLOG">네이버 블로그</option><option value="NAVER_CAFE">네이버 카페</option><option value="NAVER_POWERLINK">네이버 파워링크</option><option value="GOOGLE">구글</option></select></label><label>URL 매칭<select name="matchType"><option value="EXACT">정확한 URL</option><option value="DOMAIN">도메인 포함</option><option value="PATH">경로 포함</option></select></label><label>디바이스<select name="device"><option>PC</option><option>모바일</option></select></label><label>목표 순위<input name="targetRank" type="number" min="1" max="100" defaultValue="10"/></label></div>{error&&<div className="form-error"><AlertTriangle/>{error}</div>}<div className="modal-foot"><button type="button" className="btn ghost" onClick={close}>취소</button><button className="btn primary">키워드 등록</button></div></form></Modal>
}
function KeywordDetail({row,close,check}:{row:AnyRow;close:()=>void;check:(id:number)=>void}){
  const [history,setHistory]=useState<AnyRow[]>([]);useEffect(()=>{request(`/keywords/${row.id}/history`).then(setHistory)},[row.id]);
  return <><button className="back-link" onClick={close}>← 키워드 목록</button><PageHead kicker={`${row.customerName} · ${row.projectName}`} title={row.keyword} desc={row.targetUrl} action={<button className="btn primary" onClick={()=>check(row.id)}><RefreshCw/> 순위 확인</button>}/>
    <section className="detail-metrics">{[["현재 순위",row.currentRank?`${row.currentRank}위`:"미노출",Target],["어제 순위",row.previousRank?`${row.previousRank}위`:"—",Clock3],["최고 순위",row.bestRank?`${row.bestRank}위`:"—",Sparkles],["최초 순위",row.firstRank?`${row.firstRank}위`:"—",CalendarDays]].map(([l,v,I]:any)=><div><I/><span>{l}</span><b>{v}</b></div>)}</section>
    <article className="panel chart-panel detail-chart"><div className="panel-head"><div><h3>순위 변화</h3><p>최근 30일 검색 순위 이력</p></div><span className="tag">최근 30일</span></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><LineChart data={history} margin={{top:10,right:12,left:-18,bottom:0}}><CartesianGrid strokeDasharray="4 5" vertical={false} stroke="#edf0f5"/><XAxis dataKey="checkedAt" tickFormatter={fmt} axisLine={false} tickLine={false}/><YAxis reversed domain={[1,50]} axisLine={false} tickLine={false}/><Tooltip formatter={(v:any)=>[`${v}위`,"순위"]} labelFormatter={fmt}/><Line connectNulls={false} type="monotone" dataKey="rank" stroke="#4f63d9" strokeWidth={3} dot={{r:3,fill:"#fff",strokeWidth:2}}/></LineChart></ResponsiveContainer></div></article>
    <div className="detail-grid"><article className="panel info-card"><h3>추적 설정</h3><div><span>검색 엔진</span><b>{serviceLabel[row.serviceType]}</b></div><div><span>디바이스</span><b>{row.device}</b></div><div><span>지역</span><b>{row.region}</b></div><div><span>목표 순위</span><b>{row.targetRank}위</b></div><div><span>URL 매칭</span><b>{row.matchType}</b></div></article><article className="panel memo-card"><h3>작업 메모</h3><textarea placeholder="키워드 관련 작업 내용을 기록하세요..."/><button className="btn primary">메모 저장</button></article></div>
  </>
}
function Notifications(){
  const items=[["목표 순위 달성","‘개인회생 상담’ 키워드가 목표 5위에 진입했습니다.","방금 전","up"],["순위 급상승","‘플라스틱 프로텍트’가 8단계 상승했습니다.","18분 전","up"],["미노출 발생","‘창업 아이템’ 키워드가 검색 결과에서 확인되지 않습니다.","1시간 전","warn"],["일일 수집 완료","오늘 등록된 키워드 8개의 순위 수집이 완료되었습니다.","2시간 전","done"]];
  return <><PageHead kicker="NOTIFICATIONS" title="알림" desc="순위 변화와 수집 상태를 빠르게 확인하세요." action={<button className="btn ghost"><Check/> 모두 읽음</button>}/><article className="panel notification-list">{items.map((x,i)=><div className={!i?"unread":""}><div className={`noti-icon ${x[3]}`}>{x[3]==="warn"?<AlertTriangle/>:<Bell/>}</div><div><b>{x[0]}</b><p>{x[1]}</p><span>{x[2]}</span></div><MoreHorizontal/></div>)}</article></>
}
function SettingsPage({setToast}:{setToast:(s:string)=>void}){
  const [tab,setTab]=useState("기본 설정");
  return <><PageHead kicker="SETTINGS" title="설정" desc="워크스페이스의 수집 및 리포트 기본값을 관리합니다."/><div className="settings-layout"><aside>{["기본 설정","검색 설정","권한 설정","리포트 설정"].map(x=><button className={tab===x?"active":""} onClick={()=>setTab(x)}>{x}</button>)}</aside><article className="panel settings-card"><h3>{tab}</h3><p>모든 새 프로젝트에 적용되는 기본값입니다.</p><div className="form-grid"><label className="full">회사명<input defaultValue="로부르컴퍼니"/></label><label>기본 수집 시간<input type="time" defaultValue="09:00"/></label><label>기본 수집 주기<select><option>매일 1회</option><option>매일 2회</option><option>수동 확인</option></select></label><label>기본 목표 순위<input type="number" defaultValue="10"/></label><label>최대 검색 순위<select><option>100위</option><option>50위</option><option>30위</option></select></label></div><div className="settings-foot"><button className="btn primary" onClick={()=>setToast("설정이 저장되었습니다.")}>변경사항 저장</button></div></article></div></>
}
function Coming({page,desc,icon:Icon}:{page:string;desc:string;icon:any}){
  return <><PageHead kicker="COMING NEXT" title={page} desc={desc}/><article className="panel"><Empty icon={Icon} title={`${page} 기능 준비 중`} desc="MVP 핵심 기능을 먼저 단단히 만든 뒤 이어서 연결할 영역입니다."/></article></>
}
createRoot(document.getElementById("root")!).render(<React.StrictMode><App/></React.StrictMode>);
