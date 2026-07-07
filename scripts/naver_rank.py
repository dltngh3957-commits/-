import html
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request


def normalize_url(value: str) -> str:
    try:
        parsed = urllib.parse.urlparse(value)
        host = parsed.hostname.lower().removeprefix("m.") if parsed.hostname else ""
        query = urllib.parse.parse_qs(parsed.query)
        if parsed.path.lower().endswith("/postview.naver"):
            blog_id = query.get("blogId", [None])[0]
            log_no = query.get("logNo", [None])[0]
            if blog_id and log_no:
                return f"blog.naver.com/{blog_id}/{log_no}".lower()
        return f"{host}{urllib.parse.unquote(parsed.path)}".rstrip("/").lower()
    except Exception:
        return value.removeprefix("https://").removeprefix("http://").removeprefix("m.").split("?", 1)[0].rstrip("/").lower()


def matches(result_url: str, target_url: str, match_type: str) -> bool:
    result = normalize_url(result_url)
    target = normalize_url(target_url)
    target_parts = target.split("/")
    if target_parts[0] == "blog.naver.com" and len(target_parts) == 2:
        return result.startswith(f"{target}/")
    if match_type == "DOMAIN":
        return result.split("/")[0] == target.split("/")[0]
    if match_type == "PATH":
        return result in target or target in result
    return result == target


def main() -> None:
    started = time.time()
    keyword, target_url, match_type = sys.argv[1:4]
    # 로부르인덱스의 BLOG 기준은 별도 블로그 탭이 아니라
    # 네이버 PC 통합검색에 노출되는 블로그 영역의 게시물 순서다.
    url = "https://search.naver.com/search.naver?" + urllib.parse.urlencode(
        {"query": keyword}
    )
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
            "Accept-Language": "ko-KR,ko;q=0.9",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            body = response.read().decode("utf-8", "ignore")
        decoded = html.unescape(body).replace("\\/", "/").replace("\\u002F", "/")
        pattern = re.compile(
            r"https?://(?:m\.)?blog\.naver\.com/([A-Za-z0-9_.-]+)/(\d{6,})",
            re.IGNORECASE,
        )
        result_urls: list[str] = []
        seen: set[str] = set()
        for blog_id, log_no in pattern.findall(decoded):
            canonical = f"https://blog.naver.com/{blog_id}/{log_no}"
            normalized = normalize_url(canonical)
            if normalized not in seen:
                seen.add(normalized)
                result_urls.append(canonical)
        if not result_urls:
            raise RuntimeError("네이버 검색 결과 구조를 분석하지 못했습니다.")
        index = next(
            (i for i, result_url in enumerate(result_urls) if matches(result_url, target_url, match_type)),
            -1,
        )
        found = index >= 0
        result = {
            "success": True,
            "rank": index + 1 if found else None,
            "found": found,
            "resultUrl": result_urls[index] if found else None,
            "resultTitle": keyword if found else None,
            "durationMs": round((time.time() - started) * 1000),
            "provider": "NaverPythonPublicSearchProvider",
            "resultCount": len(result_urls),
        }
    except urllib.error.HTTPError as error:
        result = {
            "success": False,
            "errorMessage": f"네이버 공개검색 응답 오류 ({error.code})",
            "durationMs": round((time.time() - started) * 1000),
        }
    except Exception as error:
        result = {
            "success": False,
            "errorMessage": str(error),
            "durationMs": round((time.time() - started) * 1000),
        }
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
