// Error objects from ethers, axios, discord.js and twitter-api-v2 can carry request
// URLs and headers with credentials (Alchemy key in the RPC URL, OpenSea X-API-KEY,
// Discord webhook token), so never log them raw. This keeps only the messages and
// replaces anything that looks like a URL.
function describeError(e) {
	let msg = String((e && (e.shortMessage || e.message)) || e);
	if (e && e.error && e.error.message) msg += `: ${e.error.message}`; // e.g. JSON-RPC "filter not found"
	return msg.replace(/(?:[a-z][a-z0-9+.-]*:\/\/|\b[\w-]+(?:\.[\w-]+)+\/)\S*/gi, "<url>").slice(0, 300);
}

module.exports = { describeError };
