const fs = require('fs')
const { Client, Collection, Intents, WebhookClient } = require('discord.js')
const ethers = require('ethers')
const abi = require('./abis/WyvernExchangeWithBulkCancellations.json')
const { watchForTransfers } = require('./utils/watcher.js')

require('dotenv').config()

const { DISCORD_ID, DISCORD_TOKEN, INFURA_PROJECT_ID, INFURA_SECRET } = process.env

/*
const { OPENSEA_CONTRACT, DISCORD_TOKEN, DISCORD_PREFIX, DISCORD_CHANNEL, CURIO_WRAPPER_CONTRACT, ETH_NODE_URL } = process.env

const bot = new Client({
	intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES],
})
bot.commands = new Collection()

fs.readdir('./commands/', (err, files) => {
	if (err) console.log(err)

	let jsfile = files.filter((f) => f.split('.').pop() === 'js')
	if (jsfile.length <= 0) {
		console.log("Couldn't find commands.")
		return
	}

	jsfile.forEach((f, i) => {
		let props = require(`./commands/${f}`)
		console.log(`${f} loaded!`)
		bot.commands.set(props.help.name, props)
	})
})

// Playing Message
bot.on('ready', async () => {
	console.log(`${bot.user.username} is online on ${bot.guilds.cache.size} servers!`)

	bot.user.setActivity('Curio sales', { type: 'WATCHING' })

	listen()
})

// Command Manager
bot.on('message', async (message) => {
	// console.log(message)
	if (message.author.bot) return
	if (message.channel.type === 'dm') return

	let prefix = DISCORD_PREFIX
	let messageArray = message.content.split(' ')
	let cmd = messageArray[0]
	let args = messageArray.slice(1)

	//Check for prefix
	if (!cmd.startsWith(DISCORD_PREFIX)) return

	let commandfile = bot.commands.get(cmd.slice(prefix.length))
	if (commandfile) commandfile.run(bot, message, args)
})

// Token in.env
bot.login(DISCORD_TOKEN)



const convertTokenId = (id) => Web3.utils.fromWei(id.toString(), 'wei')
const convertPrice = (price) => Web3.utils.fromWei(price.toString(), 'ether')
const getChannel = (bot) => bot.channels.cache.find(channel => channel.name === DISCORD_CHANNEL)

const provider = new ethers.providers.WebSocketProvider(ETH_NODE_URL)

provider.on("block", (blockNumber) => {
	console.log(`new block: ${blockNumber}`)
});

const contract = new ethers.Contract(OPENSEA_CONTRACT, abi, provider)
const EVENTS = {
	ORDERS_MATCHED: 'OrdersMatched'
}


const listen = () => {
    console.log('Listening to events')

    const channel = getChannel(bot)

    try {
        contract
            .on(EVENTS.ORDERS_MATCHED, (buyHash, sellHash, maker, taker, price, metadata) => {
                // TODO filter curio contract somehow (CURIO_WRAPPER_CONTRACT variable)
                // TODO get card id
                // TODO single vs multiple
                // TODO regular sell (ETH) vs accepted offer (WETH)
                // TODO other currencies? USDC
                // TODO sweeper stuff? genie / gem

                let ethPrice = convertPrice(price)

                console.log(`${ethPrice} ETH, maker ${maker}, taker ${taker}`)

                // channel.send(`Sale for ${ethPrice} ETH`)
            })
    } catch(e) {
        console.error(e)
    }
}

*/

const webhookClient = new WebhookClient({id: DISCORD_ID, token: DISCORD_TOKEN});

const postToWebhook = ({qty, card, totalPrice}) => {
	webhookClient.send(`Found curio sale: ${qty}x CRO${card} sold for ${totalPrice}`).catch(console.error);
};

watchForTransfers(postToWebhook);
