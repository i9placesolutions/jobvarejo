import json, sys
from num2words import num2words
from re import sub, escape, IGNORECASE

def normalize(text, pronunciations=None):
    for item in sorted(pronunciations or [], key=lambda x: -len(x['from'])):
        text = sub(r'(?<!\w)' + escape(item['from']) + r'(?!\w)', lambda m: item['to'], text, flags=IGNORECASE)
    def money(m):
        raw = m.group(1).replace('.', '').replace(',', '.')
        cents = round(float(raw) * 100)
        reais, rest = divmod(cents, 100)
        parts = []
        if reais: parts.append(num2words(reais, lang='pt_BR') + (' real' if reais == 1 else ' reais'))
        if rest: parts.append(num2words(rest, lang='pt_BR') + (' centavo' if rest == 1 else ' centavos'))
        return ' e '.join(parts) or 'zero reais'
    text = sub(r'R\$\s*((?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{1,2})?)', money, text)
    text = sub(r'/\s*kg\b', ' o quilo', text, flags=IGNORECASE)
    text = sub(r'/\s*un\b', ' a unidade', text, flags=IGNORECASE)
    units = {'kg': ('quilo','quilos'), 'g': ('grama','gramas'), 'ml': ('mililitro','mililitros'), 'l': ('litro','litros'), 'un': ('unidade','unidades')}
    def measure(m):
        number = float(m.group(1).replace(',','.'))
        singular, plural = units[m.group(2).lower()]
        if number == 1.5 and m.group(2).lower() in ('l','kg'): return 'um ' + singular + ' e meio'
        return num2words(int(number) if number.is_integer() else number, lang='pt_BR') + ' ' + (singular if number == 1 else plural)
    text = sub(r'\b(\d+(?:,\d+)?)\s*(kg|ml|un|g|l)\b', measure, text, flags=IGNORECASE)
    for abbreviation, spoken in {'kg': 'o quilo', 'un': 'a unidade', 'pct': 'o pacote'}.items():
        text = sub(r'\b' + abbreviation + r'\b', spoken, text, flags=IGNORECASE)
    months = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']
    def date(m):
        day, month = int(m.group(1)), int(m.group(2))
        if not 1 <= day <= 31 or not 1 <= month <= 12: raise ValueError('Confira a data do roteiro.')
        return ('primeiro' if day == 1 else num2words(day, lang='pt_BR')) + ' de ' + months[month-1] + (' de ' + num2words(int(m.group(3)), lang='pt_BR') if m.group(3) else '')
    text = sub(r'\b(\d{1,2})/(\d{1,2})(?:/(\d{4}))?\b', date, text)
    return sub(r'\s+', ' ', text).strip()

if __name__ == '__main__':
    data = json.load(sys.stdin)
    print(json.dumps({'scripts': [{'id': x['id'], 'text': normalize(x['text'], data.get('pronunciations'))} for x in data['scripts']]}, ensure_ascii=False))
