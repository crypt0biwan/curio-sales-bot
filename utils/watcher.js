const Ethers = require("ethers");
require('dotenv').config()
const { INFURA_PROJECT_ID, INFURA_SECRET } = process.env

// set up provider
const provider = new Ethers.providers.InfuraProvider("homestead", {
	projectId: INFURA_PROJECT_ID,
	projectSecret: INFURA_SECRET
});

const OPENSEA_CONTRACT = "0x7f268357a8c2552623316e2562d90e642bb538e5";
const OLD_OPENSEA_CONTRACT = "0x7be8076f4ea4a4ad08075c2508e481d6c946d12b";
const wyvernAbi = require("../abis/WyvernExchangeWithBulkCancellations.json");
const wyvernContract = new Ethers.Contract(OPENSEA_CONTRACT, wyvernAbi, provider);
const erc20TokenAbi = require("../abis/ERC20Token.json");

const CURIO_WRAPPER_CONTRACT = "0x73da73ef3a6982109c4d5bdb0db9dd3e3783f313";
const curioAbi = require("../abis/CurioERC1155Wrapper.json");
const curioContract = new Ethers.Contract(CURIO_WRAPPER_CONTRACT, curioAbi, provider);

const LOOKSRARE_CONTRACT = "0x59728544b08ab483533076417fbbb2fd0b17ce3a"
const looksAbi = require("../abis/LooksRare.json");
const looksContract = new Ethers.Contract(LOOKSRARE_CONTRACT, looksAbi, provider);

const UNISWAP_USDC_ETH_LP_CONTRACT = "0xb4e16d0168e52d35cacd2c6185b44281ec28c9dc";
const uniswapAbi = require("../abis/Uniswap_USDC_ETH_LP.json");
const uniswapContract = async () => await new Ethers.Contract(UNISWAP_USDC_ETH_LP_CONTRACT, uniswapAbi, provider);

const getEthUsdPrice = async () => await uniswapContract()
    .then(contract => contract.getReserves())
    .then(reserves => Number(reserves._reserve0) / Number(reserves._reserve1) * 1e12); // times 10^12 because usdc only has 6 decimals

const curioEventFilter = {
	address: CURIO_WRAPPER_CONTRACT,
	topics: [
		Ethers.utils.id("TransferSingle(address,address,address,uint256,uint256)")
	]
};

// this is a helper for the unit test
async function getEventsFromBlock(blockNum) {
	return await curioContract.queryFilter(curioEventFilter, fromBlock=blockNum, toBlock=blockNum);
}

async function handleCurioTransfer(tx) {
	let txReceipt = await provider.getTransactionReceipt(tx.transactionHash);
	let totalPrice = -1
	let token = 'ETH'
	let platform = 'OpenSea'

	let wyvernLogRaw = txReceipt.logs.filter(x => {
		return [OPENSEA_CONTRACT, OLD_OPENSEA_CONTRACT].includes(x.address.toLowerCase())
	});

	let looksRareLogRaw = txReceipt.logs.filter(x => {
		return [
			Ethers.utils.keccak256(Ethers.utils.toUtf8Bytes('TakerBid(bytes32,uint256,address,address,address,address,address,uint256,uint256,uint256)')),
			Ethers.utils.keccak256(Ethers.utils.toUtf8Bytes('TakerAsk(bytes32,uint256,address,address,address,address,address,uint256,uint256,uint256)'))
		].includes(x.topics[0])
	});

	// early return check
	if (wyvernLogRaw.length === 0 && looksRareLogRaw.length === 0) {
		console.log("found transfer, but no associated OpenSea or LooksRare sale");
		return { qty: 0, card: 0, totalPrice: 0};
	}

	// check for OpenSea sale
	if(wyvernLogRaw.length) {
		let wyvernLog = wyvernContract.interface.parseLog(wyvernLogRaw[0]);
	
		// Check if related token transfers instead of a regular ETH buy
		let tokenTransfers = txReceipt.logs.filter(x => {
			return x.topics.includes(Ethers.utils.keccak256(Ethers.utils.toUtf8Bytes('Transfer(address,address,uint256)')))
		});

		if(tokenTransfers.length) {
			// ERC20 token buy
	
			const tokenAddress = tokenTransfers[0].address.toLowerCase()
			const erc20TokenContract = new Ethers.Contract(tokenAddress, erc20TokenAbi, provider);
	
			const symbol = await erc20TokenContract.symbol()
			const decimals = await erc20TokenContract.decimals()
	
			token = symbol
			totalPrice = Ethers.utils.formatUnits(wyvernLog.args.price.toBigInt(), decimals)
		} else {
			// regular ETH buy
	
			totalPrice = Ethers.utils.formatEther(wyvernLog.args.price.toBigInt());
		}
	}

	// check for LooksRare sale
	if(looksRareLogRaw.length) {
		let looksLog = looksContract.interface.parseLog(looksRareLogRaw[0]);

		platform = 'LooksRare'
		token = 'WETH'
		totalPrice = Ethers.utils.formatEther(looksLog.args.price.toBigInt());
	}

	// TODO bundle sale (see test/testWatcher.js)
	
	curioLogRaw = txReceipt.logs.filter(x => {
		return [CURIO_WRAPPER_CONTRACT].includes(x.address.toLowerCase())
	});

	if (curioLogRaw.length === 0) {
		console.error("unable to parse curio transfer from tx receipt!");
		return { qty: 0, card: 0, totalPrice: 0};
	}

	curioLog = curioContract.interface.parseLog(curioLogRaw[0]);

	// which card was transferred?
	let qty = curioLog.args._value.toNumber();
	let card = curioLog.args._id.toNumber();
	let buyer = curioLog.args._to.toLowerCase()
	let seller = curioLog.args._from.toLowerCase()

	// get current ETH price
	let ethPrice = await getEthUsdPrice()

	console.log(`Found curio sale: ${qty}x CRO${card} sold for ${totalPrice}`);
	return { qty, card, totalPrice, buyer, seller, ethPrice, token, platform };
}

function watchForTransfers(transferHandler) {
	provider.on("block", (blockNumber) => {
		console.log("new block: " + blockNumber)
	});

	provider.on(curioEventFilter, async (log) => {
		const transfer = await handleCurioTransfer(log);
		if (transfer.qty > 0) {
			transferHandler(transfer);
		}
	});
}

module.exports = { watchForTransfers, handleCurioTransfer, getEventsFromBlock };
