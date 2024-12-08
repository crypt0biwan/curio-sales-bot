const Ethers = require("ethers");
require('dotenv').config()
let rpc_url = process.env.RPC_URL
if (!rpc_url) {
	console.warn("No RPC_URL provided, falling back to default");
	rpc_url = "https://eth.llamarpc.com";
}
const provider = new Ethers.JsonRpcProvider(rpc_url);

// contract addresses should be lowercase
const OPENSEA_SEAPORT_CONTRACT_1_2 = "0x00000000006c3852cbef3e08e8df289169ede581"
const OPENSEA_SEAPORT_CONTRACT_1_4 = "0x00000000000001ad428e4906ae43d8f9852d0dd6"
const OPENSEA_SEAPORT_CONTRACT_1_5 = "0x00000000000000adc04c56bf30ac9d3c0aaf14dc"
const OPENSEA_SEAPORT_CONTRACT_1_6 = "0x0000000000000068f116a894984e2db1123eb395"
const seaportAbi = require("../abis/SeaPort.json");
const seaportContract = new Ethers.Contract(OPENSEA_SEAPORT_CONTRACT_1_6, seaportAbi, provider);
const erc20TokenAbi = require("../abis/ERC20Token.json");

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

// this is a helper for the unit test
async function getCurioEventsFromBlock(blockNum) {
	return await curioContract.queryFilter(curioContract.filters.TransferSingle(), fromBlock=blockNum, toBlock=blockNum);
}

// this is a helper for the unit test
async function getCurio17bEventsFromBlock(blockNum) {
	return await curio17bContract.queryFilter(curio17bContract.filters.TransferSingle(), fromBlock=blockNum, toBlock=blockNum);
}

let lastTx;
async function handleCurioTransfer(tx) {
	console.log(`Found Curio transfer in tx ${tx.transactionHash}`);
	let txReceipt = await provider.getTransactionReceipt(tx.transactionHash);
	if (lastTx === tx.transactionHash) return {}; // Transaction already seen
	lastTx = tx.transactionHash
	let totalPrice = 0
	let token = 'ETH'
	let platforms = []

	let seaportLogRaw = txReceipt.logs.filter(x => {
		return [
			OPENSEA_SEAPORT_CONTRACT_1_2,
			OPENSEA_SEAPORT_CONTRACT_1_4,
			OPENSEA_SEAPORT_CONTRACT_1_5,
			OPENSEA_SEAPORT_CONTRACT_1_6
		].includes(x.address.toLowerCase())
	});

	let looksRareLogRaw = txReceipt.logs.filter(x => {
		return [
			Ethers.keccak256(Ethers.toUtf8Bytes('TakerBid(bytes32,uint256,address,address,address,address,address,uint256,uint256,uint256)')),
			Ethers.keccak256(Ethers.toUtf8Bytes('TakerAsk(bytes32,uint256,address,address,address,address,address,uint256,uint256,uint256)'))
		].includes(x.topics[0])
	});

	// early return check
	if (seaportLogRaw.length === 0 && looksRareLogRaw.length === 0) {
		console.log("found transfer, but no associated OpenSea (Seaport) or LooksRare sale");
		return { qty: 0, card: 0, totalPrice: 0};
	}

	// check for OpenSea (Seaport contract) sale
	if(seaportLogRaw.length) {
		platforms.push("OpenSea")
		// Check if related token transfers instead of a regular ETH buy
		let tokenTransfers = txReceipt.logs.filter(x => {
			return x.topics.includes(Ethers.keccak256(Ethers.toUtf8Bytes('Transfer(address,address,uint256)')))
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

			// added a try/catch, the event OrdersMatched apparently failed here
			try {
				if (tokenTransfers.length) {
					totalPrice += parseFloat(Ethers.formatUnits(seaportLog.args.offer[0].amount, decimals))
				} else {
					// regular ETH buy

					// OrderFulfilled(bytes32 orderHash,address offerer,address zone,address recipient,(uint8 itemType,address token,uint256 identifier,uint256 amount)[],(uint8 itemType,address token,uint256 identifier,uint256 amount,address recipient)[])
					// OrderFulfilled(bytes32,address,address,address,(uint8,address,uint256,uint256)[],(uint8,address,uint256,uint256,address)[])
					// method 0x9d9af8e3

					try {
						// get the transfers of the last argument of the OrderFulfilled method
						for (let transfer of seaportLog.args[seaportLog.args.length-1]) {
							totalPrice += parseFloat(Ethers.formatEther(transfer.amount, 'hex'))
						}
					} catch(e) {
						console.warn(e)
						console.warn(log)
					}
				}
			} catch(e) {
				console.warn(e)
				console.warn(`Unable to parse log with logIndex: ${log.logIndex} of tx ${lastTx}`)
			}
		}
	}

	// check for LooksRare sale
	if(looksRareLogRaw.length) {
		platforms.push("LooksRare")
		for (let log of looksRareLogRaw) {
			let looksLog = looksContract.interface.parseLog(log);
			totalPrice += parseFloat(Ethers.formatEther(looksLog.args.price));
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
		let qty = Number(curioLog.args[4]);
		let card = Number(curioLog.args[3]);
		sellers.push(curioLog.args[1].toLowerCase());
		buyer = curioLog.args[2].toLowerCase();
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

	totalPrice = totalPrice.toFixed(3) // round to 3 decimals
	console.log(`Found curio sale: ${sales.join(", ")} sold for ${totalPrice} ${token}`)
	return { data, totalPrice, buyer, seller, ethPrice, token, platforms };
}

function watchForTransfers(transferHandler) {
    curioContract.on(curioContract.filters.TransferSingle(), async (_from, _to, _id, _value, event) => {
		console.log(`Found Curio transfer in tx ${event.transactionHash}`);
		console.log(`args: ${_from}, ${_to}, ${_id}, ${_value}, ${event}`);

        try {
            const transfer = await handleCurioTransfer(event.log);
            if (transfer.data) {
                transferHandler(transfer);
            }
        } catch (e) {
            console.error(e);
        }
    });

	curio17bContract.on(curio17bContract.filters.TransferSingle(), async (_from, _to, _id, _value, event) => {
		try {
			const transfer = await handleCurioTransfer(event.log);
			if (transfer.data) {
				transferHandler(transfer);
			}
		} catch (e) {
			console.error(e);
		}
	});
}

module.exports = { watchForTransfers, handleCurioTransfer, getCurioEventsFromBlock, getCurio17bEventsFromBlock };
