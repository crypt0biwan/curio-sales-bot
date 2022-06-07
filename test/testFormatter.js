const { formatDiscordMessage, formatTwitterMessage } = require('../utils/format');


const singleSale = {
	data: { '10': 1 },
	totalPrice: 0.3,
	buyer: '0x2757476cd6a9efeb748e2f0c747d7b3c7002219b',
	seller: '0xf481db34ed8844ce98ce339c5fd01ef8d4261955',
	ethPrice: 2036.2552894003065,
	token: 'ETH',
	platforms: [ 'OpenSea' ]
};


describe("Formatter", function () {
	this.timeout(10_000);

	describe("formatDiscordMessage()", function () {
		it("should format single sales correctly", async function () {
			const discordMsg = await formatDiscordMessage(singleSale);
			console.log(JSON.stringify(discordMsg, null, 4));
		});
	});

	describe("formatTwitterMessage()", function () {
		it("should format single sales correctly", async function () {
			const [twitterMessage, mediaIds] = await formatTwitterMessage(singleSale);
			console.log(twitterMessage);
			console.log(mediaIds);
		});
	});
});