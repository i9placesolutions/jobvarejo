import json, sys
from num2words import num2words
from re import sub, escape, IGNORECASE

def normalize(text, pronunciations=None):
    for item in sorted(pronunciations or [], key=lambda x: -len(x['from'])):
        text = sub(r'(?<!\w)' + escape(item['from']) + r'(?!\w)', lambda m: item['to'], text, flags=IGNORECASE)
    # Orthography belongs to spoken text only; product labels stay untouched.
    retail_words = {
        'abobora': 'abóbora', 'cabotia': 'cabotiá', 'cabotiã': 'cabotiá',
        'acucar': 'açúcar', 'mamao': 'mamão',
        'limao': 'limão', 'pao': 'pão', 'linguica': 'linguiça',
        'file': 'filé', 'pessego': 'pêssego', 'brocolis': 'brócolis',
        'requeijao': 'requeijão', 'mucarela': 'muçarela',
        'suina': 'suína', 'suino': 'suíno', 'acougue': 'açougue',
    }
    for written, spoken in retail_words.items():
        text = sub(r'(?<!\w)' + escape(written) + r'(?!\w)', spoken, text, flags=IGNORECASE)
    # Shouted product names are ordinary words, not sequences of initials.
    text = sub(r'(?<!\w)[^\W\d_]+(?!\w)', lambda m: m.group(0).lower() if m.group(0).isupper() and (len(m.group(0)) > 1 or m.group(0) == 'E') else m.group(0), text)
    text = sub(r',(?=[^\W\d_])', ', ', text)
    # Retail shorthand in offer names must become natural Portuguese before TTS.
    text = sub(r'(?<!\w)c/\s*', 'com ', text, flags=IGNORECASE)
    text = sub(r'(?<!\w)s/\s*', 'sem ', text, flags=IGNORECASE)
    text = sub(r'&', ' e ', text)
    text = sub(r'%', ' por cento', text)
    text = sub(r'\+', ' mais ', text)
    def money(m):
        raw = m.group(1).replace('.', '').replace(',', '.')
        cents = round(float(raw) * 100)
        reais, rest = divmod(cents, 100)
        parts = []
        if reais: parts.append(num2words(reais, lang='pt_BR') + (' real' if reais == 1 else ' reais'))
        if rest: parts.append(num2words(rest, lang='pt_BR') + (' centavo' if rest == 1 else ' centavos'))
        return ' e '.join(parts) or 'zero reais'
    text = sub(r'R\$\s*((?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{1,2})?)', money, text, flags=IGNORECASE)
    text = sub(r'/\s*kg\b', ' o quilo', text, flags=IGNORECASE)
    text = sub(r'/\s*un\b', ' a unidade', text, flags=IGNORECASE)
    units = {'kg': ('quilo','quilos',False), 'g': ('grama','gramas',False), 'ml': ('mililitro','mililitros',False), 'l': ('litro','litros',False), 'un': ('unidade','unidades',True), 'und': ('unidade','unidades',True), 'unid': ('unidade','unidades',True), 'pct': ('pacote','pacotes',False), 'pcte': ('pacote','pacotes',False), 'cx': ('caixa','caixas',True), 'dz': ('dúzia','dúzias',True)}
    def measure(m):
        number = float(m.group(1).replace(',','.'))
        singular, plural, feminine = units[m.group(2).lower()]
        if number == 1.5 and m.group(2).lower() in ('l','kg'): return 'um ' + singular + ' e meio'
        spoken = num2words(int(number) if number.is_integer() else number, lang='pt_BR')
        if feminine and number.is_integer():
            spoken = sub(r'\bum$', 'uma', spoken) if int(number) % 10 == 1 and int(number) % 100 != 11 else spoken
            spoken = sub(r'\bdois$', 'duas', spoken) if int(number) % 10 == 2 and int(number) % 100 != 12 else spoken
        return spoken + ' ' + (singular if number == 1 else plural)
    text = sub(r'\b(\d+(?:,\d+)?)\s*(kg|ml|unid|und|un|pcte|pct|cx|dz|g|l)\b', measure, text, flags=IGNORECASE)
    # A two-decimal amount without R$ in an offer is still a price.
    text = sub(r'(?<![\w,])(\d+(?:\.\d{3})*,\d{2})(?!\w)', money, text)
    for abbreviation, spoken in {'kg': 'o quilo', 'g': 'o grama', 'ml': 'o mililitro', 'l': 'o litro', 'un': 'a unidade', 'und': 'a unidade', 'unid': 'a unidade', 'pct': 'o pacote', 'pcte': 'o pacote', 'cx': 'a caixa', 'dz': 'a dúzia'}.items():
        text = sub(r'\b' + abbreviation + r'\b', spoken, text, flags=IGNORECASE)
    months = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']
    def date(m):
        day, month = int(m.group(1)), int(m.group(2))
        if not 1 <= day <= 31 or not 1 <= month <= 12: raise ValueError('Confira a data do roteiro.')
        return ('primeiro' if day == 1 else num2words(day, lang='pt_BR')) + ' de ' + months[month-1] + (' de ' + num2words(int(m.group(3)), lang='pt_BR') if m.group(3) else '')
    text = sub(r'\b(\d{1,2})/(\d{1,2})(?:/(\d{4}))?\b', date, text)
    # Quantidades e limites que não fazem parte de moeda, medida ou data.
    text = sub(r'(?<![\w])\d+(?:,\d+)?(?![\w])', lambda m: num2words(float(m.group(0).replace(',', '.')) if ',' in m.group(0) else int(m.group(0)), lang='pt_BR'), text)
    return sub(r'\s+', ' ', text).strip()

if __name__ == '__main__':
    data = json.load(sys.stdin)
    print(json.dumps({'scripts': [{'id': x['id'], 'text': normalize(x['text'], data.get('pronunciations'))} for x in data['scripts']]}, ensure_ascii=False))
