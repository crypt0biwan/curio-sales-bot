const { formatDiscordMessage, formatTwitterMessage } = require('../utils/format');

const mockTwitterClient = {
	v1: {
		uploadMedia: async function (cardPath) {
			console.log("mocked uploadMedia(): " + cardPath)
			return "unit-test";
		}
	}
}

const mockOpenSeaClient = (address) => {
	return new Promise((resolve, reject) => {
		if (address == "0x2757476cd6a9efeb748e2f0c747d7b3c7002219b")
			resolve({
				data: {
					"address": "0x2757476cd6a9efeb748e2f0c747d7b3c7002219b",
					"username": "mockUsername",
					"profile_image_url": "",
					"banner_image_url": "",
					"website": "",
					"social_media_accounts": [],
					"bio": "",
					"joined_date": "2019-12-14"
				}
			});
		else if (address == "0xf481db34ed8844ce98ce339c5fd01ef8d4261955")
			resolve({
				data: {
					"address": "0xf481db34ed8844ce98ce339c5fd01ef8d4261955",
					"username": "mockUsername2",
					"profile_image_url": "",
					"banner_image_url": "",
					"website": "",
					"social_media_accounts": [],
					"bio": "",
					"joined_date": "2019-12-14"
				}
			});
		else
			resolve({
				data: {
					username: null,
				}
			});
	});
}

const assert = require("assert");

const singleSale = {
	data: { '10': 1 },
	totalPrice: 0.3,
	buyer: '0x2757476cd6a9efeb748e2f0c747d7b3c7002219b',
	seller: '0xf481db34ed8844ce98ce339c5fd01ef8d4261955',
	ethPrice: 2036.2552894003065,
	token: 'ETH',
	platforms: ['OpenSea']
};

const singleSale17b = {
	data: { '172': 1 },
	totalPrice: 1.4,
	buyer: '0x2757476cd6a9efeb748e2f0c747d7b3c7002219b',
	seller: '0xf481db34ed8844ce98ce339c5fd01ef8d4261955',
	ethPrice: 2036.2552894003065,
	token: 'ETH',
	platforms: ['OpenSea']
};

const singleSaleMultipleQty = {
	data: { '9': 23 },
	totalPrice: 7.5,
	buyer: '0x2757476cd6a9efeb748e2f0c747d7b3c7002219b',
	seller: '0xf481db34ed8844ce98ce339c5fd01ef8d4261955',
	ethPrice: 2036.2552894003065,
	token: 'ETH',
	platforms: ['OpenSea']
};

const multiSale = {
	data: { '9': 2, '10': 1, '11': 3 },
	totalPrice: 1.24,
	buyer: '0x2757476cd6a9efeb748e2f0c747d7b3c7002219b',
	seller: '0xf481db34ed8844ce98ce339c5fd01ef8d4261955',
	ethPrice: 2036.2552894003065,
	token: 'ETH',
	platforms: ['OpenSea']
};

const multiSale17b = {
	data: { '16': 1, '17': 2, '172': 3 },
	totalPrice: 4,
	buyer: '0x2757476cd6a9efeb748e2f0c747d7b3c7002219b',
	seller: '0xf481db34ed8844ce98ce339c5fd01ef8d4261955',
	ethPrice: 2036.2552894003065,
	token: 'ETH',
	platforms: ['OpenSea']
};

const multiSaleWithMoreThan4 = {
	data: { '9': 2, '10': 1, '11': 3, '12': 4, '13': 5, '14': 6 },
	totalPrice: 10,
	buyer: '0x2757476cd6a9efeb748e2f0c747d7b3c7002219b',
	seller: '0xf481db34ed8844ce98ce339c5fd01ef8d4261955',
	ethPrice: 2036.2552894003065,
	token: 'ETH',
	platforms: ['OpenSea']
};

describe("Formatter", function () {
	this.timeout(10_000);

	describe("formatDiscordMessage()", function () {
		it("should format single sales correctly", async function () {
			const discordMsg = await formatDiscordMessage(mockOpenSeaClient, singleSale);

			assert.equal(discordMsg.username, 'CurioCard Sales')
			assert.equal(discordMsg.embeds[0].author.name, 'Curio Cards')
			assert.equal(discordMsg.embeds[0].title, 'Curio 10 has been sold')
			assert.equal(discordMsg.embeds[0].description, 'Platform: **OpenSea**\nBuyer: **mockUsername**\nSeller: **mockUsername2**\n---------------------------------')
			assert.equal(discordMsg.embeds[0].thumbnail.url, 'https://fafrd.github.io/curio-gallery/images/10.jpg')
			assert.equal(discordMsg.embeds[0].color, '0x4bea1d')
			assert.deepEqual(discordMsg.embeds[0].fields[0], {
				"name": "Quantity",
				"value": "1x CRO10",
				"inline": true
			})
			assert.deepEqual(discordMsg.embeds[0].fields[1], {
				"name": "ETH",
				"value": "0.30",
				"inline": true
			})
		});

		it("should format 17b sales correctly", async function () {
			const discordMsg = await formatDiscordMessage(mockOpenSeaClient, singleSale17b);

			assert.equal(discordMsg.username, 'CurioCard Sales')
			assert.equal(discordMsg.embeds[0].author.name, 'Curio Cards')
			assert.equal(discordMsg.embeds[0].title, 'Curio 17b (misprint) has been sold')
			assert.equal(discordMsg.embeds[0].description, 'Platform: **OpenSea**\nBuyer: **mockUsername**\nSeller: **mockUsername2**\n---------------------------------')
			assert.equal(discordMsg.embeds[0].thumbnail.url, 'https://fafrd.github.io/curio-gallery/images/172.png')
			assert.equal(discordMsg.embeds[0].color, '0x4bea1d')
			assert.deepEqual(discordMsg.embeds[0].fields[0], {
				"name": "Quantity",
				"value": "1x CRO17b (misprint)",
				"inline": true
			})
			assert.deepEqual(discordMsg.embeds[0].fields[1], {
				"name": "ETH",
				"value": "1.40",
				"inline": true
			})
		});
	});

	describe("formatTwitterMessage()", function () {
		it("should format single sales correctly", async function () {
			const [twitterMessage, mediaIds] = await formatTwitterMessage(mockTwitterClient, singleSale);
			const expectedMessage = `Curio Card 10 sold for 0.30 ETH ($611) on OpenSea!\n\nhttps://opensea.io/assets/ethereum/0x73DA73EF3a6982109c4d5BDb0dB9dd3E3783f313/10`;

			assert.equal(expectedMessage, twitterMessage);
			assert.equal(mediaIds.length, 1);
			assert.notEqual(mediaIds[0], null);
			assert.notEqual(mediaIds[0], "");
		});

		it("should format single sales (with >1 quantity) correctly", async function () {
			const [twitterMessage, mediaIds] = await formatTwitterMessage(mockTwitterClient, singleSaleMultipleQty);
			const expectedMessage = `23x Curio Card 9 sold for 7.50 ETH ($15,272) on OpenSea!\n\nhttps://opensea.io/assets/ethereum/0x73DA73EF3a6982109c4d5BDb0dB9dd3E3783f313/9`;

			assert.equal(expectedMessage, twitterMessage);
			assert.equal(mediaIds.length, 1);
			assert.notEqual(mediaIds[0], null);
			assert.notEqual(mediaIds[0], "");
		});

		it("should format 17b single sales correctly", async function () {
			const [twitterMessage, mediaIds] = await formatTwitterMessage(mockTwitterClient, singleSale17b);
			const expectedMessage = `Curio Card 17b (misprint) sold for 1.40 ETH ($2,851) on OpenSea!\n\nhttps://opensea.io/assets/ethereum/0x04AfA589E2b933f9463C5639f412b183Ec062505/172`;

			assert.equal(expectedMessage, twitterMessage);
			assert.equal(mediaIds.length, 1);
			assert.notEqual(mediaIds[0], null);
			assert.notEqual(mediaIds[0], "");
		});

		it("should format multi-card sales correctly", async function () {
			const [twitterMessage, mediaIds] = await formatTwitterMessage(mockTwitterClient, multiSale);
			const expectedMessage = `Multiple Curio Cards sold for a total of 1.24 ETH ($2,525)!\n2x Curio 9\n1x Curio 10\n3x Curio 11`;

			assert.equal(expectedMessage, twitterMessage);
			assert.equal(mediaIds.length, 3);
			assert.notEqual(mediaIds[0], null);
			assert.notEqual(mediaIds[0], "");
		});

		it("should format multi-card sales correctly, including 17b", async function () {
			const [twitterMessage, mediaIds] = await formatTwitterMessage(mockTwitterClient, multiSale17b);
			const expectedMessage = `Multiple Curio Cards sold for a total of 4.00 ETH ($8,145)!\n1x Curio 16\n2x Curio 17\n3x Curio 17b (misprint)`;

			assert.equal(expectedMessage, twitterMessage);
			assert.equal(mediaIds.length, 3);
			assert.notEqual(mediaIds[0], null);
			assert.notEqual(mediaIds[0], "");
		});

		it("should format multi-card sales (with >4 different cards) correctly", async function () {
			const [twitterMessage, mediaIds] = await formatTwitterMessage(mockTwitterClient, multiSaleWithMoreThan4);
			const expectedMessage = `Multiple Curio Cards sold for a total of 10.00 ETH ($20,363)!\n2x Curio 9\n1x Curio 10\n3x Curio 11\n4x Curio 12\n5x Curio 13\n6x Curio 14`;

			assert.equal(expectedMessage, twitterMessage);
			assert.equal(mediaIds.length, 4);
			assert.notEqual(mediaIds[0], null);
			assert.notEqual(mediaIds[0], "");
		});
	});
});
