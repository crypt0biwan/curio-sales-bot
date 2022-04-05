const COLORS = require('./colors')
const IMAGES = require('./cards')

const formatMessage = ({ qty, card, totalPrice }) => {
	const cardSold = `CRO${card}`
	const imgHash = IMAGES[cardSold]

	return {
		username: 'CurioCard Sales',
		embeds: [
			{
				author: {
					name: 'Curio Cards',
					// url: 'https://curio.cards',
					icon_url: 'https://www.gitbook.com/cdn-cgi/image/width=40,height=40,fit=contain,dpr=1,format=auto/https%3A%2F%2F1770801706-files.gitbook.io%2F~%2Ffiles%2Fv0%2Fb%2Fgitbook-x-prod.appspot.com%2Fo%2Fcollections%252FNyUEXr2B4FBefalwZTqb%252Ficon%252FAbV65JUMTbXuuBMe9I0M%252Favatar2.png%3Falt%3Dmedia%26token%3D99ceb163-5bff-440c-a5b4-83ac5ffc4d1a'
				},
				title: `${cardSold} has been sold`,
				description: `Buyer: **0x0000**
				Seller: **0x0000**
				---------------------------------`,
				url: `https://opensea.io/assets/0x73da73ef3a6982109c4d5bdb0db9dd3e3783f313/${card}`,
				thumbnail: {
					url: `https://ipfs.io/ipfs/${imgHash}`
				},
				color: COLORS.GREEN,
				fields: [
					{
						name: 'Quantity',
						value: qty.toString(),
						inline: true,
					},
					{
						name: 'ETH',
						value: totalPrice.toFixed(2),
						inline: true,
					},
					{
						name: 'USD',
						value: 'xxx',
						inline: true,
					}
				],
				footer: {
					text: `Nice Purchase • ${new Date().toLocaleDateString('en-US', {year: 'numeric', month: '2-digit', day: '2-digit'})}`
				}
			}
		]
	}
}

module.exports = exports = {
	formatMessage,
}
