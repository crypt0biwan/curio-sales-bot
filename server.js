const { WebhookClient } = require('discord.js')
const ethers = require('ethers')
const abi = require('./abis/WyvernExchangeWithBulkCancellations.json')
const { watchForTransfers } = require('./utils/watcher.js')

require('dotenv').config()
const { DISCORD_ID, DISCORD_TOKEN, INFURA_PROJECT_ID, INFURA_SECRET } = process.env
const webhookClient = new WebhookClient({id: DISCORD_ID, token: DISCORD_TOKEN});

const postToWebhook = ({qty, card, totalPrice}) => {
	webhookClient.send(`Found curio sale: ${qty}x CRO${card} sold for ${totalPrice}`).catch(console.error);
};

watchForTransfers(postToWebhook);
