const axios = require('axios')

const formatETHaddress = address => address.slice(0, 5) + '...' + address.slice(address.length-3, address.length)

const getUsername = async address => {
    return new Promise((resolve, reject) => {
        axios({
            method: 'get',
            url: `https://api.opensea.io/user/${address}`
          })
        .then(function (response) {
            if(response.data.username != null) {
                resolve(response.data.account.user.username)
            } else {
                resolve(formatETHaddress(address))
            }
        })
        .catch(function (error) {
            console.log(error);
            resolve(formatETHaddress(address))
        })
    })
}

module.exports = exports = {
    getUsername
}