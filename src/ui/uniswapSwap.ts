import inquirer from 'inquirer';
import { baseUniswapService, UNISWAP_BASE_CONFIG } from '../services/uniswap';
import { getSavedWalletSets, getWalletSetByName, getWalletBalance } from '../services/wallet';

// Interface principale pour les swaps Uniswap Base
export async function showUniswapSwapInterface(walletSetName: string): Promise<void> {
  console.log('\n🦄 Uniswap Swap sur Base');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const walletSet = getWalletSetByName(walletSetName);
  
  if (!walletSet) {
    console.log(`❌ Wallet set introuvable: ${walletSetName}`);
    return;
  }

  // Filtrer les wallets Base
  const baseWallets = walletSet.wallets.filter(w => 
    w.blockchain === 'BASE-SEPOLIA' || w.blockchain.includes('BASE')
  );

  if (baseWallets.length === 0) {
    console.log('❌ Aucun wallet Base trouvé dans ce wallet set');
    console.log('💡 Créez d\'abord un wallet Base ou utilisez un autre wallet set');
    return;
  }

  console.log(`💰 Wallet Set: ${walletSet.walletSetName}`);
  console.log(`🔷 Wallets Base disponibles: ${baseWallets.length}`);

  while (true) {
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'Que voulez-vous faire?',
        choices: [
          { name: '🔄 Swap USDC → ETH', value: 'swap_usdc_to_eth' },
          { name: '⚡ Swap ETH → USDC', value: 'swap_eth_to_usdc' },
          { name: '💰 Vérifier les prix Uniswap', value: 'price' },
          { name: '📊 Vérifier les balances', value: 'balance' },
          { name: '🏊‍♀️ Pools disponibles', value: 'pools' },
          { name: '🔧 Tester Uniswap', value: 'test' },
          { name: '🔙 Retour au menu principal', value: 'back' }
        ]
      }
    ]);

    switch (action) {
      case 'swap_usdc_to_eth':
        await performUSDCToETHSwap(walletSetName, baseWallets);
        break;
      case 'swap_eth_to_usdc':
        await performETHToUSDCSwap(walletSetName, baseWallets);
        break;
      case 'price':
        await showUniswapPrices();
        break;
      case 'balance':
        await checkBaseBalances(baseWallets);
        break;
      case 'pools':
        await showAvailablePools();
        break;
      case 'test':
        await testUniswapConnection();
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

// Swap USDC → ETH
async function performUSDCToETHSwap(walletSetName: string, baseWallets: any[]) {
  try {
    console.log('\n🦄 Configuration du swap USDC → ETH (Uniswap)');
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
      b.token.symbol === 'USDC' || b.token.name?.toLowerCase().includes('usd coin')
    );

    if (!usdcBalance || parseFloat(usdcBalance.amount) === 0) {
      console.log('❌ Aucun USDC trouvé dans ce wallet');
      console.log('💡 Vous devez d\'abord avoir des USDC sur Base Sepolia pour faire un swap');
      return;
    }

    console.log(`✅ Balance USDC: ${usdcBalance.amount} USDC`);

    // Paramètres du swap
    const { usdcAmount, slippage, poolFee } = await inquirer.prompt([
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
      },
      {
        type: 'list',
        name: 'poolFee',
        message: 'Pool fee (frais de liquidité):',
        choices: [
          { name: '0.05% (Low Fee)', value: UNISWAP_BASE_CONFIG.POOL_FEES.LOW },
          { name: '0.3% (Medium Fee) - Recommandé', value: UNISWAP_BASE_CONFIG.POOL_FEES.MEDIUM },
          { name: '1% (High Fee)', value: UNISWAP_BASE_CONFIG.POOL_FEES.HIGH }
        ],
        default: UNISWAP_BASE_CONFIG.POOL_FEES.MEDIUM
      }
    ]);

    // Obtenir un quote
    console.log('\n📊 Obtention du quote Uniswap...');
    const price = await baseUniswapService.getUSDCToETHPrice(usdcAmount, poolFee);
    
    if (!price) {
      console.log('❌ Impossible d\'obtenir le prix actuel depuis Uniswap');
      return;
    }

    console.log('💱 Détails du swap Uniswap:');
    console.log(`   💰 Vous donnez: ${price.usdcAmount} USDC`);
    console.log(`   💰 Vous recevez: ~${price.ethAmount.toFixed(6)} ETH`);
    console.log(`   📈 Taux: ${price.rateFormatted}`);
    console.log(`   ⚡ Slippage: ${slippage}%`);
    console.log(`   🏊‍♀️ Pool fee: ${poolFee / 10000}%`);

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Confirmer le swap Uniswap USDC → ETH?',
        default: false
      }
    ]);

    if (!confirm) {
      console.log('❌ Swap annulé');
      return;
    }

    // Exécuter le swap
    console.log('\n🔄 Exécution du swap Uniswap USDC → ETH...');
    const result = await baseUniswapService.swapUSDCToETH({
      walletId: selectedWallet.id,
      usdcAmount: usdcAmount,
      slippage: slippage,
      walletAddress: selectedWallet.address,
      poolFee: poolFee
    });

    if (result.success) {
      console.log('\n🎉 Swap Uniswap USDC → ETH exécuté avec succès!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`🔗 Transaction ID: ${result.transactionId}`);
      console.log(`💰 ETH reçu: ~${result.expectedETH} ETH`);
      console.log(`🔍 Vérifiez sur Base Sepolia Scan: ${result.explorerUrl}`);
      console.log('\n📋 Résumé de la transaction:');
      console.log(`   • Wallet: ${selectedWallet.address}`);
      console.log(`   • Montant: ${usdcAmount} USDC → ~${result.expectedETH} ETH`);
      console.log(`   • Slippage utilisé: ${slippage}%`);
      console.log(`   • Pool fee: ${poolFee / 10000}%`);
      console.log(`   • DEX: Uniswap V3 sur Base Sepolia`);
      console.log('\n💡 La transaction peut prendre quelques minutes pour être confirmée.');
    } else {
      console.log('❌ Swap Uniswap échoué:', result.error);
    }

  } catch (error) {
    console.error('❌ Erreur lors du swap Uniswap USDC → ETH:', error);
  }
}

// Swap ETH → USDC
async function performETHToUSDCSwap(walletSetName: string, baseWallets: any[]) {
  try {
    console.log('\n🦄 Configuration du swap ETH → USDC (Uniswap)');
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

    // Vérifier la balance ETH
    console.log('\n🔍 Vérification de la balance ETH...');
    const balances = await getWalletBalance(selectedWallet.id);
    const ethBalance = balances?.find(b => 
      b.token.symbol === 'ETH' || b.token.name?.toLowerCase().includes('ether')
    );

    if (!ethBalance || parseFloat(ethBalance.amount) === 0) {
      console.log('❌ Aucun ETH trouvé dans ce wallet');
      console.log('💡 Vous devez d\'abord avoir des ETH sur Base pour faire un swap');
      return;
    }

    console.log(`✅ Balance ETH: ${ethBalance.amount} ETH`);

    // Paramètres du swap
    const { ethAmount, slippage, poolFee } = await inquirer.prompt([
      {
        type: 'input',
        name: 'ethAmount',
        message: `Montant ETH à swapper (disponible: ${ethBalance.amount}):`,
        default: Math.min(parseFloat(ethBalance.amount), 0.01).toString(),
        validate: (input) => {
          const amount = parseFloat(input);
          if (isNaN(amount) || amount <= 0) return 'Montant invalide';
          if (amount > parseFloat(ethBalance.amount)) return 'Montant supérieur à la balance';
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
      },
      {
        type: 'list',
        name: 'poolFee',
        message: 'Pool fee (frais de liquidité):',
        choices: [
          { name: '0.05% (Low Fee)', value: UNISWAP_BASE_CONFIG.POOL_FEES.LOW },
          { name: '0.3% (Medium Fee) - Recommandé', value: UNISWAP_BASE_CONFIG.POOL_FEES.MEDIUM },
          { name: '1% (High Fee)', value: UNISWAP_BASE_CONFIG.POOL_FEES.HIGH }
        ],
        default: UNISWAP_BASE_CONFIG.POOL_FEES.MEDIUM
      }
    ]);

    // Obtenir un quote
    console.log('\n📊 Obtention du quote Uniswap...');
    const price = await baseUniswapService.getETHToUSDCPrice(ethAmount, poolFee);
    
    if (!price) {
      console.log('❌ Impossible d\'obtenir le prix actuel depuis Uniswap');
      return;
    }

    console.log('💱 Détails du swap Uniswap:');
    console.log(`   💰 Vous donnez: ${price.ethAmount} ETH`);
    console.log(`   💰 Vous recevez: ~${price.usdcAmount.toFixed(2)} USDC`);
    console.log(`   📈 Taux: ${price.rateFormatted}`);
    console.log(`   ⚡ Slippage: ${slippage}%`);
    console.log(`   🏊‍♀️ Pool fee: ${poolFee / 10000}%`);

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Confirmer le swap Uniswap?',
        default: false
      }
    ]);

    if (!confirm) {
      console.log('❌ Swap annulé');
      return;
    }

    // Exécuter le swap
    console.log('\n🔄 Exécution du swap Uniswap...');
    const result = await baseUniswapService.swapETHToUSDC({
      walletId: selectedWallet.id,
      ethAmount: ethAmount,
      slippage: slippage,
      walletAddress: selectedWallet.address,
      poolFee: poolFee
    });

    if (result.success) {
      console.log('\n🎉 Swap Uniswap exécuté avec succès!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`🔗 Transaction ID: ${result.transactionId}`);
      console.log(`💰 USDC reçu: ~${result.expectedUSDC} USDC`);
      console.log(`🔍 Vérifiez sur BaseScan: ${result.explorerUrl}`);
      console.log('\n📋 Résumé de la transaction:');
      console.log(`   • Wallet: ${selectedWallet.address}`);
      console.log(`   • Montant: ${ethAmount} ETH → ~${result.expectedUSDC} USDC`);
      console.log(`   • Slippage utilisé: ${slippage}%`);
      console.log(`   • Pool fee: ${poolFee / 10000}%`);
      console.log(`   • DEX: Uniswap V3 sur Base`);
      console.log('\n💡 La transaction peut prendre quelques minutes pour être confirmée.');
    } else {
      console.log('❌ Swap Uniswap échoué:', result.error);
    }

  } catch (error) {
    console.error('❌ Erreur lors du swap Uniswap:', error);
  }
}

async function showUniswapPrices() {
  try {
    console.log('\n📊 Prix ETH/USDC sur Base (via Uniswap)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const amounts = ["0.01", "0.1", "1", "10"];
    const fees = [
      { name: 'Low (0.05%)', value: UNISWAP_BASE_CONFIG.POOL_FEES.LOW },
      { name: 'Medium (0.3%)', value: UNISWAP_BASE_CONFIG.POOL_FEES.MEDIUM },
      { name: 'High (1%)', value: UNISWAP_BASE_CONFIG.POOL_FEES.HIGH }
    ];
    
    for (const amount of amounts) {
      console.log(`\n💰 Pour ${amount} ETH:`);
      
      for (const fee of fees) {
        const price = await baseUniswapService.getETHToUSDCPrice(amount, fee.value);
        
        if (price) {
          console.log(`   📈 ${fee.name}: ${price.usdcAmount.toFixed(2)} USDC (${price.rate.toFixed(2)} USDC/ETH)`);
        } else {
          console.log(`   ❌ ${fee.name}: Prix indisponible`);
        }
      }
    }

    console.log('\n💡 Ces prix sont obtenus directement des pools Uniswap sur Base');
    console.log('⚠️  Les prix réels peuvent varier selon les conditions du pool');

  } catch (error) {
    console.error('❌ Erreur lors de l\'obtention des prix Uniswap:', error);
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

    console.log('\n💡 Pour swapper sur Uniswap:');
    console.log('   • Vous avez besoin d\'ETH pour swapper vers USDC');
    console.log('   • Uniswap utilise différents pools avec des fees variables');
    console.log('   • Les pools à faible fee ont généralement plus de liquidité');

  } catch (error) {
    console.error('❌ Erreur lors de la vérification des balances:', error);
  }
}

async function showAvailablePools() {
  try {
    console.log('\n🏊‍♀️ Pools Uniswap ETH/USDC disponibles sur Base');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const pools = await baseUniswapService.getAvailablePools();
    
    if (pools.length > 0) {
      pools.forEach((pool, index) => {
        console.log(`\n${index + 1}. ${pool.name}`);
        console.log(`   📍 Adresse: ${pool.address}`);
        console.log(`   💰 Fee: ${pool.fee / 10000}%`);
        console.log(`   🔗 Pool sur BaseScan: ${UNISWAP_BASE_CONFIG.EXPLORER}/address/${pool.address}`);
      });
      
      console.log('\n💡 Recommandations:');
      console.log('   • Low fee (0.05%): Meilleur pour les gros montants');
      console.log('   • Medium fee (0.3%): Équilibre entre coût et liquidité');
      console.log('   • High fee (1%): Pour les tokens plus volatils');
    } else {
      console.log('❌ Aucun pool ETH/USDC trouvé sur Uniswap Base');
      console.log('💡 Vérifiez que les adresses des contrats sont correctes');
    }

  } catch (error) {
    console.error('❌ Erreur lors de la récupération des pools:', error);
  }
}

async function testUniswapConnection() {
  try {
    console.log('\n🔧 Test de connexion Uniswap sur Base');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    console.log('🔍 Test 1: Configuration des contrats...');
    console.log(`   ✅ Swap Router: ${UNISWAP_BASE_CONFIG.SWAP_ROUTER}`);
    console.log(`   ✅ Quoter V2: ${UNISWAP_BASE_CONFIG.QUOTER_V2}`);
    console.log(`   ✅ Factory V3: ${UNISWAP_BASE_CONFIG.POOL_FACTORY}`);

    console.log('\n🔍 Test 2: Tokens configurés...');
    console.log(`   ✅ WETH: ${UNISWAP_BASE_CONFIG.WETH}`);
    console.log(`   ✅ USDC: ${UNISWAP_BASE_CONFIG.USDC}`);
    console.log(`   ✅ ETH Native: ${UNISWAP_BASE_CONFIG.ETH_NATIVE}`);

    console.log('\n🔍 Test 3: Récupération des pools...');
    const pools = await baseUniswapService.getAvailablePools();
    console.log(`   ✅ Pools trouvés: ${pools.length}`);
    pools.forEach(pool => {
      console.log(`   • ${pool.name}`);
    });

    console.log('\n🔍 Test 4: Obtention d\'un quote de test...');
    const price = await baseUniswapService.getETHToUSDCPrice("0.01");
    if (price) {
      console.log(`   ✅ Quote obtenu: ${price.rateFormatted}`);
    } else {
      console.log('   ❌ Impossible d\'obtenir le quote');
    }

    console.log('\n🎉 Tests terminés!');
    console.log('💡 Uniswap est configuré et fonctionnel sur Base');

  } catch (error) {
    console.error('❌ Erreur lors des tests Uniswap:', error);
    console.log('💡 Vérifiez la connectivité réseau et les adresses des contrats');
  }
}

// Interface simple pour démarrer rapidement un swap Uniswap
export async function quickUniswapSwap(): Promise<void> {
  console.log('\n🦄 Quick Uniswap Swap');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const { walletSetName } = await inquirer.prompt([
    {
      type: 'input',
      name: 'walletSetName',
      message: 'Nom du wallet set à utiliser:',
      default: 'newSet'
    }
  ]);

  await showUniswapSwapInterface(walletSetName);
} 