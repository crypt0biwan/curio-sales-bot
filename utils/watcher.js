const Ethers = require("ethers");
const { describeError } = require("./errors");
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
async function handleCurioTransfer(eventLog) {
	console.log(`Found Curio transfer in tx ${eventLog.transactionHash}`);
	let txReceipt = await provider.getTransactionReceipt(eventLog.transactionHash);
	// no "already seen" check here: the watcher dedupes by tx hash, and it retries this
	// function when it fails, so a retry of the same tx must not be skipped
	lastTx = eventLog.transactionHash
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

			// parseLog returns null for events not in our ABI (e.g. OrdersMatched on Seaport 1.4+).
			// Only OrderFulfilled carries the price, so skip anything else quietly.
			if (!seaportLog) continue;
			if (seaportLog.name !== "OrderFulfilled") continue;

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
						console.warn(describeError(e))
						console.warn(log)
					}
				}
			} catch(e) {
				console.warn(describeError(e))
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

const POLL_INTERVAL_MS = 15_000; // about one post-merge block every 12s
const RESCAN_BLOCKS = 5; // re-read the last few blocks: late indexing, short reorgs, a node whose head goes back
const MAX_BLOCK_RANGE = 1000; // catch up in chunks after a long outage
const MAX_ATTEMPTS = 20; // retry a transaction that failed to process for ~5 minutes of working RPC

// Watches for logs with stateless eth_getLogs queries over block ranges instead of
// ethers' server-side filter (eth_newFilter + eth_getFilterChanges). RPC nodes like
// Alchemy forget filters ("filter not found") and ethers v6 never recreates them, so
// the bot kept running but silently stopped posting. Here every poll is a fresh query,
// and the block cursor only advances after a successful query, so anything that
// happened while the RPC was failing is picked up by the next successful poll.
function createLogPoller({ provider, filter, onLog, intervalMs = POLL_INTERVAL_MS, maxBlockRange = MAX_BLOCK_RANGE, logger = console }) {
	let startBlock = null; // block we started watching at; never scan at or below it
	let lastBlock = null; // highest block scanned successfully; never goes back
	let failures = 0;
	let running = false;
	let timer = null;
	const seenTx = new Map(); // tx hash -> block, for every tx in blocks we may still rescan
	const retryTx = new Map(); // tx hash -> { eventLog, attempts }, for txs whose onLog failed

	async function handle(eventLog) {
		const hash = eventLog.transactionHash;
		try {
			await onLog(eventLog);
			retryTx.delete(hash);
		} catch (e) {
			const attempts = (retryTx.has(hash) ? retryTx.get(hash).attempts : 0) + 1;
			if (attempts < MAX_ATTEMPTS) {
				retryTx.set(hash, { eventLog, attempts });
				if (attempts === 1) logger.error(`Watcher: failed to process tx ${hash}, will retry: ${describeError(e)}`);
			} else {
				retryTx.delete(hash);
				// fixed prefix so a daily journal grep finds every sale that was never posted
				logger.error(`SALE DROPPED after ${MAX_ATTEMPTS} attempts: ${hash}: ${describeError(e)}`);
			}
		}
	}

	async function tick() {
		let fromBlock, toBlock;
		try {
			const head = await provider.getBlockNumber();
			if (lastBlock === null) {
				startBlock = lastBlock = head;
			}
			// If the head went back (reorg or a lagging node), this rescans up to that head,
			// so replacement logs are found; rollbacks deeper than RESCAN_BLOCKS are not handled.
			fromBlock = Math.max(startBlock + 1, lastBlock + 1 - RESCAN_BLOCKS);
			toBlock = Math.min(head, lastBlock + maxBlockRange);
			let logs = [];
			// no new block: skip the scan, but still run the retries below
			if (head !== lastBlock && fromBlock <= toBlock) {
				logs = await provider.getLogs({ ...filter, fromBlock, toBlock });

				if (failures > 0) {
					logger.log(`Watcher: RPC recovered after ${failures} failed poll(s), rescanned blocks ${fromBlock}-${toBlock} for missed events`);
					failures = 0;
				}
				lastBlock = Math.max(lastBlock, toBlock);
			}

			// retry earlier failures only now that the RPC is answering
			for (const { eventLog } of [...retryTx.values()]) {
				await handle(eventLog);
			}
			for (const eventLog of logs) {
				// one post per transaction, even if it is seen again by a rescan
				if (eventLog.removed || seenTx.has(eventLog.transactionHash)) continue;
				seenTx.set(eventLog.transactionHash, eventLog.blockNumber);
				await handle(eventLog);
			}
			// forget txs in blocks that will never be rescanned
			for (const [hash, block] of seenTx) {
				if (block <= lastBlock - RESCAN_BLOCKS) seenTx.delete(hash);
			}
		} catch (e) {
			failures++;
			// log the first failure, then only occasionally, to avoid flooding the journal
			if (failures === 1 || failures % 100 === 0) {
				const range = (fromBlock === undefined) ? "" : ` (blocks ${fromBlock}-${toBlock})`;
				logger.error(`Watcher: RPC poll failed${range}, ${failures} in a row, will retry: ${describeError(e)}`);
			}
		}
	}

	async function loop() {
		await tick(); // never throws
		if (running) timer = setTimeout(loop, intervalMs);
	}

	return {
		tick,
		start() {
			if (running) return;
			running = true;
			loop();
		},
		stop() {
			running = false;
			clearTimeout(timer);
		},
		get seenTxCount() { return seenTx.size; },
		get retryTxCount() { return retryTx.size; }
	};
}

// TransferSingle on either Curio wrapper (both use the same ABI)
const curioTransferFilter = {
	address: [CURIO_WRAPPER_CONTRACT, CURIO_17B_WRAPPER_CONTRACT],
	topics: [curioContract.interface.getEvent("TransferSingle").topicHash]
};

// options are for tests: { provider, handleTransfer, logger, intervalMs }
function watchForTransfers(transferHandler, { handleTransfer = handleCurioTransfer, ...options } = {}) {
	const logger = options.logger || console;
	const poller = createLogPoller({
		provider,
		filter: curioTransferFilter,
		onLog: async (eventLog) => {
			// only chain reads so far, so a failure here is safely retried by the poller
			const transfer = await handleTransfer(eventLog);
			if (!transfer.data) return;
			try {
				await transferHandler(transfer);
			} catch (e) {
				// posting is not idempotent, so never retry it
				logger.error(`Watcher: sale handler failed for tx ${eventLog.transactionHash}: ${describeError(e)}`);
			}
		},
		...options
	});
	poller.start();
	return poller;
}

module.exports = { watchForTransfers, createLogPoller, curioTransferFilter, MAX_ATTEMPTS, handleCurioTransfer, getCurioEventsFromBlock, getCurio17bEventsFromBlock };
