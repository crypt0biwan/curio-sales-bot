const COLORS = require('./colors')
const { getUsername } = require('./opensea')

const formatMessage = async ({ data, totalPrice, buyer, seller, ethPrice, token, platforms }) => {
	const buyerUsername = await getUsername(buyer)
	const sellerUsername = (seller === "Multiple") ? "Multiple" : await getUsername(seller)
	
	let quantities = []
	for (const [card, qty] of Object.entries(data)) {
		quantities.push(`${qty}x CRO${card}`)
	}
	const cards = Object.keys(data)
	const card = cards[0]


	const date = new Date()
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
				footer: {
					text: `${date.toLocaleDateString('en-US', {year: 'numeric', month: '2-digit', day: '2-digit'})} ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
				}
			}
		]
	}
}

module.exports = exports = {
	formatMessage,
}
