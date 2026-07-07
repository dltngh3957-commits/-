import json
import re
import sys
import time
from html import unescape
from urllib.parse import parse_qs, quote_plus, unquote, urlparse
from urllib.request import Request, urlopen


def normalize_url(value):
    if not value:
        return ""
    value = unescape(str(value).strip())
    if value.startswith("/url?"):
        query = parse_qs(urlparse(value).query)
        value = query.get("q", [value])[0]
    try:
        parsed = urlparse(value if re.match(r"^https?://", value, re.I) else "https://" + value)
        host = (parsed.netloc or "").lower()
        if host.startswith("www."):
            host = host[4:]
        path = unquote(parsed.path or "").rstrip("/")
        return f"{host}{path}".lower()
    except Exception:
        return re.sub(r"[?#].*$", "", value).replace("https://", "").replace("http://", "").replace("www.", "").rstrip("/").lower()


def matches(result_url, target_url, match_type):
    result = normalize_url(result_url)
    target = normalize_url(target_url)
    if not result or not target:
        return False
    if match_type == "DOMAIN":
        return result.split("/")[0] == target.split("/")[0]
    if match_type == "PATH":
        return result.startswith(target) or target.startswith(result) or target in result
    return result == target


def extract_results(html):
    urls = []
    seen = set()
    html = html.replace("\\u003d", "=").replace("\\u0026", "&").replace("\\/", "/")

    # Classic Google result links are often exposed as /url?q=https://...
    # Some result pages use variants like /url?esrc=s&q=https://...
    for raw in re.findall(r'href="(/url\?[^"]+)"', html):
        query = parse_qs(urlparse(unescape(raw)).query)
        url = query.get("q", query.get("url", [""]))[0]
        host = urlparse(url).netloc.lower()
        if not url.startswith("http") or "google." in host:
            continue
        key = normalize_url(url)
        if key and key not in seen:
            seen.add(key)
            urls.append(url)

    # Some modern result pages expose direct http links.
    for raw in re.findall(r'href="(https?://[^"]+)"', html):
        url = unescape(raw)
        host = urlparse(url).netloc.lower()
        if "google." in host or "gstatic." in host or "schema.org" in host:
            continue
        key = normalize_url(url)
        if key and key not in seen:
            seen.add(key)
            urls.append(url)

    # Fallback for script-packed result data.
    for raw in re.findall(r'https?://[^\s"\'<>]+', html):
        url = unescape(raw).rstrip("\\);,]")
        host = urlparse(url).netloc.lower()
        if "google." in host or "gstatic." in host or "schema.org" in host:
            continue
        key = normalize_url(url)
        if key and key not in seen:
            seen.add(key)
            urls.append(url)

    return urls


def main():
    started = time.time()
    if len(sys.argv) < 3:
        print(json.dumps({"success": False, "errorMessage": "keyword and targetUrl are required", "durationMs": 0}, ensure_ascii=False))
        return

    keyword = sys.argv[1]
    target_url = sys.argv[2]
    match_type = sys.argv[3] if len(sys.argv) > 3 else "EXACT"
    encoded_keyword = quote_plus(keyword)
    urls_to_try = [
        "https://www.google.com/search?q=%s&num=100&hl=ko&gl=kr&pws=0&filter=0" % encoded_keyword,
        "https://www.google.com/search?q=%s&num=100&hl=ko&gl=kr&pws=0&filter=0&igu=1" % encoded_keyword,
        "https://www.google.com/search?q=%s&num=100&hl=ko&gl=kr&pws=0&filter=0&gbv=1" % encoded_keyword,
        "https://www.google.com/search?q=%s&num=100&hl=ko&gl=kr&pws=0&filter=0&udm=14" % encoded_keyword,
        "https://www.google.co.kr/search?q=%s&num=100&hl=ko&gl=kr&pws=0&filter=0&gbv=1" % encoded_keyword,
    ]

    html = ""
    last_error = None
    for url in urls_to_try:
        req = Request(url, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
            "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
        })
        try:
            with urlopen(req, timeout=20) as res:
                html = res.read().decode("utf-8", errors="ignore")
            if extract_results(html):
                break
        except Exception as exc:
            last_error = exc

    if not html:
        print(json.dumps({
            "success": False,
            "errorMessage": "Google 검색 결과를 가져오지 못했습니다: %s" % str(last_error),
            "durationMs": int((time.time() - started) * 1000),
        }, ensure_ascii=False))
        return

    if "Our systems have detected unusual traffic" in html or "/sorry/" in html:
        print(json.dumps({
            "success": False,
            "errorMessage": "Google 봇 탐지 화면이 떠서 순위를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.",
            "durationMs": int((time.time() - started) * 1000),
        }, ensure_ascii=False))
        return

    results = extract_results(html)[:100]
    if not results:
        title = re.search(r"<title>(.*?)</title>", html, re.I | re.S)
        page_title = re.sub(r"\s+", " ", unescape(title.group(1))).strip() if title else "unknown page"
        print(json.dumps({
            "success": False,
            "errorMessage": "Google 검색 결과 URL을 읽지 못했습니다. 받은 화면: %s. 정확한 Google 순위 확인은 SERPAPI_KEY 설정을 권장합니다." % page_title,
            "durationMs": int((time.time() - started) * 1000),
        }, ensure_ascii=False))
        return

    rank = None
    result_url = None
    for idx, result in enumerate(results, start=1):
        if matches(result, target_url, match_type):
            rank = idx
            result_url = result
            break

    print(json.dumps({
        "success": True,
        "rank": rank,
        "found": rank is not None,
        "resultUrl": result_url,
        "durationMs": int((time.time() - started) * 1000),
        "provider": "GooglePublicSearchProvider",
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
