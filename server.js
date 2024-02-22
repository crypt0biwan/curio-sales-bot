const { WebhookClient } = require('discord.js');
const { TwitterApi } = require('twitter-api-v2');
const { watchForTransfers } = require('./utils/watcher');
const { formatDiscordMessage, formatTwitterMessage } = require('./utils/format');
const { openSeaClient } = require('./utils/opensea')

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
	// post to discord
	const discordMsg = await formatDiscordMessage(openSeaClient, { data, totalPrice, buyer, seller, ethPrice, token, platforms });
	webhookClient.send(discordMsg).catch(console.error);

	// tweet
	const [twitterMessage, mediaIds] = await formatTwitterMessage(twitterClient, { data, totalPrice, buyer, seller, ethPrice, token, platforms });
	twitterClient.v2.tweet(twitterMessage, { media: { media_ids: mediaIds } }).catch(console.error);
};

console.log("Starting bot");
watchForTransfers(transferHandler);
