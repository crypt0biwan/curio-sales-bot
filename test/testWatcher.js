const { handleCurioTransfer, getCurioEventsFromBlock, getCurio17bEventsFromBlock } = require("../utils/watcher.js");
const { getUsername } = require("../utils/opensea");

const assert = require("assert");

/* original



const getUsername = async (os, address) => {
	return new Promise((resolve, reject) => {
		os(address)
			.then(function (response) {
				if (response.data.username != null) {
					console.log(response.data.username)
					console.log(response.data.account.user.username)
					resolve(response.data.account.user.username)
				} else {
					resolve(formatETHaddress(address))
				}
			})
			.catch(function (error) {
				console.error(error);
				resolve(formatETHaddress(address))
			})
	})
}
*/

const mockOpenSeaClient = (address) => {
	return new Promise((resolve, reject) => {
		if (address == "0x49468f702436d1e590895ffa7155bcd393ce52ae")
			resolve({
				data: {
					username: "mockUsername",
					account: {
						user: {
							username: "mockUsername"
						}
					}
				}
			});
		else
			resolve({
				data: {
					username: null,
				}
			});
	});
}

describe("Watcher", function () {
	this.timeout(10_000);

	describe("handleCurioTransfer()", function () {
		it("should correctly find the single card 10 transfer in block 14516246", async function () {
			const events = await getCurioEventsFromBlock(14516246);
			assert.equal(events.length, 1);

			const transfer = await handleCurioTransfer(events[0])
			assert.deepEqual(transfer.data, { "10": 1 })
			assert.equal(transfer.totalPrice, 0.3);
		});

		it("should correctly find the 5x card 11 transfer in block 14268794", async function () {
			const events = await getCurioEventsFromBlock(14268794);
			assert.equal(events.length, 1);

			const transfer = await handleCurioTransfer(events[0])
			assert.deepEqual(transfer.data, { "11": 5 });
			assert.equal(transfer.totalPrice, 2);
		});

		it("should correctly find the 1x card transfer 17b in block 15877962", async function () {
			const events = await getCurio17bEventsFromBlock(15877962);
			assert.equal(events.length, 1);

			const transfer = await handleCurioTransfer(events[0])
			assert.deepEqual(transfer.data, { "172": 1 });
			assert.equal(transfer.totalPrice, 1.44999);
		});

		it("should correctly find the single card 4 transfer in block 16771782 (seaport 1.4)", async function () {
			const events = await getCurioEventsFromBlock(16771782);
			assert.equal(events.length, 1);

			const transfer = await handleCurioTransfer(events[0])
			assert.deepEqual(transfer.data, { "4": 1 })
			assert.equal(transfer.totalPrice, 0.7100000000000001); // rounding error?
		});
	});

	describe("bundleSale()", function () {
		it("should return the correct data for a bundle sale", async function () {
			const details = await handleCurioTransfer({
				transactionHash: '0x2ff57b685cab693d9123c2b5ab0a08d5597faab5e3a76e0adc87cc93634f0ede'
			})
			assert.deepEqual(details.data, { "10": 1, "12": 1, "15": 1 })
			assert.equal(details.totalPrice, 0.05)
			assert.equal(details.token, "ETH")
		})
	})

	describe("handleNFTXSales()", function () {
		it("should return the correct data for a NFTX sale (sushiswap)", async function () {
			const details = await handleCurioTransfer({
				transactionHash: '0xdc2f0dfc73e4e0f03ed1819b0ba936a35fd44c4f6812da538a681214589dc5f4'
			})

			assert.equal(details.qty, 0);
			assert.equal(details.card, 0);
			assert.equal(details.totalPrice, 0);
		})
	})

	describe("handleOpenSeaSales()", function () {
		it("should return the correct numbers for an ETH sale", async function () {
			const details = await handleCurioTransfer({
				transactionHash: '0xa87070b789b671f9cdc2abe85dc09b11b7548e3cdb7e9e89916c96e585f8d039'
			})

			assert.equal(details.token, "ETH");
			assert.equal(details.totalPrice, "0.5");
		})

		it("should return the correct numbers for a WETH sale", async function () {
			const details = await handleCurioTransfer({
				transactionHash: '0xe0e164a2dd03d1182e5cc8247a398a137996eee5c8be32577e88419d505a3fef'
			})

			assert.equal(details.token, "WETH");
			assert.equal(details.totalPrice, "0.371");
		})

		it("should return the correct numbers for an USDC sale", async function () {
			const details = await handleCurioTransfer({
				transactionHash: '0x020dd8b60a00665c5c0dbbfca67d2e0ed2c7d678eb641d9fa42cd8bd7f2352d4'
			})

			assert.equal(details.token, "USDC");
			assert.equal(details.totalPrice, "27777.0");

		});
	});

	describe("handleSeaportSales()", function () {
		it("should return the correct numbers for an ETH sale", async function () {
			const details = await handleCurioTransfer({
				transactionHash: '0x6c4f3f7a1ee7bccf446bf65f87b342160d8065658ac0e36a07f6c175464ea2f3'
			})

			assert.equal(details.token, "ETH");
			assert.equal(details.totalPrice, "0.49999");
		})

		it("should return the correct numbers for a WETH sale", async function () {
			const details = await handleCurioTransfer({
				transactionHash: '0xa0f3e19e03db8c9286742529828dde8d17d16935b3dbfb34826fcad6ecd2f145'
			})

			assert.equal(details.token, "WETH");
			assert.equal(details.totalPrice, "0.32");
		})
	})

	describe("handleSeaport_1_5_Sales()", function () {
		it("should return the correct numbers for an ETH sale", async function () {
			const details = await handleCurioTransfer({
				transactionHash: '0xeddfb3b22b48550e4d26f3ce4d4a4330c5960eb013447aa770b3ce71595108e7'
			})

			assert.equal(details.token, "ETH");
			assert.equal(details.totalPrice, "0.155");
		})
	})

	describe("handleLooksRareSales()", function () {
		it("should return the correct numbers for a WETH sale", async function () {
			const details = await handleCurioTransfer({
				transactionHash: '0xe1f9c0f3b55d277da8f72a95c1e98ff023272c59acdc929e878e9c524647e429'
			})

			assert.equal(details.token, "WETH");
			assert.equal(details.totalPrice, "19.25");
		})
	})

	describe("getOpenseaUsername()", function () {
		it("should correctly find the username corresponding to ETH address 0x49468f702436d1e590895ffa7155bcd393ce52ae", async function () {
			const username = await getUsername(mockOpenSeaClient, "0x49468f702436d1e590895ffa7155bcd393ce52ae");

			assert.equal(username, "mockUsername");
		});

		it("should correctly return a formatted ETH address when there's no username available", async function () {
			const username = await getUsername(mockOpenSeaClient, "0xbebf173c83ad4c877c04592de0c38567abf66526");

			assert.equal(username, "0xbeb...526");
		});
	});
});
