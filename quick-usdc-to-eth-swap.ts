#!/usr/bin/env ts-node

import 'dotenv/config';
import { baseUniswapService, UNISWAP_BASE_CONFIG } from "./src/services/uniswap";
import { getSavedWalletSets } from "./src/services/wallet";
import { getWalletBalance } from "./src/services/circle";

async function realUSDCToETHSwap() {
  console.log('🔥 SWAP RÉEL USDC → ETH sur Base Sepolia (Uniswap)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    // Utiliser directement le wallet set "newSet"
    console.log('\n👛 Recherche du wallet set "newSet"...');
    const walletSets = getSavedWalletSets();
    const newSetWallet = walletSets.find(ws => ws.walletSetName === 'newSet');
    
    if (!newSetWallet) {
      console.log('❌ Wallet set "newSet" non trouvé');
      console.log('💡 Créez d\'abord un wallet set nommé "newSet" avec un wallet Base');
      return;
    }

    const baseWallets = newSetWallet.wallets.filter(w => 
      w.blockchain === 'BASE-SEPOLIA' || w.blockchain.includes('BASE')
    );
    
    if (baseWallets.length === 0) {
      console.log('❌ Aucun wallet Base trouvé dans newSet');
      console.log('💡 Ajoutez un wallet Base Sepolia à votre wallet set "newSet"');
      return;
    }

    const baseWallet = baseWallets[0];
    console.log(`✅ Wallet trouvé: ${baseWallet.address}`);
    console.log(`📱 Blockchain: ${baseWallet.blockchain}`);

    // Vérifier la balance USDC
    console.log('\n💰 Vérification de la balance USDC...');
    const balances = await getWalletBalance(baseWallet.id);
    
    if (!balances || balances.length === 0) {
      console.log('❌ Impossible de récupérer les balances');
      return;
    }

    console.log('💰 Balances disponibles:');
    balances.forEach(balance => {
      if (parseFloat(balance.amount) > 0) {
        console.log(`   • ${balance.token.symbol}: ${balance.amount}`);
      }
    });

    const usdcBalance = balances.find(b => 
      b.token.symbol === 'USDC' || b.token.name?.toLowerCase().includes('usd coin')
    );

    if (!usdcBalance || parseFloat(usdcBalance.amount) === 0) {
      console.log('\n❌ Aucun USDC trouvé dans ce wallet');
      console.log('💡 Solutions:');
      console.log('   1. Transférez des USDC vers ce wallet sur Base Sepolia');
      console.log('   2. Utilisez un faucet Base Sepolia pour obtenir des tokens de test');
      console.log('   3. Bridgez des USDC depuis un autre réseau');
      return;
    }

    console.log(`\n✅ Balance USDC: ${usdcBalance.amount} USDC`);

    // Configuration du swap
    const usdcAmount = "10"; // 10 USDC par défaut
    const slippage = 1; // 1% slippage
    const poolFee = UNISWAP_BASE_CONFIG.POOL_FEES.MEDIUM; // 0.3%

    if (parseFloat(usdcBalance.amount) < parseFloat(usdcAmount)) {
      console.log(`❌ Balance insuffisante. Requis: ${usdcAmount} USDC, Disponible: ${usdcBalance.amount} USDC`);
      return;
    }

    // Obtenir un quote
    console.log('\n📊 Obtention du quote Uniswap...');
    const price = await baseUniswapService.getUSDCToETHPrice(usdcAmount, poolFee);
    
    if (!price) {
      console.log('❌ Impossible d\'obtenir le prix depuis Uniswap');
      console.log('💡 Vérifiez:');
      console.log('   1. La connectivité réseau');
      console.log('   2. Les adresses des contrats Uniswap');
      console.log('   3. L\'existence du pool USDC/ETH sur Base Sepolia');
      return;
    }

    console.log('\n💱 Détails du swap:');
    console.log(`   🔄 Direction: USDC → ETH`);
    console.log(`   💰 Vous donnez: ${price.usdcAmount} USDC`);
    console.log(`   💰 Vous recevez: ~${price.ethAmount.toFixed(6)} ETH`);
    console.log(`   📈 Taux: ${price.rateFormatted}`);
    console.log(`   ⚡ Slippage: ${slippage}%`);
    console.log(`   🏊‍♀️ Pool fee: ${poolFee / 10000}%`);
    console.log(`   🌐 Réseau: Base Sepolia`);
    console.log(`   🦄 DEX: Uniswap V3`);
    console.log(`🦄 Swap Router: ${UNISWAP_BASE_CONFIG.SWAP_ROUTER}`);

    console.log('\n⚠️  ATTENTION: Vous allez faire un VRAI swap avec de vrais tokens!');
    console.log('💡 Décommentez la section ci-dessous pour confirmer et exécuter:');

    /*
    // DÉCOMMENTEZ CES LIGNES POUR EXÉCUTER LE SWAP RÉEL:
    
    console.log('\n🚀 Exécution du swap USDC → ETH...');
    const result = await baseUniswapService.swapUSDCToETH({
      walletId: baseWallet.id,
      usdcAmount: usdcAmount,
      slippage: slippage,
      walletAddress: baseWallet.address,
      poolFee: poolFee
    });

    if (result.success) {
      console.log('\n🎉 SWAP RÉUSSI! 🎉');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`🔗 Transaction ID: ${result.transactionId}`);
      console.log(`💰 ETH reçu: ~${result.expectedETH} ETH`);
      console.log(`🔍 Base Sepolia Scan: ${result.explorerUrl}`);
      console.log('\n📊 Résumé de la transaction:');
      console.log(`   • Wallet: ${baseWallet.address}`);
      console.log(`   • Swap: ${usdcAmount} USDC → ~${result.expectedETH} ETH`);
      console.log(`   • Slippage: ${slippage}%`);
      console.log(`   • Pool fee: ${poolFee / 10000}%`);
      console.log(`   • DEX: Uniswap V3 sur Base Sepolia`);
      console.log('\n🔗 Liens utiles:');
      console.log(`   • Transaction: ${result.explorerUrl}`);
      console.log(`   • Wallet: ${UNISWAP_BASE_CONFIG.EXPLORER}/address/${baseWallet.address}`);
      console.log('\n💡 Votre swap a été exécuté avec succès!');
    } else {
      console.log('\n❌ ÉCHEC DU SWAP ❌');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`💥 Erreur: ${result.error}`);
      console.log('\n🔧 Solutions possibles:');
      console.log('   1. Vérifiez que vous avez suffisamment d\'ETH pour les gas fees');
      console.log('   2. Réduisez le montant à swapper');
      console.log('   3. Augmentez le slippage (conditions de marché volatiles)');
      console.log('   4. Vérifiez que le pool a suffisamment de liquidité');
    }
    */

    console.log('\n📋 Instructions pour exécuter le swap:');
    console.log('1. 📝 Éditez ce fichier: quick-usdc-to-eth-swap.ts');
    console.log('2. 🔓 Décommentez les lignes 74-116 (section /* ... */)');
    console.log('3. 💾 Sauvegardez le fichier');
    console.log('4. 🚀 Relancez: npm run quick-usdc-eth-swap');
    console.log('\n⚠️  Assurez-vous d\'avoir des ETH pour les gas fees!');

  } catch (error) {
    console.error('\n❌ ERREUR CRITIQUE:', error);
    console.log('\n🔧 Vérifiez:');
    console.log('   • Votre connexion Internet');
    console.log('   • Les variables d\'environnement (.env)');
    console.log('   • La clé API Circle');
    console.log('   • L\'existence du wallet "newSet"');
  }
}

// Informations utiles
async function showInfo() {
  console.log('\n📚 Informations Uniswap Base Sepolia:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🌐 Réseau: Base Sepolia (Chain ID: ${UNISWAP_BASE_CONFIG.CHAIN_ID})`);
  console.log(`🦄 Swap Router: ${UNISWAP_BASE_CONFIG.SWAP_ROUTER}`);
  console.log(`💰 USDC: ${UNISWAP_BASE_CONFIG.USDC}`);
  console.log(`⚡ WETH: ${UNISWAP_BASE_CONFIG.WETH}`);
  console.log(`🔍 Explorer: ${UNISWAP_BASE_CONFIG.EXPLORER}`);
  
  console.log('\n🔗 Liens utiles:');
  console.log('   • Base Sepolia Faucet: https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet');
  console.log('   • Uniswap App: https://app.uniswap.org/#/swap');
  console.log('   • Base Sepolia Explorer: https://sepolia.basescan.org');
  
  console.log('\n💡 Pour obtenir des tokens de test:');
  console.log('   1. Utilisez le faucet Base Sepolia pour obtenir des ETH');
  console.log('   2. Swappez une partie des ETH contre des USDC sur Uniswap');
  console.log('   3. Utilisez ensuite ce script pour retourner vers ETH');
}

async function main() {
  await realUSDCToETHSwap();
  await showInfo();
}

main().catch(console.error); 