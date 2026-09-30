import test from 'node:test'
import assert from 'node:assert/strict'
import {assertFlyerGallerySourceKey} from './flyer-gallery-source-policy.mjs'
const owner='eb847e8e-7c19-4bee-8042-376528ce6192'
test('offline renderer respects public assets and model-owner scope',()=>{
 for(const key of ['imagens/bg.webp','uploads/bg.png','logo/store.png',`${owner}/${owner}/assets/background.png`,`projects/${owner}/project/page.json.gz`,`${owner}/${owner}/pages/${owner}/canvas.json.gz`])assert.equal(assertFlyerGallerySourceKey(key,owner),key)
 for(const key of ['projects/another-tenant/private.png','another-tenant/project/pages/page/canvas.json.gz','builder/other/private.png','imagens/../projects/other/private.png','imagens/bg.png?key=private'])assert.throws(()=>assertFlyerGallerySourceKey(key,owner))
})
