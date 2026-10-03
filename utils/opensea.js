const axios = require('axios')
const { describeError } = require('./errors')

const formatETHaddress = address => address.slice(0, 5) + '...' + address.slice(address.length - 3, address.length)

openSeaClient = async (address) => axios({
    method: 'get',
    url: `https://api.opensea.io/api/v2/accounts/${address}`,
    headers: {
        'X-API-KEY': process.env.OPENSEA_API_KEY
    }
})


const getUsername = async (os, address) => {
    return new Promise((resolve, reject) => {
        os(address)
            .then(function (response) {
                if (response.data.username) {
                    resolve(response.data.username)
                } else {
                    resolve(formatETHaddress(address))
                }
            })
            .catch(function (error) {
                // not the raw error: it includes the request headers with the OpenSea API key
                console.error(`OpenSea username lookup failed for ${address}: ${describeError(error)}`);
                resolve(formatETHaddress(address))
            })
    })
}

module.exports = exports = {
    getUsername,
    openSeaClient
}
