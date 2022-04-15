const { handleCurioTransfer, getEventsFromBlock } = require("../utils/watcher.js");
const { getUsername } = require("../utils/opensea");

const assert = require("assert");

describe("Watcher", function () {
    this.timeout(10_000);

	describe("handleCurioTransfer()", function () {
		it("should correctly find the single card 10 transfer in block 14516246", async function () {
			const events = await getEventsFromBlock(14516246);
			assert(events.length === 1);

			const transfer = await handleCurioTransfer(events[0])
			assert.equal(transfer.qty, 1);
			assert.equal(transfer.card, 10);
			assert.equal(transfer.totalPrice, 0.3);
		});

		it("should correctly find the 5x card 11 transfer in block 14268794", async function () {
			const events = await getEventsFromBlock(14268794);
			assert(events.length === 1);

			const transfer = await handleCurioTransfer(events[0])
			assert.equal(transfer.qty, 5);
			assert.equal(transfer.card, 11);
			assert.equal(transfer.totalPrice, 2.0);
		});
	});

	// TODO
	// describe("bundleSale()", function () {
	// 	it("should return the correct numbers for a bundle sale", async function() {
	// 		const details = await handleCurioTransfer({
	// 			transactionHash: '0x2ff57b685cab693d9123c2b5ab0a08d5597faab5e3a76e0adc87cc93634f0ede'
	// 		})

	// 		console.log(details)
	// 	})
	// })

	describe("handleNFTXSales()", function() {
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
		it("should return the correct numbers for an ETH sale", async function() {
			const details = await handleCurioTransfer({
				transactionHash: '0xa87070b789b671f9cdc2abe85dc09b11b7548e3cdb7e9e89916c96e585f8d039'
			})

			assert.equal(details.token, "ETH");
			assert.equal(details.totalPrice, "0.5");
		})
	
		it("should return the correct numbers for a WETH sale", async function() {
			const details = await handleCurioTransfer({
				transactionHash: '0xe0e164a2dd03d1182e5cc8247a398a137996eee5c8be32577e88419d505a3fef'
			})

			assert.equal(details.token, "WETH");
			assert.equal(details.totalPrice, "0.371");
		})
	
		it("should return the correct numbers for an USDC sale", async function() {
			const details = await handleCurioTransfer({
				transactionHash: '0x020dd8b60a00665c5c0dbbfca67d2e0ed2c7d678eb641d9fa42cd8bd7f2352d4'
			})

			assert.equal(details.token, "USDC");
			assert.equal(details.totalPrice, "27777.0");

		});
	});

	describe("handleLooksRareSales()", function () {
		it("should return the correct numbers for a WETH sale", async function() {
			const details = await handleCurioTransfer({
				transactionHash: '0xe1f9c0f3b55d277da8f72a95c1e98ff023272c59acdc929e878e9c524647e429'
			})

			assert.equal(details.token, "WETH");
			assert.equal(details.totalPrice, "19.25");
		})
	})

	describe("getOpenseaUsername()", function () {
		it("should correctly find the username corresponding to ETH address 0x49468f702436d1e590895ffa7155bcd393ce52ae", async function () {
			const username = await getUsername("0x49468f702436d1e590895ffa7155bcd393ce52ae");

			assert.equal(username, "crypt0biwan");
		});

		it("should correctly return a formatted ETH address when there's no username available", async function () {
			const username = await getUsername("0xbebf173c83ad4c877c04592de0c38567abf66526");

			assert.equal(username, "0xbeb...526");
		});
	});
});
