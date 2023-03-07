const Ethers = require("ethers");
require('dotenv').config()
const { INFURA_PROJECT_ID, INFURA_SECRET } = process.env

// set up provider
const provider = new Ethers.providers.InfuraProvider("homestead", {
	projectId: INFURA_PROJECT_ID,
	projectSecret: INFURA_SECRET
});

// contract addresses should be lowercase
const OPENSEA_CONTRACT = "0x7f268357a8c2552623316e2562d90e642bb538e5";
const OLD_OPENSEA_CONTRACT = "0x7be8076f4ea4a4ad08075c2508e481d6c946d12b";
const wyvernAbi = require("../abis/WyvernExchangeWithBulkCancellations.json");
const wyvernContract = new Ethers.Contract(OPENSEA_CONTRACT, wyvernAbi, provider);
const erc20TokenAbi = require("../abis/ERC20Token.json");

const OPENSEA_SEAPORT_CONTRACT_1_2 = "0x00000000006c3852cbef3e08e8df289169ede581"
const OPENSEA_SEAPORT_CONTRACT_1_4 = "0x00000000000001ad428e4906ae43d8f9852d0dd6"
const seaportAbi = require("../abis/SeaPort.json");
const seaportContract = new Ethers.Contract(OPENSEA_SEAPORT_CONTRACT_1_4, seaportAbi, provider);

const CURIO_WRAPPER_CONTRACT = "0x73da73ef3a6982109c4d5bdb0db9dd3e3783f313";
const CURIO_17B_WRAPPER_CONTRACT = "0x04afa589e2b933f9463c5639f412b183ec062505";
const curioAbi = require("../abis/CurioERC1155Wrapper.json");
const curioContract = new Ethers.Contract(CURIO_WRAPPER_CONTRACT, curioAbi, provider);
const curio17bContract = new Ethers.Contract(CURIO_17B_WRAPPER_CONTRACT, curioAbi, provider);

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

const curio17bEventFilter = {
	address: CURIO_17B_WRAPPER_CONTRACT,
	topics: [
		Ethers.utils.id("TransferSingle(address,address,address,uint256,uint256)")
	]
};

// this is a helper for the unit test
async function getCurioEventsFromBlock(blockNum) {
	return await curioContract.queryFilter(curioEventFilter, fromBlock=blockNum, toBlock=blockNum);
}

// this is a helper for the unit test
async function getCurio17bEventsFromBlock(blockNum) {
	return await curio17bContract.queryFilter(curio17bEventFilter, fromBlock=blockNum, toBlock=blockNum);
}

let lastTx;
async function handleCurioTransfer(tx) {
	let txReceipt = await provider.getTransactionReceipt(tx.transactionHash);
	if (lastTx === tx.transactionHash) return {}; // Transaction already seen
	lastTx = tx.transactionHash
	let totalPrice = 0
	let token = 'ETH'
	let platforms = []
	let wyvernLogRaw = txReceipt.logs.filter(x => {
		return [OPENSEA_CONTRACT, OLD_OPENSEA_CONTRACT].includes(x.address.toLowerCase())
	});

	let seaportLogRaw = txReceipt.logs.filter(x => {
		return [OPENSEA_SEAPORT_CONTRACT_1_2, OPENSEA_SEAPORT_CONTRACT_1_4].includes(x.address.toLowerCase())
	});

	let looksRareLogRaw = txReceipt.logs.filter(x => {
		return [
			Ethers.utils.keccak256(Ethers.utils.toUtf8Bytes('TakerBid(bytes32,uint256,address,address,address,address,address,uint256,uint256,uint256)')),
			Ethers.utils.keccak256(Ethers.utils.toUtf8Bytes('TakerAsk(bytes32,uint256,address,address,address,address,address,uint256,uint256,uint256)'))
		].includes(x.topics[0])
	});

	// early return check
	if (wyvernLogRaw.length === 0 && seaportLogRaw.length === 0 && looksRareLogRaw.length === 0) {
		console.log("found transfer, but no associated OpenSea (Wyvern or Seaport) or LooksRare sale");
		return { qty: 0, card: 0, totalPrice: 0};
	}

	// check for OpenSea (Wyvern contract) sale
	if(wyvernLogRaw.length) {
		platforms.push("OpenSea")
		// Check if related token transfers instead of a regular ETH buy
		let tokenTransfers = txReceipt.logs.filter(x => {
			return x.topics.includes(Ethers.utils.keccak256(Ethers.utils.toUtf8Bytes('Transfer(address,address,uint256)')))
		});
		// ERC20 token buy
		let decimals;
		if (tokenTransfers.length) {
			const tokenAddress = tokenTransfers[0].address.toLowerCase()
			const erc20TokenContract = new Ethers.Contract(tokenAddress, erc20TokenAbi, provider);
			
			const symbol = await erc20TokenContract.symbol()
			decimals = await erc20TokenContract.decimals()
			token = symbol
		}
		for (let log of wyvernLogRaw) {
			let wyvernLog = wyvernContract.interface.parseLog(log);

			if(tokenTransfers.length) {
				totalPrice += parseFloat(Ethers.utils.formatUnits(wyvernLog.args.price.toBigInt(), decimals))
			} else {
				// regular ETH buy
				totalPrice += parseFloat(Ethers.utils.formatEther(wyvernLog.args.price.toBigInt()));
			}
		}
	}

	// check for OpenSea (Seaport contract) sale
	if(seaportLogRaw.length) {
		platforms.push("OpenSea")
		// Check if related token transfers instead of a regular ETH buy
		let tokenTransfers = txReceipt.logs.filter(x => {
			return x.topics.includes(Ethers.utils.keccak256(Ethers.utils.toUtf8Bytes('Transfer(address,address,uint256)')))
		});
		// ERC20 token buy
		let decimals;
		if (tokenTransfers.length) {
			const tokenAddress = tokenTransfers[0].address.toLowerCase()
			const erc20TokenContract = new Ethers.Contract(tokenAddress, erc20TokenAbi, provider);
			
			const symbol = await erc20TokenContract.symbol()
			decimals = await erc20TokenContract.decimals()
			token = symbol
		}
		for (let log of seaportLogRaw) {
			let seaportLog = seaportContract.interface.parseLog(log);

			if(tokenTransfers.length) {
				totalPrice += parseFloat(Ethers.utils.formatUnits(seaportLog.args.offer[0].amount.toBigInt(), decimals))
			} else {
				// regular ETH buy
				
				// OrderFulfilled(bytes32 orderHash,address offerer,address zone,address recipient,(uint8 itemType,address token,uint256 identifier,uint256 amount)[],(uint8 itemType,address token,uint256 identifier,uint256 amount,address recipient)[])
				// OrderFulfilled(bytes32,address,address,address,(uint8,address,uint256,uint256)[],(uint8,address,uint256,uint256,address)[])
				// method 0x9d9af8e3
				
				try {
					// get the transfers of the last argument of the OrderFulfilled method
					for(let transfer of seaportLog.args[seaportLog.args.length-1]) {
						totalPrice += parseFloat(Ethers.utils.formatEther(Ethers.BigNumber.from(transfer.amount, 'hex')))
					} 
				} catch(e) {
					// added some logging since the bot crashes no a rare occasion
					console.log(e)
					console.log(log)
				}
			}
		}
	}

	// check for LooksRare sale
	if(looksRareLogRaw.length) {
		platforms.push("LooksRare")
		for (let log of looksRareLogRaw) {
			let looksLog = looksContract.interface.parseLog(log);
			totalPrice += parseFloat(Ethers.utils.formatEther(looksLog.args.price.toBigInt()));
		}
		token = 'WETH'
	}

	
	curioLogRaw = txReceipt.logs.filter(x => {
		return [CURIO_WRAPPER_CONTRACT, CURIO_17B_WRAPPER_CONTRACT].includes(x.address.toLowerCase())
	});

	if (curioLogRaw.length === 0) {
		console.error("unable to parse curio transfer from tx receipt!");
		return { qty: 0, card: 0, totalPrice: 0};
	}
	let ethPrice = await getEthUsdPrice()

	let data = {}
	let buyer;
	let seller;
	let sellers = []
	
	for (let log of curioLogRaw) {
		curioLog = curioContract.interface.parseLog(log);
		// which card was transferred?
		let qty = curioLog.args._value.toNumber();
		let card = curioLog.args._id.toString();
		sellers.push(curioLog.args._from.toLowerCase())
		buyer = curioLog.args._to.toLowerCase()
		if (!data[card]) {
			data[card] = 0;
		}
		data[card] += qty

	}
	seller = (sellers.every((val, i, arr) => val === arr[0])) ? sellers[0] : seller = "Multiple" // Check if multiple sellers, if so, seller is "Multiple" instead of a single seller
	let sales = []
	for ( const [card, qty] of Object.entries(data)) {
		sales.push(`${qty}x CRO${card}`)
	}
	console.log(`Found curio sale: ${sales.join(", ")} sold for ${totalPrice} ${token}`)
	return { data, totalPrice, buyer, seller, ethPrice, token, platforms };
}

function watchForTransfers(transferHandler) {
	provider.on(curioEventFilter, async (log) => {
		try {
			const transfer = await handleCurioTransfer(log);
			if (transfer.data) {
				transferHandler(transfer);
			}
		} catch (e) {
			console.error(e);
		}
	});

	provider.on(curio17bEventFilter, async (log) => {
		try {
			const transfer = await handleCurioTransfer(log);
			if (transfer.data) {
				transferHandler(transfer);
			}
		} catch (e) {
			console.error(e);
		}
	});
}

module.exports = { watchForTransfers, handleCurioTransfer, getCurioEventsFromBlock, getCurio17bEventsFromBlock };
