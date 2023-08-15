const axios = require('axios')

const formatETHaddress = address => address.slice(0, 5) + '...' + address.slice(address.length - 3, address.length)

openSeaClient = async (address) => axios({
    method: 'get',
    url: `https://api.opensea.io/api/v1/user/${address}`,
    headers: {
        'X-API-KEY': process.env.OPENSEA_API_KEY
    }
})


const getUsername = async (os, address) => {
    return new Promise((resolve, reject) => {
        os(address)
            .then(function (response) {
                if (response.data.username != null) {
                    resolve(response.data.account.user.username)
                } else {
                    resolve(formatETHaddress(address))
                }
            })
            .catch(function (error) {
                console.error(error);
                resolve(formatETHaddress(address))
            })
    })
}

module.exports = exports = {
    getUsername,
    openSeaClient
}
