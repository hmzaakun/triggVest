#!/usr/bin/env ts-node

import 'dotenv/config';
import { baseUniswapService, UNISWAP_BASE_CONFIG } from "./src/services/uniswap";
import { getSavedWalletSets } from "./src/services/wallet";

async function testUniswapBase() {
  console.log('🦄 Test Uniswap Base Swap');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    // Utiliser directement le wallet set "newSet"
    console.log('\n👛 Utilisation du wallet set "newSet":');
    const walletSets = getSavedWalletSets();
    const newSetWallet = walletSets.find(ws => ws.walletSetName === 'newSet');
    
    if (newSetWallet) {
      console.log(`   ✅ Wallet set trouvé: ${newSetWallet.walletSetName}`);
      const baseWallets = newSetWallet.wallets.filter(w => 
        w.blockchain === 'BASE-SEPOLIA' || w.blockchain.includes('BASE')
      );
      
      if (baseWallets.length > 0) {
        const baseWallet = baseWallets[0];
        console.log(`   🔷 Wallet Base: ${baseWallet.address}`);
        console.log(`   📱 Blockchain: ${baseWallet.blockchain}`);
      } else {
        console.log('   ❌ Aucun wallet Base trouvé dans newSet');
      }
    } else {
      console.log('   ❌ Wallet set "newSet" non trouvé');
    }

    // Vérifier la configuration Uniswap
    console.log('\n🔧 Configuration Uniswap:');
    console.log(`   ✅ Chain ID: ${UNISWAP_BASE_CONFIG.CHAIN_ID}`);
    console.log(`   ✅ Swap Router: ${UNISWAP_BASE_CONFIG.SWAP_ROUTER}`);
    console.log(`   ✅ Quoter V2: ${UNISWAP_BASE_CONFIG.QUOTER_V2}`);
    console.log(`   ✅ Factory V3: ${UNISWAP_BASE_CONFIG.POOL_FACTORY}`);
    console.log(`   ✅ WETH: ${UNISWAP_BASE_CONFIG.WETH}`);
    console.log(`   ✅ USDC: ${UNISWAP_BASE_CONFIG.USDC}`);

    // Vérifier les pools disponibles
    console.log('\n🏊‍♀️ Pools disponibles:');
    const pools = await baseUniswapService.getAvailablePools();
    if (pools.length > 0) {
      pools.forEach(pool => {
        console.log(`   ✅ ${pool.name} - ${pool.address.substring(0, 10)}...`);
      });
    } else {
      console.log('   ❌ Aucun pool trouvé');
    }

    // Obtenir les prix ETH/USDC
    console.log('\n📊 Prix ETH/USDC sur Uniswap:');
    const prices = await Promise.all([
      baseUniswapService.getETHToUSDCPrice("0.01", UNISWAP_BASE_CONFIG.POOL_FEES.LOW),
      baseUniswapService.getETHToUSDCPrice("0.01", UNISWAP_BASE_CONFIG.POOL_FEES.MEDIUM),
      baseUniswapService.getETHToUSDCPrice("0.01", UNISWAP_BASE_CONFIG.POOL_FEES.HIGH)
    ]);

    const feeNames = ['Low (0.05%)', 'Medium (0.3%)', 'High (1%)'];
    prices.forEach((price, index) => {
      if (price) {
        console.log(`   💰 ${feeNames[index]}: ${price.rateFormatted}`);
      } else {
        console.log(`   ❌ ${feeNames[index]}: Prix indisponible`);
      }
    });

    // Exemple de swap avec newSet
    await swapWithNewSetWallet();

  } catch (error) {
    console.error('❌ Erreur lors du test Uniswap:', error);
  }
}

async function swapWithNewSetWallet() {
  console.log('\n🦄 Exemple de swap avec newSet:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const walletSets = getSavedWalletSets();
  const newSetWallet = walletSets.find(ws => ws.walletSetName === 'newSet');
  
  if (!newSetWallet) {
    console.log('❌ Wallet set "newSet" non trouvé');
    return;
  }

  const baseWallets = newSetWallet.wallets.filter(w => 
    w.blockchain === 'BASE-SEPOLIA' || w.blockchain.includes('BASE')
  );

  if (baseWallets.length === 0) {
    console.log('❌ Aucun wallet Base trouvé dans newSet');
    return;
  }

  const baseWallet = baseWallets[0];
  console.log(`🔷 Wallet utilisé: ${baseWallet.address}`);
  console.log(`📱 Blockchain: ${baseWallet.blockchain}`);

  console.log('\n💡 Exemple de swap Uniswap (décommenté pour tester):');
  console.log('   const result = await baseUniswapService.swapETHToUSDC({');
  console.log('     walletId: "' + baseWallet.id + '",');
  console.log('     ethAmount: "0.01",');
  console.log('     slippage: 1,');
  console.log('     walletAddress: "' + baseWallet.address + '",');
  console.log('     poolFee: ' + UNISWAP_BASE_CONFIG.POOL_FEES.MEDIUM);
  console.log('   });');

  console.log('\n⚠️  Pour exécuter un vrai swap, décommentez le code ci-dessous:');
  console.log('💰 Assurez-vous d\'avoir des ETH dans votre wallet avant le swap');
  console.log('🔍 Vérifiez les balances avec: npm run start puis "Uniswap Swap"');

  /*
  // Décommentez pour tester avec un vrai swap:
  const result = await baseUniswapService.swapETHToUSDC({
    walletId: baseWallet.id,
    ethAmount: "0.01", // 0.01 ETH
    slippage: 1,
    walletAddress: baseWallet.address,
    poolFee: UNISWAP_BASE_CONFIG.POOL_FEES.MEDIUM
  });

  if (result.success) {
    console.log("✅ Swap Uniswap réussi!");
    console.log(`💰 USDC reçu: ${result.expectedUSDC}`);
    console.log(`🔗 Transaction: ${result.transactionId}`);
    console.log(`🔍 Vérifiez sur BaseScan: ${result.explorerUrl}`);
    console.log(`📊 Détails:`);
    console.log(`   • Montant: 0.01 ETH → ${result.expectedUSDC} USDC`);
    console.log(`   • Wallet: ${baseWallet.address}`);
    console.log(`   • DEX: Uniswap V3`);
    console.log(`   • Pool Fee: ${UNISWAP_BASE_CONFIG.POOL_FEES.MEDIUM / 10000}%`);
  } else {
    console.log("❌ Swap Uniswap échoué:", result.error);
  }
  */
}

// Fonction pour comparer les prix 1inch vs Uniswap
async function comparePrices() {
  console.log('\n📊 Comparaison des prix 1inch vs Uniswap:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    // Prix Uniswap
    const uniswapPrice = await baseUniswapService.getETHToUSDCPrice("1", UNISWAP_BASE_CONFIG.POOL_FEES.MEDIUM);
    
    console.log('\n🦄 Uniswap (Pool 0.3%):');
    if (uniswapPrice) {
      console.log(`   💰 1 ETH = ${uniswapPrice.usdcAmount.toFixed(2)} USDC`);
      console.log(`   📈 Taux: ${uniswapPrice.rate.toFixed(2)} USDC/ETH`);
    } else {
      console.log('   ❌ Prix indisponible');
    }

    console.log('\n🔢 1inch:');
    console.log('   💡 Configurez votre clé API 1inch pour comparer les prix');
    console.log('   📊 Lancez: npm run quick-base-swap');

    console.log('\n💡 Recommandations:');
    console.log('   • Comparez toujours les prix avant de choisir un DEX');
    console.log('   • Uniswap: Plus décentralisé, pools avec différents fees');
    console.log('   • 1inch: Agrégateur, trouve souvent les meilleurs prix');
    console.log('   • Considérez le slippage et les frais de gas');

  } catch (error) {
    console.error('❌ Erreur lors de la comparaison des prix:', error);
  }
}

// Exécuter les tests
async function main() {
  await testUniswapBase();
  await comparePrices();
  
  console.log('\n🎉 Tests Uniswap terminés!');
  console.log('💡 Pour faire un swap réel, lancez: npm run start puis choisissez "Uniswap Swap"');
  console.log('🔧 Pour tester les fonctionnalités: npm run start:cli');
}

main().catch(console.error); 