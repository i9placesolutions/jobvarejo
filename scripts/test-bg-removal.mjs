import sharp from 'sharp';
import { removeBackground } from '@imgly/background-removal-node';

async function testBgRemoval() {
    const url = 'https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png';
    console.log('Baixando imagem de teste...');
    const res = await fetch(url);
    if (!res.ok) {
        console.error('Falha ao baixar:', res.status);
        process.exit(1);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    console.log('Buffer:', buf.length, 'bytes');
    
    const resized = await sharp(buf).resize(400, 400, { fit: 'inside', withoutEnlargement: true }).png().toBuffer();
    console.log('Resized:', resized.length, 'bytes');
    
    const meta = await sharp(resized).metadata();
    console.log('Has alpha:', meta.hasAlpha, '| Format:', meta.format, '| Size:', meta.width, 'x', meta.height);
    
    console.log('Removendo fundo...');
    const blob = new Blob([resized], { type: 'image/png' });
    
    try {
        const result = await removeBackground(blob, {
            model: 'medium',
            output: { format: 'image/png', type: 'foreground', quality: 0.9 },
            progress: (key, cur, tot) => { if (cur === tot) console.log('  OK:', key); }
        });
        const rbBuf = Buffer.from(await result.arrayBuffer());
        console.log('Resultado:', rbBuf.length, 'bytes');
        
        const { data, info } = await sharp(rbBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        let transparent = 0, opaque = 0;
        const total = info.width * info.height;
        for (let i = 0; i < total; i++) {
            const a = data[i * 4 + 3];
            if (a < 8) transparent++;
            else if (a > 128) opaque++;
        }
        console.log('Transparente:', (transparent / total * 100).toFixed(1) + '%');
        console.log('Opaco:', (opaque / total * 100).toFixed(1) + '%');
        console.log(transparent > total * 0.1 ? '✅ BG REMOVIDO com sucesso' : '❌ BG NÃO foi removido');
    } catch (e) {
        console.error('❌ ERRO no removeBackground:', e);
    }
}

testBgRemoval();
