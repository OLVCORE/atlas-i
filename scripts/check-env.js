#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const envPath = path.join(process.cwd(), '.env.local');
const requiredVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY'
];

console.log('Verificando configuração do ambiente...\n');

if (!fs.existsSync(envPath)) {
  console.error('❌ Arquivo .env.local não encontrado!');
  console.log('\nCrie o arquivo .env.local na raiz do projeto com:');
  console.log('\nNEXT_PUBLIC_SUPABASE_URL=https://vydsayvhovuqfdelxtko.supabase.co');
  console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_REJMwtwd8DddDHN15Ppgfw_w9fKY3Su\n');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const missing = [];

requiredVars.forEach(varName => {
  if (!envContent.includes(varName)) {
    missing.push(varName);
  }
});

if (missing.length > 0) {
  console.error(`❌ Variáveis faltando: ${missing.join(', ')}`);
  process.exit(1);
}

console.log('✅ Arquivo .env.local encontrado');
console.log('✅ Todas as variáveis necessárias estão presentes');
console.log('\nConfiguração do ambiente OK!\n');

