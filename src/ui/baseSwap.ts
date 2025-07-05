import inquirer from 'inquirer';
import { baseSwapService, BASE_CONFIG } from '../services/oneinch';
import { getWalletSetByName } from '../services/wallet';
import { getWalletBalance } from '../services/circle';

export async function showBaseSwapInterface(walletSetName: string): Promise<void> {
  console.log('\n🔷 Base Swap Interface (1inch + Circle Smart Accounts)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('💰 Swap USDC → ETH sur Base avec les meilleurs taux via 1inch');
  console.log('🔄 Transactions exécutées depuis vos Smart Accounts Circle');
  console.log('⚡ Gas fees payés automatiquement par Circle');

  const walletSet = getWalletSetByName(walletSetName);
  if (!walletSet) {
    console.log('❌ Wallet set non trouvé');
    return;
  }

  // Vérifier s'il y a des wallets Base
  const baseWallets = walletSet.wallets.filter(w => 
    w.blockchain === 'BASE-SEPOLIA' || w.blockchain.includes('BASE')
  );

  if (baseWallets.length === 0) {
    console.log('❌ Aucun wallet Base trouvé dans ce wallet set');
    console.log('💡 Créez d\'abord un wallet Base dans votre wallet set');
    return;
  }

  while (true) {
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'Que voulez-vous faire?',
        choices: [
          { name: '🚀 Faire un swap USDC → ETH', value: 'swap' },
          { name: '📊 Voir le prix USDC/ETH actuel', value: 'price' },
          { name: '💰 Vérifier les balances Base', value: 'balance' },
          { name: '🔧 Tester la connexion 1inch', value: 'test' },
          { name: '🔙 Retour au menu principal', value: 'back' }
        ]
      }
    ]);

    switch (action) {
      case 'swap':
        await performSwap(walletSet.walletSetName, baseWallets);
        break;
      case 'price':
        await showPrice();
        break;
      case 'balance':
        await checkBaseBalances(baseWallets);
        break;
      case 'test':
        await testOneInchConnection();
        break;
      case 'back':
        return;
    }

    // Pause avant de revenir au menu
    await inquirer.prompt([{
      type: 'confirm',
      name: 'continue',
      message: 'Appuyez sur Entrée pour continuer...'
    }]);
  }
}

async function performSwap(walletSetName: string, baseWallets: any[]) {
  try {
    console.log('\n🚀 Configuration du swap USDC → ETH');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Sélectionner le wallet
    const { selectedWallet } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedWallet',
        message: 'Choisissez votre wallet Base:',
        choices: baseWallets.map(w => ({
          name: `${w.blockchain} - ${w.address.substring(0, 10)}...${w.address.substring(38)}`,
          value: w
        }))
      }
    ]);

    // Vérifier la balance USDC
    console.log('\n🔍 Vérification de la balance USDC...');
    const balances = await getWalletBalance(selectedWallet.id);
    const usdcBalance = balances?.find(b => 
      b.token.symbol === 'USDC' || b.token.name?.includes('USD Coin')
    );

    if (!usdcBalance || parseFloat(usdcBalance.amount) === 0) {
      console.log('❌ Aucun USDC trouvé dans ce wallet');
      console.log('💡 Vous devez d\'abord avoir des USDC sur Base pour faire un swap');
      return;
    }

    console.log(`✅ Balance USDC: ${usdcBalance.amount} USDC`);

    // Paramètres du swap
    const { usdcAmount, slippage } = await inquirer.prompt([
      {
        type: 'input',
        name: 'usdcAmount',
        message: `Montant USDC à swapper (disponible: ${usdcBalance.amount}):`,
        default: Math.min(parseFloat(usdcBalance.amount), 10).toString(),
        validate: (input) => {
          const amount = parseFloat(input);
          if (isNaN(amount) || amount <= 0) return 'Montant invalide';
          if (amount > parseFloat(usdcBalance.amount)) return 'Montant supérieur à la balance';
          return true;
        }
      },
      {
        type: 'list',
        name: 'slippage',
        message: 'Tolérance au slippage:',
        choices: [
          { name: '0.1% (Recommandé)', value: 0.1 },
          { name: '0.5%', value: 0.5 },
          { name: '1%', value: 1 },
          { name: '3%', value: 3 }
        ]
      }
    ]);

    // Obtenir un quote
    console.log('\n📊 Obtention du quote 1inch...');
    const price = await baseSwapService.getUSDCToETHPrice(usdcAmount);
    
    if (!price) {
      console.log('❌ Impossible d\'obtenir le prix actuel');
      return;
    }

    console.log('💱 Détails du swap:');
    console.log(`   💰 Vous donnez: ${price.usdcAmount} USDC`);
    console.log(`   💰 Vous recevez: ~${price.ethAmount.toFixed(8)} ETH`);
    console.log(`   📈 Taux: ${price.rateFormatted}`);
    console.log(`   ⚡ Slippage: ${slippage}%`);

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Confirmer le swap?',
        default: false
      }
    ]);

    if (!confirm) {
      console.log('❌ Swap annulé');
      return;
    }

    // Exécuter le swap
    console.log('\n🔄 Exécution du swap...');
    const result = await baseSwapService.swapUSDCToETH({
      walletId: selectedWallet.id,
      usdcAmount: usdcAmount,
      slippage: slippage,
      walletAddress: selectedWallet.address
    });

    if (result.success) {
      console.log('🎉 Swap exécuté avec succès!');
      console.log(`🔗 Transaction ID: ${result.transactionId}`);
      console.log(`💰 ETH reçu: ~${result.expectedETH} ETH`);
      console.log(`🔍 Vérifiez sur BaseScan: ${BASE_CONFIG.EXPLORER}/tx/${result.transactionId}`);
    } else {
      console.log('❌ Swap échoué:', result.error);
    }

  } catch (error) {
    console.error('❌ Erreur lors du swap:', error);
  }
}

async function showPrice() {
  try {
    console.log('\n📊 Prix USDC/ETH sur Base (via 1inch)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const amounts = ["1", "10", "100", "1000"];
    
    for (const amount of amounts) {
      console.log(`\n💰 Pour ${amount} USDC:`);
      const price = await baseSwapService.getUSDCToETHPrice(amount);
      
      if (price) {
        console.log(`   📈 ETH reçu: ${price.ethAmount.toFixed(8)} ETH`);
        console.log(`   📊 Taux: 1 USDC = ${price.rate.toFixed(8)} ETH`);
      } else {
        console.log(`   ❌ Prix indisponible`);
      }
    }

    console.log('\n💡 Ces prix incluent les frais et le slippage 1inch');
    console.log('⚠️  Les prix réels peuvent varier selon les conditions du marché');

  } catch (error) {
    console.error('❌ Erreur lors de l\'obtention des prix:', error);
  }
}

async function checkBaseBalances(baseWallets: any[]) {
  try {
    console.log('\n💰 Balances sur Base');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    for (const wallet of baseWallets) {
      console.log(`\n🔷 Wallet: ${wallet.address.substring(0, 10)}...${wallet.address.substring(38)}`);
      console.log(`   📱 Blockchain: ${wallet.blockchain}`);
      
      const balances = await getWalletBalance(wallet.id);
      
      if (balances && balances.length > 0) {
        balances.forEach(balance => {
          if (parseFloat(balance.amount) > 0) {
            console.log(`   💰 ${balance.token.symbol}: ${balance.amount}`);
          }
        });
      } else {
        console.log(`   💰 Aucune balance trouvée`);
      }
    }

    console.log('\n💡 Pour obtenir des tokens sur Base:');
    console.log('   • ETH: Utilisez un bridge officiel depuis Ethereum');
    console.log('   • USDC: Utilisez notre bridge CCTP depuis Sepolia');

  } catch (error) {
    console.error('❌ Erreur lors de la vérification des balances:', error);
  }
}

async function testOneInchConnection() {
  try {
    console.log('\n🔧 Test de connexion 1inch API');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    console.log('🔍 Test 1: Récupération des tokens supportés...');
    const tokens = await baseSwapService.getPopularBaseTokens();
    console.log('✅ Tokens populaires récupérés:');
    Object.entries(tokens).forEach(([symbol, token]) => {
      console.log(`   • ${symbol}: ${token.name}`);
    });

    console.log('\n🔍 Test 2: Obtention d\'un quote USDC/ETH...');
    const price = await baseSwapService.getUSDCToETHPrice("1");
    if (price) {
      console.log(`✅ Quote obtenu: ${price.rateFormatted}`);
    } else {
      console.log('❌ Impossible d\'obtenir le quote');
    }

    console.log('\n🎉 Tests terminés avec succès!');
    console.log('💡 L\'API 1inch est fonctionnelle sur Base');

  } catch (error) {
    console.error('❌ Erreur lors du test 1inch:', error);
    console.log('💡 Vérifiez votre clé API 1inch dans le fichier .env');
  }
}

// Interface simple pour démarrer rapidement un swap
export async function quickBaseSwap(): Promise<void> {
  console.log('\n🚀 Quick Base Swap');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const { walletSetName } = await inquirer.prompt([
    {
      type: 'input',
      name: 'walletSetName',
      message: 'Nom du wallet set à utiliser:',
      default: 'newSet'
    }
  ]);

  await showBaseSwapInterface(walletSetName);
} 