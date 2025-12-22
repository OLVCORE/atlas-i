#!/usr/bin/env node

/**
 * Script para verificar se todas as rotas definidas no nav-map.ts
 * possuem uma página correspondente em app/app/
 */

import { readFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import { existsSync } from "fs"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, "..")

// Ler o nav-map.ts e extrair os hrefs
const navMapPath = join(projectRoot, "lib", "nav-map.ts")
const navMapContent = readFileSync(navMapPath, "utf-8")

// Extrair todos os hrefs usando regex simples
const hrefMatches = navMapContent.matchAll(/href:\s*["']([^"']+)["']/g)
const routes = Array.from(hrefMatches).map((match) => match[1])

console.log(`\n🔍 Verificando ${routes.length} rotas definidas no nav-map.ts...\n`)

let allOk = true
const missingRoutes = []

for (const route of routes) {
  // Converter /app/entities -> app/app/entities/page.tsx
  const routePath = route.replace(/^\/app/, "app/app")
  const pagePath = join(projectRoot, routePath, "page.tsx")

  if (existsSync(pagePath)) {
    console.log(`✅ ${route} -> ${pagePath}`)
  } else {
    console.log(`❌ ${route} -> ${pagePath} (NÃO ENCONTRADO)`)
    missingRoutes.push({ route, expectedPath: pagePath })
    allOk = false
  }
}

if (missingRoutes.length > 0) {
  console.log(`\n❌ ${missingRoutes.length} rota(s) faltando:\n`)
  missingRoutes.forEach(({ route, expectedPath }) => {
    console.log(`  - ${route}`)
    console.log(`    Esperado em: ${expectedPath}\n`)
  })
  process.exit(1)
} else {
  console.log(`\n✅ Todas as ${routes.length} rotas possuem páginas correspondentes!\n`)
  process.exit(0)
}

