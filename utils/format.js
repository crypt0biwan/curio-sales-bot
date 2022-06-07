const COLORS = require('./colors')
const { getUsername } = require('./opensea')

const formatDiscordMessage = async ({ data, totalPrice, buyer, seller, ethPrice, token, platforms }) => {
	const buyerUsername = await getUsername(buyer)
	const sellerUsername = (seller === "Multiple") ? "Multiple" : await getUsername(seller)
	
	let quantities = []
	for (const [card, qty] of Object.entries(data)) {
		quantities.push(`${qty}x CRO${card}`)
	}
	const cards = Object.keys(data)
	const card = cards[0]

	const url = 
		platforms[0] === 'LooksRare'
		? `https://looksrare.org/collections/0x73DA73EF3a6982109c4d5BDb0dB9dd3E3783f313/${card}`
		: `https://opensea.io/assets/0x73da73ef3a6982109c4d5bdb0db9dd3e3783f313/${card}`
	let fields = [
		{
			name: 'Quantity',
			value: quantities.join(", "),
			inline: true,
		},
		{
			name: token,
			value: parseFloat(totalPrice).toFixed(2),
			inline: true,
		}
	]
	const title = (cards.length > 1) ? `Curios ${cards.join(", ")} have been sold` : `Curio ${card} has been sold` // If different cards sold, make title reflect that

	if(['ETH', 'WETH'].includes(token)) {
		fields.push({
			name: 'USD',
			value: parseFloat(totalPrice * ethPrice).toFixed(2),
			inline: true,
		})
	}
	return {
		username: 'CurioCard Sales',
		embeds: [
			{
				author: {
					name: 'Curio Cards',
					icon_url: 'https://www.gitbook.com/cdn-cgi/image/width=40,height=40,fit=contain,dpr=1,format=auto/https%3A%2F%2F1770801706-files.gitbook.io%2F~%2Ffiles%2Fv0%2Fb%2Fgitbook-x-prod.appspot.com%2Fo%2Fcollections%252FNyUEXr2B4FBefalwZTqb%252Ficon%252FAbV65JUMTbXuuBMe9I0M%252Favatar2.png%3Falt%3Dmedia%26token%3D99ceb163-5bff-440c-a5b4-83ac5ffc4d1a'
				},
				title: title,
				description: `${platforms.length > 1 ? "Platforms" : "Platform"}: **${platforms.join(", ")}**\nBuyer: **${buyerUsername}**\nSeller: **${sellerUsername}**\n---------------------------------`,
				url,
				thumbnail: {
					url: `https://fafrd.github.io/curio-gallery/images/${card < 10 ? `0${card}` : card}.jpg` //`https://ipfs.io/ipfs/${imgHash}`
				},
				color: COLORS.GREEN,
				fields,
				timestamp: new Date()
			}
		]
	}
}

async function uploadMedia(twitterClient, _card) {
	const card = parseInt(_card);

	if (card <= 9) {
		 mediaId = await twitterClient.v1.uploadMedia(`./images/0${card}.jpg`);
	} else if (card == 21 || card == 22) {
		 mediaId = await twitterClient.v1.uploadMedia(`./images/${card}.png`);
	} else if (card == 23 || card == 30) {
		 mediaId = await twitterClient.v1.uploadMedia(`./images/${card}.gif`);
	} else {
		 mediaId = await twitterClient.v1.uploadMedia(`./images/${card}.jpg`);
	}

	return mediaId;
}

const formatTwitterMessage = async ({ data, totalPrice, buyer, seller, ethPrice, token, platforms }) => {
	const buyerUsername = await getUsername(buyer);
	const sellerUsername = (seller === "Multiple") ? "Multiple" : await getUsername(seller);

	let quantities = [];
	for (const [card, qty] of Object.entries(data)) {
		quantities.push(`${qty}x CRO${card}`);
	}
	const cards = Object.keys(data);
	const card = cards[0];

/*
Curio Card 5 was sold for 0.65 ETH ($1232.63) on OpenSea!

https://opensea.io/assets/0x73da73ef3a6982109c4d5bdb0db9dd3e3783f313/5

[picture]

Multiple curio cards were sold at once:
1x Curio 27
1x Curio 28
1x Curio 29

Sale price: 3.5 ETH ($5275.07)

[pictures]
*/

	let twitterMessage;
	if (cards.length == 1) {
		let qtyString = "";
		if (quantities[1] > 1) {
			qtyString = `${quantities[1]}x `;
		}

		let totalPriceUsdString = "";
		if(['ETH', 'WETH'].includes(token)) {
			totalPriceUsdString = `($${(totalPrice * ethPrice).toFixed(2)}) `;
		}

		let platformString = "";
		if (platforms.length > 1) {
			platformString = `on ${platforms[0]}!`;
		} else if (platforms.length > 0) {
			platformString = `on ${platforms.join(", ")}!`;
		}

		twitterMessage = `
${qtyString}Curio Card ${cards[0]} was sold for ${totalPrice} ${token} ${totalPriceUsdString}${platformString}

https://opensea.io/assets/0x73da73ef3a6982109c4d5bdb0db9dd3e3783f313/${cards[0]}

[picture]

`;
	} else {
		console.warn("todo");
		twitterMessage = "todo";
	}

	const mediaIds = uploadMedia();

	return [twitterMessage, []];
}

module.exports = exports = {
	formatDiscordMessage,
	formatTwitterMessage,
}
