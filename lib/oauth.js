"use strict"

const httph = require('./http_helper.js');

let memory_cache = {};
let oauth_user_url = process.env.OAUTH_USER_URL;

function getUser(token, callback) {
  if(memory_cache[token]) {
    return callback(null, memory_cache[token]);
  }
  httph.request('get', oauth_user_url, {'Authorization':token, 'Accept':'application/json'}, null, (err, user) => {
    if(err || !user) {
      return callback(err || 'User does not exist.');
    }
    memory_cache[token] = user;
    callback(null, user);
  });
}

function init() {
  setInterval(() => {
    memory_cache = {};
  }, 1000 * 60 * 30);
}

module.exports = {init, getUser};