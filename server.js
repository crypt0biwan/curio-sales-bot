const { WebhookClient } = require('discord.js');
const { TwitterApi } = require('twitter-api-v2');
const { watchForTransfers } = require('./utils/watcher');
const { formatDiscordMessage, formatTwitterMessage } = require('./utils/format');

require('dotenv').config();
const {
	DISCORD_ID, DISCORD_TOKEN,
	TWITTER_API_KEY, TWITTER_API_KEY_SECRET, TWITTER_ACCESS_TOKEN_KEY, TWITTER_ACCESS_TOKEN_SECRET
} = process.env;

const webhookClient = new WebhookClient({id: DISCORD_ID, token: DISCORD_TOKEN});
const twitterClient = new TwitterApi({
	appKey: TWITTER_API_KEY,
	appSecret: TWITTER_API_KEY_SECRET,
	accessToken: TWITTER_ACCESS_TOKEN_KEY,
	accessSecret: TWITTER_ACCESS_TOKEN_SECRET
});
const rwTwitterClient = twitterClient.readWrite;

const transferHandler = async ({ data, totalPrice, buyer, seller, ethPrice, token, platforms }) => {
	// post to discord
	//const discordMsg = await formatDiscordMessage({ data, totalPrice, buyer, seller, ethPrice, token, platforms });
	//webhookClient.send(discordMsg).catch(console.error);

	// tweet
	const [twitterMessage, mediaIds] = await formatTwitterMessage({ data, totalPrice, buyer, seller, ethPrice, token, platforms });
	console.log(twitterMessage);
	//rwTwitterClient.v1.tweet(twitterMessage, { media_ids: mediaIds }).catch(console.error);


	//card = 4
	//const mediaId = await uploadMedia(card);
	//await rwTwitterClient.v1.tweet(`Curio Card ${data[]} sold for `, { media_ids: mediaId });

	/*
		heres the plan
		create formatTwitterMessage
	*/

};

//watchForTransfers(transferHandler);

transferHandler({});