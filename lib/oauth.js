"use strict"

const httph = require('./http_helper.js');

let org_cache = {};
let memory_cache = {};
let oauth_user_url = process.env.OAUTH_USER_URL;

function getOrganization(token, url, callback) {
  if(org_cache[token]) {
    return callback(null, org_cache[token]);
  }
  httph.request('get', url, {'Authorization':`${token}`, 'user-agent':'akkeris', 'Accept':'application/json'}, null, (err, orgs) => {
    if(err || !orgs) {
      return callback(err || 'Orgs does not exist.');
    }
    if (typeof orgs === 'string') {
      orgs = JSON.parse(orgs)
    }
    org_cache[token] = orgs;
    callback(null, orgs);
  });
}

function getUser(token, callback) {
  if(memory_cache[token]) {
    return callback(null, memory_cache[token]);
  }
  httph.request('get', oauth_user_url, {'Authorization':`${token}`, 'user-agent':'akkeris', 'Accept':'application/json'}, null, (err, user) => {
    if(err || !user) {
      return callback(err || 'User does not exist.');
    }
    if (typeof user === 'string') {
      user = JSON.parse(user)
    }
    // suppletment required fields
    req.user.mail = req.user.mail || req.user.email || `${req.user.login}@unknown`;
    req.user.email = req.user.mail || req.user.email || `${req.user.login}@unknown`;
    req.user.login = req.user.login || req.user.email || req.user.id;
    memory_cache[token] = user;
    callback(null, user);
  });
}

function init() {
  setInterval(() => {
    memory_cache = {};
  }, 1000 * 60 * 30);
}

module.exports = {init, getUser, getOrganization};