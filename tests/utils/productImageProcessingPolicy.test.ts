import { expect, it } from 'vitest'
import {
  buildExternalSourceDerivedS3Key,
  buildSourceDerivedS3Key,
  isProcessedSmartKey
} from '../../server/utils/product-image-matching'

it('separa o cache externo por política e invalida as keys ambíguas v2', () => {
  const url = 'https://images.example/product.png?token=temporary'
  const automatic = buildExternalSourceDerivedS3Key(url, 'auto')
  const strict = buildExternalSourceDerivedS3Key(url, 'always')
  expect(automatic).not.toBe(strict)
  expect(automatic).toContain('smart-ext-auto-')
  expect(strict).toContain('smart-ext-always-')
  expect(isProcessedSmartKey('imagens/smart-src-legacy-v2.webp')).toBe(false)
  expect(isProcessedSmartKey(buildSourceDerivedS3Key('uploads/source.png'))).toBe(true)
  expect(isProcessedSmartKey(automatic)).toBe(false)
  expect(isProcessedSmartKey(strict)).toBe(true)
})
