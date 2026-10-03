const Ethers = require("ethers");
const assert = require("assert");
const { createLogPoller, watchForTransfers, curioTransferFilter, MAX_ATTEMPTS } = require("../utils/watcher.js");
const { getUsername } = require("../utils/opensea");

const TRANSFER_SINGLE = curioTransferFilter.topics[0];
const CURIO = "0x73da73ef3a6982109c4d5bdb0db9dd3e3783f313";
const FAKE_URL = "https://eth-mainnet.example/v2/SECRET-KEY-DO-NOT-LOG";

// A fake Ethereum node behind a real ethers JsonRpcProvider, so requests and
// JSON-RPC errors go through ethers' own code paths. Like Alchemy it supports
// server-side filters and can forget them ("filter not found").
function fakeNode() {
	const node = {
		head: 100,
		logs: [], // raw logs "mined" so far
		failNext: 0, // fail this many eth_getLogs calls
		failWith: { code: -32000, message: "filter not found" },
		calls: [],
		filters: new Map(),
		forgetFilters() { node.filters.clear(); },
		mine(n = 1) { node.head += n; },
		addLog(blockNumber, txHash) {
			node.logs.push({
				address: CURIO,
				topics: [TRANSFER_SINGLE, Ethers.ZeroHash, Ethers.ZeroHash, Ethers.ZeroHash],
				data: "0x",
				blockNumber: Ethers.toQuantity(blockNumber),
				blockHash: Ethers.zeroPadValue(Ethers.toBeHex(blockNumber), 32),
				transactionHash: txHash,
				transactionIndex: "0x0",
				logIndex: "0x0",
				removed: false
			});
		},
		count(method) { return node.calls.filter(m => m === method).length; }
	};

	function answer({ id, method, params }) {
		node.calls.push(method);
		switch (method) {
			case "eth_chainId": return { id, result: "0x1" };
			case "eth_blockNumber": return { id, result: Ethers.toQuantity(node.head) };
			case "eth_getLogs": {
				if (node.failNext > 0) {
					node.failNext--;
					return { id, error: node.failWith };
				}
				const from = Number(params[0].fromBlock), to = Number(params[0].toBlock);
				return { id, result: node.logs.filter(l => Number(l.blockNumber) >= from && Number(l.blockNumber) <= to) };
			}
			case "eth_newFilter": {
				const filterId = Ethers.toQuantity(node.filters.size + 1);
				node.filters.set(filterId, true);
				return { id, result: filterId };
			}
			case "eth_getFilterChanges":
				if (!node.filters.has(params[0])) return { id, error: { code: -32000, message: "filter not found" } };
				return { id, result: [] };
			default:
				return { id, error: { code: -32601, message: `the method ${method} does not exist` } };
		}
	}

	const provider = new Ethers.JsonRpcProvider(FAKE_URL, 1, { staticNetwork: true, batchMaxCount: 1, cacheTimeout: -1, pollingInterval: 10 });
	provider._send = async (payload) => [answer(payload)];
	node.provider = provider;
	return node;
}

function capture() {
	const lines = [];
	return {
		lines,
		log: (...a) => lines.push(["log", a.join(" ")]),
		error: (...a) => lines.push(["error", a.map(String).join(" ")])
	};
}

function newWatcher(node, logger, opts = {}) {
	const delivered = [];
	const poller = createLogPoller({
		provider: node.provider,
		filter: curioTransferFilter,
		onLog: (log) => { delivered.push(log.transactionHash); },
		logger,
		...opts
	});
	return { poller, delivered };
}

const tx = (n) => Ethers.zeroPadValue(Ethers.toBeHex(n), 32);

describe("Watcher recovery (stubbed RPC)", function () {
	it("(reproduces the bug) ethers' own contract.on() goes silent once the node forgets its filter", async function () {
		const node = fakeNode();
		const contract = new Ethers.Contract(CURIO, ["event TransferSingle(address indexed, address indexed, address indexed, uint256, uint256)"], node.provider);
		const origLog = console.log;
		console.log = () => {}; // ethers prints "@TODO <error>" for every failed eth_getFilterChanges
		try {
			await contract.on(contract.filters.TransferSingle(), () => {});
			await new Promise(r => setTimeout(r, 50));
			node.forgetFilters();
			node.mine(5);
			await new Promise(r => setTimeout(r, 100));
			assert.equal(node.count("eth_newFilter"), 1, "ethers never recreates the filter");
			assert.ok(node.count("eth_getFilterChanges") > 1);
		} finally {
			console.log = origLog;
			node.provider.destroy();
		}
	});

	it("never relies on a server-side filter, so a node forgetting filters cannot stop it", async function () {
		const node = fakeNode();
		const logger = capture();
		const { poller, delivered } = newWatcher(node, logger);

		await poller.tick(); // starts at head 100
		node.forgetFilters(); // what Alchemy did on Sep 22
		node.mine(); node.addLog(101, tx(1));
		await poller.tick();
		node.forgetFilters();
		node.mine(); node.addLog(102, tx(2));
		await poller.tick();

		assert.deepEqual(delivered, [tx(1), tx(2)]);
		assert.equal(node.count("eth_newFilter"), 0);
		assert.equal(node.count("eth_getFilterChanges"), 0);
		assert.equal(logger.lines.length, 0);
	});

	it("recovers after 'filter not found' RPC errors and events resume", async function () {
		const node = fakeNode();
		const logger = capture();
		const { poller, delivered } = newWatcher(node, logger);

		await poller.tick();
		node.failNext = 3;
		for (let i = 0; i < 3; i++) {
			node.mine();
			await poller.tick();
		}
		assert.deepEqual(delivered, []);

		node.mine(); node.addLog(node.head, tx(7));
		await poller.tick();
		assert.deepEqual(delivered, [tx(7)]);

		node.mine(); node.addLog(node.head, tx(8));
		await poller.tick();
		assert.deepEqual(delivered, [tx(7), tx(8)]);

		const recovered = logger.lines.filter(([, l]) => l.includes("recovered"));
		assert.equal(recovered.length, 1, "exactly one recovery log line");
		assert.match(recovered[0][1], /after 3 failed poll\(s\), rescanned blocks 101-104/);
		const failed = logger.lines.filter(([, l]) => l.includes("poll failed"));
		assert.equal(failed.length, 1, "only the first failure of a streak is logged");
		assert.match(failed[0][1], /filter not found/);
	});

	it("delivers a sale that happened during the outage exactly once", async function () {
		const node = fakeNode();
		const logger = capture();
		const { poller, delivered } = newWatcher(node, logger);

		await poller.tick();
		node.failNext = 5;
		node.mine(); node.addLog(101, tx(42)); // sale while the RPC is failing
		for (let i = 0; i < 5; i++) {
			node.mine();
			await poller.tick();
		}
		assert.deepEqual(delivered, []);

		// recovery, then several more polls whose rescan window still covers block 101
		for (let i = 0; i < 6; i++) {
			node.mine();
			await poller.tick();
		}
		assert.deepEqual(delivered, [tx(42)]);
	});

	it("does not re-deliver a transaction that emitted several TransferSingle logs", async function () {
		const node = fakeNode();
		const { poller, delivered } = newWatcher(node, capture());
		await poller.tick();
		node.mine(); node.addLog(101, tx(5)); node.addLog(101, tx(5));
		await poller.tick();
		node.mine();
		await poller.tick();
		assert.deepEqual(delivered, [tx(5)]);
	});

	it("does not storm the RPC or the log on persistent errors, and never throws", async function () {
		const node = fakeNode();
		node.failWith = { code: -32603, message: "internal error" };
		const logger = capture();
		const { poller, delivered } = newWatcher(node, logger);

		await poller.tick();
		node.failNext = Infinity;
		const before = node.calls.length;
		for (let i = 0; i < 250; i++) {
			node.mine();
			await poller.tick(); // must resolve, not reject
		}
		// one eth_blockNumber + one eth_getLogs per poll, no retries or re-subscriptions
		assert.equal(node.calls.length - before, 500);
		assert.equal(node.count("eth_newFilter"), 0);
		assert.equal(logger.lines.length, 3, "logs failures 1, 100 and 200 only");
		assert.deepEqual(delivered, []);
	});

	it("catches up after a long outage in bounded block ranges without gaps", async function () {
		const node = fakeNode();
		const logger = capture();
		const { poller, delivered } = newWatcher(node, logger, { maxBlockRange: 1000 });
		const ranges = [];
		const getLogs = node.provider.getLogs.bind(node.provider);
		node.provider.getLogs = (f) => { ranges.push([f.fromBlock, f.toBlock]); return getLogs(f); };

		await poller.tick(); // head 100
		node.failNext = 1;
		node.mine(2500); // ~8h of blocks
		node.addLog(150, tx(1)); node.addLog(1700, tx(2)); node.addLog(2600, tx(3));
		await poller.tick(); // fails
		for (let i = 0; i < 3; i++) await poller.tick();

		assert.deepEqual(delivered, [tx(1), tx(2), tx(3)]);
		assert.ok(ranges.every(([f, t]) => t - f + 1 <= 1000 + 5), "range bounded");
		assert.equal(ranges[ranges.length - 1][1], 2600);
	});

	it("forgets seen transactions once their block can no longer be rescanned", async function () {
		const node = fakeNode();
		const { poller, delivered } = newWatcher(node, capture());
		await poller.tick();
		for (let i = 1; i <= 1500; i++) node.addLog(101, tx(i));
		node.mine();
		await poller.tick();
		assert.equal(delivered.length, 1500);
		assert.equal(poller.seenTxCount, 1500);
		for (let i = 0; i < 6; i++) { node.mine(); await poller.tick(); }
		assert.equal(poller.seenTxCount, 0);
		assert.equal(delivered.length, 1500);
	});

	// Review finding 2: count-based eviction re-delivered a sale still inside the rescan window
	it("does not re-deliver a sale when many other transactions follow it inside the rescan window", async function () {
		const node = fakeNode();
		const { poller, delivered } = newWatcher(node, capture());
		await poller.tick();
		node.mine(); node.addLog(101, tx(99999));
		await poller.tick();
		node.mine(); for (let i = 1; i <= 1001; i++) node.addLog(102, tx(i));
		await poller.tick();
		node.mine();
		await poller.tick(); // rescans 101-103
		assert.equal(delivered.filter(h => h === tx(99999)).length, 1);
		assert.equal(delivered.length, 1002);
	});

	// Review finding 3: a head that went back used to skip polling until it passed the old head
	it("picks up a replacement sale right away when the node's head goes back", async function () {
		const node = fakeNode();
		const { poller, delivered } = newWatcher(node, capture());
		await poller.tick(); // 100
		node.mine(); await poller.tick(); // 101
		node.mine(); node.addLog(102, tx(1)); await poller.tick(); // 102
		assert.deepEqual(delivered, [tx(1)]);
		// reorg: blocks 101-102 replaced, the node now reports head 100, then 101
		node.logs.length = 0;
		node.head = 100; await poller.tick();
		node.head = 101; node.addLog(101, tx(2)); await poller.tick();
		assert.deepEqual(delivered, [tx(1), tx(2)]);
	});

	// Review finding 1: the tx was marked seen before processing, so a failure lost the sale for good
	it("retries a transaction whose processing failed and delivers it once", async function () {
		const node = fakeNode();
		const logger = capture();
		const delivered = [];
		let failuresLeft = 2;
		const poller = createLogPoller({
			provider: node.provider, filter: curioTransferFilter, logger,
			onLog: async (log) => {
				if (failuresLeft-- > 0) throw new Error("receipt lookup failed");
				delivered.push(log.transactionHash);
			}
		});
		await poller.tick();
		node.mine(); node.addLog(101, tx(3));
		await poller.tick(); // fails
		assert.deepEqual(delivered, []);
		node.failNext = 1;
		node.mine(); await poller.tick(); // RPC down: no retry attempt
		assert.equal(failuresLeft, 1);
		node.mine(); await poller.tick(); // fails again
		node.mine(); await poller.tick(); // succeeds
		for (let i = 0; i < 8; i++) { node.mine(); await poller.tick(); }
		assert.deepEqual(delivered, [tx(3)]);
		assert.equal(poller.retryTxCount, 0);
		assert.equal(logger.lines.filter(([, l]) => l.includes("failed to process tx")).length, 1);
	});

	it("gives up on a transaction that keeps failing, with bounded retries", async function () {
		const node = fakeNode();
		const logger = capture();
		let calls = 0;
		const poller = createLogPoller({
			provider: node.provider, filter: curioTransferFilter, logger,
			onLog: async () => { calls++; throw new Error("always broken"); }
		});
		await poller.tick();
		node.mine(); node.addLog(101, tx(4));
		for (let i = 0; i < MAX_ATTEMPTS + 10; i++) { await poller.tick(); node.mine(); }
		assert.equal(calls, MAX_ATTEMPTS);
		assert.equal(poller.retryTxCount, 0);
		assert.equal(logger.lines.length, 2, "first failure and give-up only");
		assert.match(logger.lines[1][1], /^SALE DROPPED after 20 attempts: /);
	});

	it("logs one greppable SALE DROPPED line per dropped tx, at error level and without URLs", async function () {
		assert.equal(MAX_ATTEMPTS, 20);
		const node = fakeNode();
		const logger = capture();
		const poller = createLogPoller({
			provider: node.provider, filter: curioTransferFilter, logger,
			onLog: async () => {
				const e = Ethers.makeError("server response 503", "SERVER_ERROR", { info: { requestUrl: FAKE_URL } });
				e.message = `${e.message} ${FAKE_URL}`;
				throw e;
			}
		});
		await poller.tick();
		node.mine(); node.addLog(101, tx(10)); node.addLog(101, tx(11));
		for (let i = 0; i < MAX_ATTEMPTS * 2; i++) { await poller.tick(); node.mine(); }
		const dropped = logger.lines.filter(([, l]) => l.includes("SALE DROPPED"));
		assert.equal(dropped.length, 2);
		for (const hash of [tx(10), tx(11)]) {
			const lines = dropped.filter(([, l]) => l.startsWith(`SALE DROPPED after 20 attempts: ${hash}: `));
			assert.equal(lines.length, 1, `exactly one line for ${hash}`);
			assert.equal(lines[0][0], "error");
			assert.ok(!/SECRET-KEY|:\/\//.test(lines[0][1]), lines[0][1]);
		}
	});

	// Review round 2: retries used to wait for a new block, so a stationary head stalled them
	it("retries a failed transaction even when the head does not advance", async function () {
		const node = fakeNode();
		const delivered = [];
		let failuresLeft = 1;
		const poller = createLogPoller({
			provider: node.provider, filter: curioTransferFilter, logger: capture(),
			onLog: async (log) => {
				if (failuresLeft-- > 0) throw new Error("price lookup failed");
				delivered.push(log.transactionHash);
			}
		});
		await poller.tick(); // 100
		node.mine(); node.addLog(101, tx(12));
		await poller.tick(); // fails
		assert.deepEqual(delivered, []);
		await poller.tick(); // head still 101
		assert.deepEqual(delivered, [tx(12)]);
		assert.equal(poller.retryTxCount, 0);
		await poller.tick();
		assert.deepEqual(delivered, [tx(12)], "delivered once");
	});

	it("awaits the sale handler, never retries a post, and logs its errors without URLs", async function () {
		const node = fakeNode();
		const logger = capture();
		const posted = [];
		const unhandled = [];
		const onUnhandled = (e) => unhandled.push(e);
		process.on("unhandledRejection", onUnhandled);
		try {
			const poller = watchForTransfers(async (t) => {
				posted.push(t.hash);
				throw Ethers.makeError("server response 500", "SERVER_ERROR", { info: { requestUrl: FAKE_URL } });
			}, {
				provider: node.provider, logger, intervalMs: 5,
				handleTransfer: async (log) => ({ data: { 1: 1 }, hash: log.transactionHash })
			});
			await new Promise(r => setTimeout(r, 30));
			node.mine(); node.addLog(node.head, tx(6));
			await new Promise(r => setTimeout(r, 100));
			poller.stop();
			await new Promise(r => setTimeout(r, 20));
		} finally {
			process.off("unhandledRejection", onUnhandled);
		}
		assert.deepEqual(posted, [tx(6)], "posted once, not retried");
		assert.equal(unhandled.length, 0);
		const errs = logger.lines.filter(([, l]) => l.includes("sale handler failed"));
		assert.equal(errs.length, 1);
		assert.ok(!logger.lines.some(([, l]) => l.includes("SECRET-KEY")));
	});

	// Review finding 4: onLog errors were logged raw, including ethers' requestUrl
	it("never logs the RPC URL from a failed transaction lookup", async function () {
		const node = fakeNode();
		const logger = capture();
		const poller = createLogPoller({
			provider: node.provider, filter: curioTransferFilter, logger,
			onLog: async () => {
				const e = Ethers.makeError("server response 503", "SERVER_ERROR", { info: { requestUrl: FAKE_URL } });
				e.message = `${e.message} ${FAKE_URL}`; // even if it ends up in the message itself
				throw e;
			}
		});
		await poller.tick();
		node.mine(); node.addLog(101, tx(5));
		await poller.tick();
		assert.equal(logger.lines.length, 1);
		assert.ok(!logger.lines[0][1].includes("SECRET-KEY"), logger.lines[0][1]);
	});

	it("never logs the OpenSea API key when a username lookup fails", async function () {
		const err = new Error("Request failed with status code 401");
		err.config = { url: "https://api.opensea.io/api/v2/accounts/0x0", headers: { "X-API-KEY": "OPENSEA-SECRET" } };
		const printed = [];
		const origError = console.error;
		console.error = (...a) => printed.push(a.map(x => require("util").inspect(x)).join(" "));
		try {
			const name = await getUsername(async () => { throw err; }, "0xbebf173c83ad4c877c04592de0c38567abf66526");
			assert.equal(name, "0xbeb...526");
		} finally {
			console.error = origError;
		}
		assert.equal(printed.length, 1);
		assert.ok(!printed[0].includes("OPENSEA-SECRET"), printed[0]);
	});

	it("never logs the RPC URL", async function () {
		const node = fakeNode();
		const logger = capture();
		const { poller } = newWatcher(node, logger);
		await poller.tick();
		// transport-level failure: ethers puts the request URL into the error
		node.provider._send = async () => {
			throw Ethers.makeError("server response 503", "SERVER_ERROR", { info: { requestUrl: FAKE_URL } });
		};
		await poller.tick();
		assert.equal(logger.lines.length, 1);
		assert.ok(!logger.lines[0][1].includes("SECRET-KEY"), logger.lines[0][1]);
	});

	it("stops polling when stopped", async function () {
		const node = fakeNode();
		const { poller } = newWatcher(node, capture(), { intervalMs: 5 });
		poller.start();
		await new Promise(r => setTimeout(r, 50));
		poller.stop();
		await new Promise(r => setTimeout(r, 20));
		const n = node.calls.length;
		assert.ok(n > 2);
		await new Promise(r => setTimeout(r, 50));
		assert.equal(node.calls.length, n);
	});
});
