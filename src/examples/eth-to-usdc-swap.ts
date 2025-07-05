import {
  createContractTransaction,
  getWalletBalance,
  createTransaction,
} from "../services/circle";
import { waitForTransactionConfirmation } from "../services/circle";

// Adresses des contrats sur Sepolia
const SEPOLIA_CONTRACTS = {
  WETH: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14",
  USDC: "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238",
  UNISWAP_V3_ROUTER: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
  UNISWAP_V3_QUOTER: "0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3",
};

// Interface pour les paramètres du swap
interface SwapETHToUSDCParams {
  walletId: string;
  ethAmount: string; // En ETH (ex: "0.001")
  minUsdcOut?: string; // Montant minimum USDC accepté (protection slippage)
  slippageTolerance?: number; // En pourcentage (ex: 0.5 = 0.5%)
}

/**
 * Swap ETH-SEPOLIA vers USDC sur Sepolia via Uniswap V3
 */
export async function swapETHToUSDC(params: SwapETHToUSDCParams) {
  const { walletId, ethAmount, minUsdcOut, slippageTolerance = 0.5 } = params;

  try {
    console.log(`🔄 Starting ETH -> USDC swap...`);
    console.log(`   Amount: ${ethAmount} ETH`);
    console.log(`   Slippage: ${slippageTolerance}%`);

    // 1. Vérifier la balance ETH
    await checkETHBalance(walletId, ethAmount);

    // 2. Obtenir un quote pour estimer le output USDC
    const quote = await getSwapQuote(ethAmount);
    console.log(`   Expected USDC output: ~${quote.expectedUSDC} USDC`);

    // 3. Calculer le minimum acceptable avec slippage
    const minUsdcOutCalculated =
      minUsdcOut || calculateMinOutput(quote.expectedUSDC, slippageTolerance);
    console.log(`   Min USDC accepted: ${minUsdcOutCalculated} USDC`);

    // 4. Préparer les paramètres du swap
    const swapParams = await prepareSwapParams(
      walletId,
      ethAmount,
      minUsdcOutCalculated
    );

    // 5. Exécuter le swap
    const transaction = await createContractTransaction({
      walletId: walletId,
      contractAddress: SEPOLIA_CONTRACTS.UNISWAP_V3_ROUTER,
      abiFunctionSignature:
        "exactInputSingle((address,address,uint24,address,uint256,uint256,uint256,uint160))",
      abiParameters: [swapParams],
      feeLevel: "HIGH",
    });

    if (!transaction.data?.id) {
      throw new Error("Failed to create swap transaction");
    }

    console.log(`✅ Swap transaction created: ${transaction.data.id}`);

    // 6. Attendre la confirmation
    console.log(`⏳ Waiting for transaction confirmation...`);
    const confirmedTx = await waitForTransactionConfirmation(
      transaction.data.id,
      10
    );

    if (confirmedTx.state === "COMPLETE") {
      console.log(`🎉 Swap completed successfully!`);

      // 7. Vérifier les nouvelles balances
      await checkBalancesAfterSwap(walletId);
    }

    return {
      success: true,
      transactionId: transaction.data.id,
      expectedUSDC: quote.expectedUSDC,
      minUSDC: minUsdcOutCalculated,
    };
  } catch (error) {
    console.error(`❌ Swap failed:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Vérifier la balance ETH suffisante
async function checkETHBalance(walletId: string, requiredETH: string) {
  const balances = await getWalletBalance(walletId);

  const ethBalance = balances?.find(
    (b) => b.token.symbol === "ETH" || b.token.name?.includes("Ethereum")
  );

  if (!ethBalance) {
    throw new Error("No ETH balance found in wallet");
  }

  const currentETH = parseFloat(ethBalance.amount);
  const requiredETHNum = parseFloat(requiredETH);

  if (currentETH < requiredETHNum) {
    throw new Error(
      `Insufficient ETH balance. Required: ${requiredETH} ETH, Available: ${currentETH} ETH`
    );
  }

  console.log(`✅ ETH balance check passed: ${currentETH} ETH available`);
}

// Obtenir un quote du swap (estimation)
async function getSwapQuote(ethAmount: string) {
  // Conversion ETH en wei (18 decimals)
  const ethAmountWei = (parseFloat(ethAmount) * Math.pow(10, 18)).toString();

  // Prix approximatif pour estimation (en production, utiliser Quoter contract ou API)
  // ETH/USD ~= $2000, USDC a 6 decimals
  const ethPriceUSD = 2000; // Prix approximatif ETH
  const expectedUSDCAmount = parseFloat(ethAmount) * ethPriceUSD;
  const expectedUSDCWei = (expectedUSDCAmount * Math.pow(10, 6)).toString(); // USDC a 6 decimals

  return {
    ethAmountWei,
    expectedUSDC: expectedUSDCAmount.toFixed(6),
    expectedUSDCWei,
  };
}

// Calculer le montant minimum avec slippage
function calculateMinOutput(
  expectedAmount: string,
  slippagePercent: number
): string {
  const expected = parseFloat(expectedAmount);
  const minAmount = expected * (1 - slippagePercent / 100);
  return minAmount.toFixed(6);
}

// Préparer les paramètres pour exactInputSingle
async function prepareSwapParams(
  walletId: string,
  ethAmount: string,
  minUsdcOut: string
) {
  // Obtenir l'adresse du wallet
  // Note: Dans un vrai cas, tu récupérerais l'adresse via getWallet API
  const walletAddress = "WALLET_ADDRESS_PLACEHOLDER"; // Sera remplacé par Circle

  // Conversion des montants
  const ethAmountWei = (parseFloat(ethAmount) * Math.pow(10, 18)).toString();
  const minUsdcWei = (parseFloat(minUsdcOut) * Math.pow(10, 6)).toString();

  // Paramètres pour Uniswap V3 exactInputSingle
  return {
    tokenIn: SEPOLIA_CONTRACTS.WETH, // WETH sur Sepolia
    tokenOut: SEPOLIA_CONTRACTS.USDC, // USDC sur Sepolia
    fee: 3000, // 0.3% fee tier
    recipient: walletAddress, // Adresse du wallet Circle
    deadline: Math.floor(Date.now() / 1000) + 1800, // 30 minutes
    amountIn: ethAmountWei,
    amountOutMinimum: minUsdcWei,
    sqrtPriceLimitX96: 0, // Pas de limite de prix
  };
}

// Vérifier les balances après le swap
async function checkBalancesAfterSwap(walletId: string) {
  console.log(`\n📊 Checking balances after swap...`);

  const balances = await getWalletBalance(walletId);

  if (balances) {
    balances.forEach((balance) => {
      if (parseFloat(balance.amount) > 0) {
        console.log(`   ${balance.token.symbol}: ${balance.amount}`);
      }
    });
  }
}

// Fonction helper pour swap avec montant exact
export async function swapExactETHToUSDC(
  walletId: string,
  ethAmount: string = "0.001"
) {
  return await swapETHToUSDC({
    walletId,
    ethAmount,
    slippageTolerance: 0.5, // 0.5% slippage
  });
}

// Exemple d'utilisation
export async function exampleSwap() {
  const walletId = "your-wallet-id-here";

  try {
    const result = await swapExactETHToUSDC(walletId, "0.001");

    if (result.success) {
      console.log(`🎉 Swap successful!`);
      console.log(`   Transaction: ${result.transactionId}`);
      console.log(`   Expected USDC: ~${result.expectedUSDC}`);
    } else {
      console.log(`❌ Swap failed: ${result.error}`);
    }
  } catch (error) {
    console.error("Example failed:", error);
  }
}

/*
UTILISATION RAPIDE:

import { swapExactETHToUSDC } from './examples/eth-to-usdc-swap';

// Swap 0.001 ETH vers USDC
const result = await swapExactETHToUSDC("your-wallet-id", "0.001");

if (result.success) {
  console.log("Swap réussi!", result.transactionId);
}
*/

// Exemple de transfert direct (utiliser dans une fonction async)
/*
async function exampleTransfer() {
  const transfer = await createTransaction({
    walletId: "votre-circle-wallet-id",
    tokenId: "usdc-token-id",
    destinationAddress: "0xF389635f844DaA5051aF879a00077C6C9F2aA345", // Wallet utilisateur
    amounts: ["100"], // 100 USDC
    feeLevel: "HIGH",
  });
}
*/
