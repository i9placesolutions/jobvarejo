// Seleção dos efeitos desenhados a processar: desenhados (2D/cartoon/anime/quadrinhos) sobre fundo sólido,
// sem texto em inglês, preços em dólar, balões de fala vazios ou padrões de fundo.
// Uso: node select.mjs <harvest.json> <selected.json>
import fs from 'node:fs/promises'
const [input, output] = process.argv.slice(2)
const all = JSON.parse(await fs.readFile(input, 'utf8'))
const drawn = /2d|cartoon|desenh|anime|mangá|manga|quadrinh|comic|hand.?drawn|à mão|onomatop|estilo plano|flat/i
const solid = /fundo (preto|verde|escuro|branco|transparente)|black background|green screen|tela verde|alfa|alpha|isolad|chroma/i
const drop = /\$|dólar|dollar|lol|#hi|balão de (fala|pensamento|diálogo)|bolha de (fala|pensamento)|speech|thought|padrão|pattern|plano de fundo|wallpaper|dorm|zzz|sono|emoji|rosto|face|coração|heart|texto|letra|palavra|word|hello|olá|love|amor|natal|christmas|halloween|páscoa|easter/i
const order = ['transicao', 'explosao', 'fogo', 'fumaca', 'energia', 'eletricidade', 'faiscas', 'liquido', 'linhas', 'comic']
const picked = all.filter(x => drawn.test(x.title) && solid.test(x.title) && !drop.test(x.title))
  .map(x => ({ ...x, category: order.find(c => x.cats.includes(c)) || x.cats[0] }))
await fs.writeFile(output, JSON.stringify(picked, null, 1))
const per = {}; for (const x of picked) per[x.category] = (per[x.category] || 0) + 1
console.log(picked.length, per)
