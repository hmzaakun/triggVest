import { createContractTransaction } from '../services/circle';

// Exemple: Swap sur Uniswap V3 via Circle API
export async function swapUSDCToWETH(
  walletId: string,
  usdcAmount: string,
  minWethAmount: string
) {
  // Adresse du router Uniswap V3 sur Sepolia
  const UNISWAP_V3_ROUTER = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
  
  // ABI pour exactInputSingle
  const swapFunction = "exactInputSingle((address,address,uint24,address,uint256,uint256,uint256,uint160))";
  
  // Paramètres du swap
  const swapParams = [
    {
      tokenIn: "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238", // USDC sur Sepolia
      tokenOut: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14", // WETH sur Sepolia  
      fee: 3000, // 0.3%
      recipient: "WALLET_ADDRESS", // Sera remplacé par l'adresse du wallet
      deadline: Math.floor(Date.now() / 1000) + 1800, // 30 min
      amountIn: usdcAmount,
      amountOutMinimum: minWethAmount,
      sqrtPriceLimitX96: 0
    }
  ];

  try {
    const transaction = await createContractTransaction({
      walletId: walletId,
      contractAddress: UNISWAP_V3_ROUTER,
      abiFunctionSignature: swapFunction,
      abiParameters: swapParams,
      feeLevel: "HIGH"
    });

    console.log("🔄 Swap transaction created:", transaction.data?.id);
    return transaction;
    
  } catch (error) {
    console.error("❌ Swap failed:", error);
    throw error;
  }
}

// Exemple: Swap sur 1inch via Circle API
export async function swap1inch(
  walletId: string,
  fromToken: string,
  toToken: string,
  amount: string
) {
  // 1. Appeler l'API 1inch pour obtenir les calldata
  const swapData = await fetch1inchSwapData(fromToken, toToken, amount);
  
  // 2. Exécuter via Circle
  const transaction = await createContractTransaction({
    walletId: walletId,
    contractAddress: swapData.to, // Adresse du contrat 1inch
    abiFunctionSignature: "swap(bytes)", // Fonction générique
    abiParameters: [swapData.data], // Calldata de 1inch
    feeLevel: "HIGH" // Priorité haute pour les swaps
  });

  return transaction;
}

async function fetch1inchSwapData(fromToken: string, toToken: string, amount: string) {
  // Simuler l'appel API 1inch
  // En réalité, tu appellerais : https://api.1inch.dev/swap/v6.0/1/swap
  return {
    to: "0x111111125421ca6dc452d289314280a0f8842a65", // 1inch router
    data: "0x...", // Calldata du swap
    value: "0"
  };
}

// Utilisation
/*
const swapResult = await swapUSDCToWETH(
  "your-wallet-id",
  "1000000", // 1 USDC (6 decimals)
  "500000000000000" // Min 0.0005 WETH (18 decimals)
);
*/ 