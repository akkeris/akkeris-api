
const httph = require('./http_helper.js');

const orgCache = {};
let memoryCache = {};
const oauthUserURL = process.env.OAUTH_USER_URL;

function getOrganization(token, url, callback) {
  if (orgCache[token]) {
    callback(null, orgCache[token]);
    return;
  }
  httph.request('get', url, {
    Authorization: `${token}`, 'user-agent': 'akkeris', Accept: 'application/json',
  }, null, (err, orgs) => {
    if (err || !orgs) {
      callback(err || 'Orgs does not exist.');
      return;
    }
    if (typeof orgs === 'string') {
      orgs = JSON.parse(orgs);
    }
    orgCache[token] = orgs;
    callback(null, orgs);
  });
}

function getUser(token, callback) {
  if (memoryCache[token]) {
    callback(null, memoryCache[token]);
    return;
  }
  httph.request('get', oauthUserURL, {
    Authorization: `${token}`, 'user-agent': 'akkeris', Accept: 'application/json',
  }, null, (err, user) => {
    if (err || !user) {
      callback(err || 'User does not exist.');
      return;
    }
    if (typeof user === 'string') {
      user = JSON.parse(user);
    }
    // supplement required fields
    user.mail = user.mail || user.email || `${user.login}@unknown`;
    user.email = user.mail || user.email || `${user.login}@unknown`;
    user.login = user.login || user.email || user.id;
    user.name = user.name || user.login || user.email || user.id;
    memoryCache[token] = user;
    callback(null, user);
  });
}

function init() {
  setInterval(() => {
    memoryCache = {};
  }, 1000 * 60 * 30);
}

module.exports = { init, getUser, getOrganization };
