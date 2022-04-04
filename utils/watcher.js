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

const CURIO_WRAPPER_CONTRACT = "0x73DA73EF3a6982109c4d5BDb0dB9dd3E3783f313";
const curioAbi = require("../abis/CurioERC1155Wrapper.json");
const curioContract = new Ethers.Contract(CURIO_WRAPPER_CONTRACT, curioAbi, provider);

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

async function handleCurioTransfer(curioLog) {
	txReceipt = await curioLog.getTransactionReceipt();
	wyvernLogRaw = txReceipt.logs.filter(x => {
		return [OPENSEA_CONTRACT.toLowerCase(), OLD_OPENSEA_CONTRACT.toLowerCase()].includes(x.address.toLowerCase())
	});
	if (wyvernLogRaw.length === 0) {
		console.log("found transfer, but no associated wyvern sale");
		return { qty: 0, card: 0, totalPrice: 0};
	}

	// todo- Handle the scenario where a curio card was traded for erc20 instead of ethereum/weth... (currently unhandled, will show as a strange price)
	wyvernLog = wyvernContract.interface.parseLog(wyvernLogRaw[0])
	totalPrice = Ethers.utils.formatEther(wyvernLog.args.price.toBigInt());

	// which card was transferred?
	qty = curioLog.args._value.toNumber();
	card = curioLog.args._id.toNumber()

	console.log(`Found curio sale: ${qty}x CRO${card} sold for ${totalPrice}`);
	return { qty, card, totalPrice };
}

function watchForTransfers(transferHandler) {
	provider.on("block", (blockNumber) => {
		console.log("new block: " + blockNumber)
	});

	provider.on(curioEventFilter, (log) => {
		const transfer = handleCurioTransfer(log, transferHandler);
		if (transfer.qty > 0) {
			transferHandler(transfer);
		}
	});
}

module.exports = { watchForTransfers, handleCurioTransfer, getEventsFromBlock };
