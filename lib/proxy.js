'use strict';

const https = require('https');
const url = require('url');
const perms = require('./permissions.js');

if (!process.env.CONTROLLER_API_TOKEN) {
    throw "Required in env: CONTROLLER_API_TOKEN";
}

if (!process.env.CONTROLLER_API_URL) {
    throw "Required in env: CONTROLLER_API_URL";
}

function akkeris(path, headers, method, body, user, cb) {
  if(headers) {
    delete headers['host']
    delete headers['authorization']
  }
  headers = Object.assign({Authorization: process.env.CONTROLLER_API_TOKEN}, (headers || {}))
  let options = url.parse(process.env.CONTROLLER_API_URL + path);
  options.method = method;
  options.headers = headers
  if (user && user.name) {
    options.headers['X-Username'] = user.name;
  }

  if (perms.isElevated(user.memberOf)) {
    options.headers['X-Elevated-Access'] = "true"
  } else {
    delete options.headers['X-Elevated-Access'];
  }

  let req = https.request(options, (response) => {
    let data = new Buffer(0);
    response.on('data', (chunk) => {
      data = Buffer.concat([data, chunk]);
    });
    response.on('end', () => {
      cb(null, {code:response.statusCode, headers:response.headers, data})
    })
  })

  req.on('error', (err) => {
    console.log(err)
    cb(err)
  });

  if (body){
    let b = JSON.stringify(body);
    if (b != "{}") {
      req.write(b)
    }
  }

  req.end();
}

module.exports = {
    akkeris
};
