const { formatDiscordMessage, formatTwitterMessage } = require('../utils/format');
const { TwitterApi } = require('twitter-api-v2');

require('dotenv').config();
const {
	TWITTER_API_KEY, TWITTER_API_KEY_SECRET, TWITTER_ACCESS_TOKEN_KEY, TWITTER_ACCESS_TOKEN_SECRET
} = process.env;

const _twitterClient = new TwitterApi({
	appKey: TWITTER_API_KEY,
	appSecret: TWITTER_API_KEY_SECRET,
	accessToken: TWITTER_ACCESS_TOKEN_KEY,
	accessSecret: TWITTER_ACCESS_TOKEN_SECRET
});
const twitterClient = _twitterClient.readWrite; // client needed to test image upload

const assert = require("assert");

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
			const [twitterMessage, mediaIds] = await formatTwitterMessage(twitterClient, singleSale);

			console.log(twitterMessage);
			const expectedMessage = `Curio Card 10 was sold for 0.3 ETH ($610.88) on OpenSea!

https://opensea.io/assets/0x73da73ef3a6982109c4d5bdb0db9dd3e3783f313/10`;
			assert.equal(expectedMessage, twitterMessage);

			console.log(mediaIds);
			assert.equal(mediaIds.length, 1);
			assert.notEqual(mediaIds[0], null);
			assert.notEqual(mediaIds[0], "");
		});
	});
});