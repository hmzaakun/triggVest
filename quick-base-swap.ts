#!/usr/bin/env ts-node

import 'dotenv/config';
import { baseSwapService } from "./src/services/oneinch";
import { getSavedWalletSets } from "./src/services/wallet";

async function quickSwapExample() {
  console.log("🚀 Quick Base Swap Example");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  try {
    // Test prix sans wallet
    console.log("\n💰 Prix USDC/ETH sur Base (via 1inch):");
    const amounts = ["1", "10", "100"];

    for (const amount of amounts) {
      const price = await baseSwapService.getUSDCToETHPrice(amount);
      if (price) {
        console.log(`   ${amount} USDC → ${price.ethAmount.toFixed(8)} ETH`);
      } else {
        console.log(`   ${amount} USDC → Prix indisponible`);
      }
    }

    // Test tokens supportés
    console.log("\n🔗 Tokens populaires sur Base:");
    const tokens = await baseSwapService.getPopularBaseTokens();
    Object.entries(tokens).forEach(([symbol, token]) => {
      console.log(`   • ${symbol}: ${token.name} (${token.decimals} decimals)`);
      console.log(`     Address: ${token.address}`);
    });

    // Utiliser directement le wallet set "newSet"
    console.log('\n👛 Utilisation du wallet set "newSet":');
    const walletSets = getSavedWalletSets();
    const newSetWallet = walletSets.find((ws) => ws.walletSetName === "newSet");

    if (newSetWallet) {
      console.log(`   ✅ Wallet set trouvé: ${newSetWallet.walletSetName}`);
      const baseWallets = newSetWallet.wallets.filter(
        (w) => w.blockchain === "BASE-SEPOLIA" || w.blockchain.includes("BASE")
      );

      if (baseWallets.length > 0) {
        baseWallets.forEach((wallet) => {
          console.log(`      🔷 ${wallet.blockchain}: ${wallet.address}`);
        });

        // Test avec le premier wallet Base trouvé
        const baseWallet = baseWallets[0];
        console.log(`\n🚀 Test avec wallet: ${baseWallet.address}`);

        // Exemple de test de balance (nécessite USDC sur Base)
        console.log("\n💡 Pour tester un swap réel avec ce wallet:");
        console.log(`   await baseSwapService.swapUSDCToETH({`);
        console.log(`     walletId: "${baseWallet.id}",`);
        console.log(`     usdcAmount: "1",`);
        console.log(`     slippage: 1,`);
        console.log(`     walletAddress: "${baseWallet.address}"`);
        console.log(`   });`);
      } else {
        console.log("   ❌ Aucun wallet Base trouvé dans newSet");
      }
    } else {
      console.log('   ❌ Wallet set "newSet" non trouvé');
      console.log("\n📋 Wallet sets disponibles:");
      walletSets.forEach((ws, index) => {
        console.log(`      ${index + 1}. ${ws.walletSetName}`);
      });
    }

    console.log("\n🎉 Test terminé avec succès!");
    console.log(
      '💡 Pour faire un swap réel, lancez: npm run start et choisissez "Base Swap"'
    );

    // Afficher l'exemple de swap avec newSet
    await swapWithNewSetWallet();
  } catch (error) {
    console.error("❌ Erreur:", error);

    if (!process.env.ONEINCH_API_KEY) {
      console.log("\n💡 Configuration manquante:");
      console.log("   Ajoutez ONEINCH_API_KEY=votre_clé dans .env");
      console.log("   Obtenez votre clé sur https://1inch.dev/");
    }
  }
}

// Exemple de swap réel avec le wallet "newSet" (décommentez pour tester)
async function swapWithNewSetWallet() {
  console.log("\n🚀 Exemple de swap avec newSet (décommenté pour tester):");

  // Décommentez ces lignes pour faire un vrai swap avec le wallet newSet:

  const walletSets = getSavedWalletSets();
  const newSetWallet = walletSets.find((ws) => ws.walletSetName === "newSet");

  if (newSetWallet) {
    const baseWallet = newSetWallet.wallets.find(
      (w) => w.blockchain === "BASE-SEPOLIA" || w.blockchain.includes("BASE")
    );

    if (baseWallet) {
      console.log(
        `🔄 Swap de 1 USDC vers ETH avec wallet: ${baseWallet.address}`
      );

      const result = await baseSwapService.swapUSDCToETH({
        walletId: baseWallet.id,
        usdcAmount: "1", // 1 USDC
        slippage: 1, // 1%
        walletAddress: baseWallet.address,
      });

      if (result.success) {
        console.log("✅ Swap réussi!");
        console.log(`💰 ETH reçu: ${result.expectedETH}`);
        console.log(`🔗 Transaction: ${result.transactionId}`);
      } else {
        console.log("❌ Swap échoué:", result.error);
      }

      return result;
    } else {
      console.log("❌ Aucun wallet Base trouvé dans newSet");
    }
  } else {
    console.log('❌ Wallet set "newSet" non trouvé');
  }

  console.log("💡 Pour tester un swap réel:");
  console.log("   1. Décommentez le code dans swapWithNewSetWallet()");
  console.log("   2. Assurez-vous d'avoir des USDC sur votre wallet Base");
  console.log("   3. Relancez le script");
}

if (require.main === module) {
  quickSwapExample().catch(console.error);
}
