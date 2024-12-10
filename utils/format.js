const { getUsername } = require('./opensea')

const getImageURL = _card => {
	const card = parseInt(_card)
	let cardURL = ''

	if (card <= 9) {
		cardURL = `0${card}.jpg`
	} else if (card == 21 || card == 22 || card == 172) {
		cardURL = `${card}.png`
	} else if (card == 23 || card == 30) {
		cardURL = `${card}.gif`
	} else {
		cardURL = `${card}.jpg`
	}

	return cardURL
}

// style = currency to include dollar sign
const formatValue = (value, decimals = 2, style = 'decimal') =>
	new Intl.NumberFormat('en-US', {
		style,
		currency: 'USD',
		minimumFractionDigits: decimals,
		maximumFractionDigits: decimals,
	}).format(value)

const formatDiscordMessage = async (openSeaClient, { data, totalPrice, buyer, seller, ethPrice, token, platforms }) => {
	console.log("Fetching username for buyer and seller");
	const buyerUsername = await getUsername(openSeaClient, buyer)
	const sellerUsername = (seller === "Multiple") ? "Multiple" : await getUsername(openSeaClient, seller)

	console.log("Formatting Discord message");
	let quantities = []
	for (const [card, qty] of Object.entries(data)) {
		if (card == "172") {
			quantities.push(`${qty}x CRO17b (misprint)`);
		} else {
			quantities.push(`${qty}x CRO${card}`);
		}
	}
	const cards = Object.keys(data);
	const card = cards[0];

	const contract = (card == "172") ? "0x04AfA589E2b933f9463C5639f412b183Ec062505" : "0x73DA73EF3a6982109c4d5BDb0dB9dd3E3783f313";
	const url =
		platforms[0] === 'LooksRare'
			? `https://looksrare.org/collections/${contract}/${card}`
			: `https://opensea.io/assets/ethereum/${contract}/${card}`;
	let fields = [
		{
			name: 'Quantity',
			value: quantities.join(", "),
			inline: true,
		},
		{
			name: token,
			value: formatValue(parseFloat(totalPrice), 2),
			inline: true,
		}
	];

	let title = "";
	if (cards.length > 1) {
		if (cards.includes("172")) {
			cards.splice(cards.indexOf("172"), 1, "CRO17b (misprint)");
		}
		title = `Curios ${cards.join(", ")} have been sold`;
	} else {
		if (card == "172") {
			title = "Curio 17b (misprint) has been sold";
		} else {
			title = `Curio ${card} has been sold`;
		}
	}

	if (['ETH', 'WETH'].includes(token)) {
		fields.push({
			name: 'USD',
			value: formatValue(parseFloat(totalPrice * ethPrice), 0),
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
					url: `https://fafrd.github.io/curio-gallery/images/${getImageURL(card)}`
				},
				color: 4975133, // #4bea1d
				fields,
				timestamp: new Date()
			}
		]
	};
}

async function uploadMedia(twitterClient, _card) {
	mediaId = await twitterClient.v1.uploadMedia(`images/${getImageURL(_card)}`);

	return mediaId;
}

const formatTwitterMessage = async (twitterClient, { data, totalPrice, buyer, seller, ethPrice, token, platforms }) => {
	let twitterMessage;
	let mediaIds = [];
	let totalPriceString = formatValue(totalPrice, 2)

	if (Object.keys(data).length == 1) {
		let totalPriceUsdString = "";
		if (['ETH', 'WETH'].includes(token)) {
			totalPriceUsdString = `(${formatValue(totalPrice * ethPrice, 0, 'currency')}) `;
		}

		let platformString = "";
		if (platforms.length > 1) {
			platformString = `on ${platforms[0]}!`;
		} else if (platforms.length > 0) {
			platformString = `on ${platforms.join(", ")}!`;
		}

		const cardNum = Object.keys(data)[0];
		const cardCount = Object.values(data)[0];
		let qtyString = "";
		if (cardCount > 1) {
			qtyString = `${cardCount}x `;
		}
		if (cardNum == "172") {
			twitterMessage = `${qtyString}Curio Card 17b (misprint) sold for ${totalPriceString} ${token} ${totalPriceUsdString}${platformString}\n\nhttps://opensea.io/assets/ethereum/0x04AfA589E2b933f9463C5639f412b183Ec062505/${cardNum}`;
		} else {
			twitterMessage = `${qtyString}Curio Card ${cardNum} sold for ${totalPriceString} ${token} ${totalPriceUsdString}${platformString}\n\nhttps://opensea.io/assets/ethereum/0x73DA73EF3a6982109c4d5BDb0dB9dd3E3783f313/${cardNum}`;
		}

		mediaIds = [await uploadMedia(twitterClient, cardNum)];
	} else {
		let qtyString = Object.entries(data).map(q => {
			if (q[0] == "172") {
				return `${q[1]}x Curio 17b (misprint)`;
			} else {
				return `${q[1]}x Curio ${q[0]}`;
			}
		}).join('\n');

		let totalPriceUsdString = "";
		if (['ETH', 'WETH'].includes(token)) {
			totalPriceUsdString = `(${formatValue(totalPrice * ethPrice, 0, 'currency')})`;
		}

		const cardNums = Object.keys(data).slice(0, 4);

		twitterMessage = `Multiple Curio Cards sold for a total of ${totalPriceString} ${token} ${totalPriceUsdString}!\n${qtyString}`;
		mediaIds = await Promise.all(cardNums.map(card => uploadMedia(twitterClient, card)));
	}

	return [twitterMessage, mediaIds];
}

module.exports = exports = {
	formatDiscordMessage,
	formatTwitterMessage,
}
