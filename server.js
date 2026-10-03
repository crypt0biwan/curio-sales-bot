const { WebhookClient } = require('discord.js');
const { TwitterApi } = require('twitter-api-v2');
const { watchForTransfers } = require('./utils/watcher');
const { formatDiscordMessage, formatTwitterMessage } = require('./utils/format');
const { openSeaClient } = require('./utils/opensea')
const { describeError } = require('./utils/errors');

require('dotenv').config();
const {
	DISCORD_ID, DISCORD_TOKEN,
	TWITTER_API_KEY, TWITTER_API_KEY_SECRET, TWITTER_ACCESS_TOKEN_KEY, TWITTER_ACCESS_TOKEN_SECRET
} = process.env;

const webhookClient = new WebhookClient({ id: DISCORD_ID, token: DISCORD_TOKEN });
const _twitterClient = new TwitterApi({
	appKey: TWITTER_API_KEY,
	appSecret: TWITTER_API_KEY_SECRET,
	accessToken: TWITTER_ACCESS_TOKEN_KEY,
	accessSecret: TWITTER_ACCESS_TOKEN_SECRET
});
const twitterClient = _twitterClient.readWrite;

const transferHandler = async ({ data, totalPrice, buyer, seller, ethPrice, token, platforms }) => {
	const saleLabel = `${Object.entries(data).map(([card, qty]) => `${qty}x CRO${card}`).join(", ")} for ${totalPrice} ${token}`;

	// Each channel is handled on its own, so a failure in one never blocks or reposts the other,
	// and this never throws. Errors go through describeError: raw Discord/Twitter errors
	// contain the webhook URL (with its token) and OAuth request headers.

	// post to discord
	try {
		const discordMsg = await formatDiscordMessage(openSeaClient, { data, totalPrice, buyer, seller, ethPrice, token, platforms });
		await webhookClient.send(discordMsg);
		console.log(`Discord post sent: ${saleLabel}`);
	} catch (e) {
		console.error(`Discord post failed: ${saleLabel}: ${describeError(e)}`);
	}

	// tweet
	try {
		const [twitterMessage, mediaIds] = await formatTwitterMessage(twitterClient, { data, totalPrice, buyer, seller, ethPrice, token, platforms });
		const r = await twitterClient.v2.tweet(twitterMessage, { media: { media_ids: mediaIds } });
		console.log(`Tweet sent (id ${r && r.data && r.data.id}): ${saleLabel}`);
	} catch (e) {
		console.error(`Tweet failed: ${saleLabel}: ${describeError(e)}`);
	}
};

console.log("Starting bot");
watchForTransfers(transferHandler);
