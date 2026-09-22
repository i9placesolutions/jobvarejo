import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'
const root=fileURLToPath(new URL('../../',import.meta.url))
export default defineConfig({root:fileURLToPath(new URL('.',import.meta.url)),publicDir:root+'public',resolve:{alias:{'~':root}},server:{host:'127.0.0.1',port:4412,strictPort:true,fs:{allow:[root]}}})
