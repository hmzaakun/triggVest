#!/usr/bin/env ts-node

import { baseSwapService } from './src/services/oneinch';
import { getSavedWalletSets } from './src/services/wallet';
import { showBaseSwapInterface } from './src/ui/baseSwap';

async function testBaseSwap() {
  console.log('🔷 Test du service Base Swap avec 1inch');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    // Test 1: Vérifier la connexion 1inch
    console.log('\n🔍 Test 1: Connexion 1inch API...');
    const tokens = await baseSwapService.getPopularBaseTokens();
    console.log('✅ Tokens supportés récupérés:');
    Object.entries(tokens).forEach(([symbol, token]) => {
      console.log(`   • ${symbol}: ${token.name}`);
    });

    // Test 2: Obtenir un prix
    console.log('\n📊 Test 2: Prix USDC/ETH...');
    const price = await baseSwapService.getUSDCToETHPrice("100");
    if (price) {
      console.log(`✅ Prix pour 100 USDC:`);
      console.log(`   📈 ETH reçu: ${price.ethAmount.toFixed(8)} ETH`);
      console.log(`   📊 Taux: ${price.rateFormatted}`);
    } else {
      console.log('❌ Prix indisponible');
    }

    // Test 3: Vérifier les wallet sets
    console.log('\n👛 Test 3: Wallet Sets disponibles...');
    const walletSets = getSavedWalletSets();
    if (walletSets.length > 0) {
      console.log('✅ Wallet sets trouvés:');
      walletSets.forEach((ws, index) => {
        console.log(`   ${index + 1}. ${ws.walletSetName} (${ws.wallets.length} wallets)`);
        const baseWallets = ws.wallets.filter(w => 
          w.blockchain === 'BASE-SEPOLIA' || w.blockchain.includes('BASE')
        );
        console.log(`      - Wallets Base: ${baseWallets.length}`);
      });

      // Test 4: Interface interactive
      console.log('\n🚀 Test 4: Interface interactive...');
      console.log('💡 Lancement de l\'interface Base Swap...');
      
      await showBaseSwapInterface(walletSets[0].walletSetName);
    } else {
      console.log('❌ Aucun wallet set trouvé');
      console.log('💡 Créez d\'abord un wallet set avec des wallets Base');
    }

  } catch (error) {
    console.error('❌ Erreur lors du test:', error);
    
    if (error.response) {
      console.error('📡 Détails de l\'erreur API:');
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Message: ${error.response.data?.message || error.response.statusText}`);
    }
    
    // Vérifier les variables d'environnement
    console.log('\n🔧 Configuration:');
    console.log(`   ONEINCH_API_KEY: ${process.env.ONEINCH_API_KEY ? 'Configuré' : 'Non configuré'}`);
    console.log(`   CIRCLE_API_KEY: ${process.env.CIRCLE_API_KEY ? 'Configuré' : 'Non configuré'}`);
    
    if (!process.env.ONEINCH_API_KEY) {
      console.log('\n💡 Pour configurer votre clé API 1inch:');
      console.log('   1. Allez sur https://1inch.dev/');
      console.log('   2. Créez un compte et obtenez votre clé API');
      console.log('   3. Ajoutez ONEINCH_API_KEY=votre_clé dans le fichier .env');
    }
  }
}

// Configuration d'environnement
async function checkEnvironment() {
  console.log('\n🔧 Vérification de l\'environnement:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const requiredEnvVars = [
    'CIRCLE_API_KEY',
    'ONEINCH_API_KEY'
  ];
  
  requiredEnvVars.forEach(varName => {
    const value = process.env[varName];
    if (value) {
      console.log(`✅ ${varName}: Configuré`);
    } else {
      console.log(`❌ ${varName}: Non configuré`);
    }
  });
  
  console.log('\n💡 Fichier .env requis:');
  console.log('   CIRCLE_API_KEY=TEST_API_KEY:your_key_id:your_secret');
  console.log('   ONEINCH_API_KEY=your_1inch_api_key');
}

// Exécution principale
async function main() {
  await checkEnvironment();
  await testBaseSwap();
}

if (require.main === module) {
  main().catch(console.error);
} 