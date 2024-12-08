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
const twitterClient = _twitterClient.readWrite;

//const [twitterMessage, mediaIds] = await formatTwitterMessage(twitterClient, { data, totalPrice, buyer, seller, ethPrice, token, platforms });
//twitterClient.v1.tweet(twitterMessage, { media_ids: mediaIds }).catch(console.error);
//twitterClient.v2.tweet("test").catch(console.error);

twitterClient.v1.uploadMedia(`images/01.jpg`).then((mediaId) => {
    console.log(mediaId)
    twitterClient.v2.tweet("test", { media: { media_ids: [mediaId] }}).catch(console.error);
}).catch(console.error);