import sharp from 'sharp';

console.log('Tentando carregar o sharp...');
try {
  const s = sharp();
  console.log('Sharp carregado com sucesso!');
  console.log('Versão do sharp:', sharp.versions.sharp);
} catch (error) {
  console.error('Erro ao carregar o sharp:', error);
  process.exit(1);
}
