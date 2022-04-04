# curio-sales-bot

# Setup
Make sure you have the proper Node version installed (see `.nvmrc` file)

Copy `.env.sample` to `.env`.

You'll need to get set up with an Infura account- log in to https://infura.io/ and create a new project. In `.env`, populate the INFURA_PROJECT_ID and INFURA_SECRET.

Next you'll need to set up a Discord webhook. In your server go to Settings -> Integrations and create a webhook. Set the DISCORD_ID to the first value and DISCORD_TOKEN to the second value.

For example... if your webhook URL is `https://discord.com/api/webhooks/1234123412341234/asdfasdfasdfasdfasdfasdfasdf`, set the .env file with
`DISCORD_ID=1234123412341234`, `DISCORD_TOKEN=asdfasdfasdfasdfasdfasdfasdf`

# Running
```
npm start
```

# Testing
Make sure you set the infura values in .env. The tests will contact the ethereum node.
```
npm test
```