const COLORS = require('./colors')
const IMAGES = require('./cards')
const { getUsername } = require('./opensea')

const formatETHaddress = async address => address.slice(0, 5) + '...' + address.slice(address.length-3, address.length)

const formatMessage = async ({ qty, card, totalPrice, buyer, seller, ethPrice, token }) => {
	const cardSold = `CRO${card}`
	const imgHash = IMAGES[cardSold]
	const buyerUsername = await getUsername(buyer)
	const sellerUsername = await getUsername(seller)
	let fields = [
		{
			name: 'Quantity',
			value: qty.toString(),
			inline: true,
		},
		{
			name: token,
			value: parseFloat(totalPrice).toFixed(2),
			inline: true,
		}
	]

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
					// url: 'https://curio.cards',
					icon_url: 'https://www.gitbook.com/cdn-cgi/image/width=40,height=40,fit=contain,dpr=1,format=auto/https%3A%2F%2F1770801706-files.gitbook.io%2F~%2Ffiles%2Fv0%2Fb%2Fgitbook-x-prod.appspot.com%2Fo%2Fcollections%252FNyUEXr2B4FBefalwZTqb%252Ficon%252FAbV65JUMTbXuuBMe9I0M%252Favatar2.png%3Falt%3Dmedia%26token%3D99ceb163-5bff-440c-a5b4-83ac5ffc4d1a'
				},
				title: `Curio ${card} has been sold`,
				description: `Buyer: **${buyerUsername}**\nSeller: **${sellerUsername}**\n---------------------------------`,
				url: `https://opensea.io/assets/0x73da73ef3a6982109c4d5bdb0db9dd3e3783f313/${card}`,
				thumbnail: {
					url: `https://ipfs.io/ipfs/${imgHash}`
				},
				color: COLORS.GREEN,
				fields,
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
