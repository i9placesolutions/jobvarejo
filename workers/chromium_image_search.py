"""Bing Images com fallback Google via Chromium. Não contorna CAPTCHA ou bloqueios."""
import json
import os
import re
import unicodedata
import sys
from urllib.parse import quote, urlparse, parse_qs
from urllib.request import Request, urlopen
from playwright.sync_api import sync_playwright

RETAILER_DOMAINS = ("atacadao.com.br", "bretas.com.br", "carrefour.com.br", "paodeacucar.com")


def query_tokens(value):
    value = unicodedata.normalize('NFD', value.lower())
    return set(re.findall(r'[a-z0-9]+', ''.join(c for c in value if not unicodedata.combining(c)))) - {'de', 'do', 'da', 'sabores', 'sabor', 'produto', 'imagem'}


def relevant_candidates(results, query):
    requested = query_tokens(query)
    if not requested:
        return []
    return [item for item in results if len(requested & query_tokens(' '.join(str(item.get(k, '')) for k in ('title', 'source', 'url')))) / len(requested) >= 0.5]


def search_retailer_catalog(query, limit=10):
    """Catálogo público: fallback independente de páginas de busca bloqueadas."""
    cleaned = re.sub(r'\b(sabores|sortidos|diversos)\b', '', query, flags=re.I)
    cleaned = re.sub(r'\bsalgadinhos\b', 'salgadinho', cleaned, flags=re.I)
    requested = {t.rstrip('s') for t in query_tokens(cleaned) if not t.isdigit()}
    sizes = set(re.findall(r'\b\d+(?:[.,]\d+)?\s*(?:kg|ml|g|l)\b', cleaned.lower()))
    result = []
    try:
        request = Request('https://www.bretas.com.br/api/catalog_system/pub/products/search?ft=' + quote(cleaned.strip()), headers={'Accept': 'application/json'})
        with urlopen(request, timeout=8) as response:
            products = json.load(response)
        if not isinstance(products, list):
            return []
        for product in products:
            title = str(product.get('productName', ''))
            tokens = {t.rstrip('s') for t in query_tokens(title)}
            if not requested or len(requested & tokens) / len(requested) < 0.6:
                continue
            title_sizes = set(re.findall(r'\b\d+(?:[.,]\d+)?\s*(?:kg|ml|g|l)\b', title.lower()))
            if sizes and not {v.replace(' ', '') for v in sizes}.issubset({v.replace(' ', '') for v in title_sizes}):
                continue
            for item in product.get('items', []):
                for image in item.get('images', [])[:1]:
                    url = image.get('imageUrl', '')
                    if urlparse(url).scheme == 'https':
                        result.append({'url': url, 'title': title, 'source': product.get('link', ''), 'provider': 'bretas-catalog', 'retailer': 'bretas.com.br'})
        return result[:limit]
    except (OSError, ValueError, TypeError):
        return []


def search_images(query, limit=10):
    catalog = search_retailer_catalog(query, limit)
    if catalog:
        return catalog
    with sync_playwright() as p:
        options = {'headless': True}
        if os.environ.get('CHROMIUM_EXECUTABLE_PATH'):
            options['executable_path'] = os.environ['CHROMIUM_EXECUTABLE_PATH']
        browser = p.chromium.launch(**options)
        try:
            page = browser.new_page(locale='pt-BR')
            results = []
            seen_bing = set()
            retailer_query = query + ' (' + ' OR '.join('site:' + domain for domain in RETAILER_DOMAINS) + ')'
            for search_query in (retailer_query, query):
                try:
                    page.goto('https://www.bing.com/images/search?q=' + quote(search_query), wait_until='domcontentloaded', timeout=14000)
                    page.wait_for_selector('a.iusc[m]', timeout=5000)
                    cards = page.locator('a.iusc[m]').evaluate_all('(nodes) => nodes.map(n => n.getAttribute("m"))')
                    for raw in cards:
                        try:
                            card = json.loads(raw)
                            url = card.get('murl', '')
                            source = card.get('purl', '')
                            host = urlparse(source).hostname or ''
                            retailer = next((d for d in RETAILER_DOMAINS if host == d or host.endswith('.' + d)), None)
                            if search_query == retailer_query and not retailer:
                                continue
                            if urlparse(url).scheme not in ('http', 'https') or url in seen_bing:
                                continue
                            seen_bing.add(url)
                            results.append({'url': url, 'title': card.get('t', ''), 'source': source, 'provider': 'bing-chromium', 'retailer': retailer})
                        except (ValueError, TypeError):
                            continue
                except Exception:
                    continue
            results = relevant_candidates(results, query)
            if results:
                def tokens(value):
                    value = unicodedata.normalize('NFD', value.lower())
                    return set(re.findall(r'[a-z0-9]+', ''.join(c for c in value if not unicodedata.combining(c))))
                requested = tokens(query)
                # Catálogos não podem esconder uma marca encontrada na busca geral.
                results.sort(key=lambda item: (len(requested & tokens(item.get('title', ''))), bool(item.get('retailer'))), reverse=True)
                return results[:limit]
            page.goto('https://www.google.com/search?tbm=isch&q=' + quote(query), wait_until='domcontentloaded', timeout=25000)
            if '/sorry/' in page.url or page.locator('iframe[src*="recaptcha"]').count():
                raise RuntimeError('Bing não retornou resultados e Google bloqueou a consulta; tente novamente mais tarde.')
            page.wait_for_selector('img', timeout=10000)
            # As miniaturas abrem o painel com a imagem de origem.
            for img in page.locator('img').all()[:18]:
                try:
                    if (img.get_attribute('width') or '') == '1':
                        continue
                    img.click(timeout=700)
                except Exception:
                    pass
            entries = page.evaluate('''() => {
              const out = [];
              for (const a of document.querySelectorAll('a[href]')) {
                const u = new URL(a.href, location.href);
                const src = u.searchParams.get('imgurl');
                if (src) out.push({url:src, title:a.innerText || a.querySelector('img')?.alt || '', source:u.searchParams.get('imgrefurl') || ''});
              }
              for (const img of document.images) {
                if (img.src.startsWith('http') && !/gstatic|google\\.com|googleusercontent/.test(new URL(img.src).hostname))
                  out.push({url:img.src,title:img.alt,source:img.closest('a')?.href || '',imageWidth:img.naturalWidth,imageHeight:img.naturalHeight});
              }
              return out;
            }''')
            seen = set()
            result = []
            for entry in entries:
                if urlparse(entry['url']).scheme not in ('http', 'https') or entry['url'] in seen:
                    continue
                seen.add(entry['url'])
                result.append(entry)
            return result[:limit]
        finally:
            browser.close()


if __name__ == '__main__':
    try:
        print(json.dumps({'candidates': search_images(sys.argv[1])}))
    except Exception as exc:
        print(json.dumps({'candidates': [], 'error': str(exc)}))
        sys.exit(1)
