"""Bing Images com fallback Google via Chromium. Não contorna CAPTCHA ou bloqueios."""
import json
import os
import re
import unicodedata
import sys
from urllib.parse import quote, urlparse, parse_qs
from playwright.sync_api import sync_playwright

RETAILER_DOMAINS = ("atacadao.com.br", "bretas.com.br", "carrefour.com.br", "paodeacucar.com")


def search_images(query, limit=10):
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
