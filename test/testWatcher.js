const { handleCurioTransfer, getEventsFromBlock } = require("../utils/watcher.js");
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
});
