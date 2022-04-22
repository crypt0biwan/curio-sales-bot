const { WebhookClient } = require('discord.js')
const { watchForTransfers } = require('./utils/watcher')
const { formatMessage } = require('./utils/discord')

require('dotenv').config()
const { DISCORD_ID, DISCORD_TOKEN } = process.env
const webhookClient = new WebhookClient({id: DISCORD_ID, token: DISCORD_TOKEN});

const postToWebhook = async ({ data, totalPrice, buyer, seller, ethPrice, token, platforms }) => {
	let msg = await formatMessage({ data, totalPrice, buyer, seller, ethPrice, token, platforms })
	
	webhookClient
		.send(msg)
		.catch(console.error);
};

watchForTransfers(postToWebhook);