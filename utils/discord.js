const Discord = require('discord.js')
const COLORS = require('./colors')

const formatMessage = ({ title, url, image_url, color = COLORS.LIGHTBLUE, fields }) =>
	new Discord.MessageEmbed()
		.setColor(color)
		.setTitle(title)
		.setURL(url)
		.setImage(image_url)
		.addFields(fields)

module.exports = exports = {
	formatMessage,
}
