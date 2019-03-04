'use strict';

const https = require('https');
const http = require('http');
const url = require('url');
const perms = require('./permissions.js');

console.assert(process.env.CONTROLLER_API_TOKEN, 'Required environment variable CONTROLLER_API_TOKEN was not found')
console.assert(process.env.CONTROLLER_API_URL, 'Required environment variable CONTROLLER_API_URL was not found')

function akkeris(path, headers, method, body, user, cb) {
  if(headers) {
    delete headers['host']
    delete headers['authorization']
    delete headers['content-length']
  }
  headers = Object.assign({Authorization: process.env.CONTROLLER_API_TOKEN}, (headers || {}))
  let options = url.parse(process.env.CONTROLLER_API_URL + path);
  options.method = method;
  options.headers = headers
  if (user && user.name) {
    options.headers['x-username'] = user.name;
  }

  if (user.memberOf && perms.isElevated(user.memberOf)) {
    options.headers['x-elevated-access'] = "true"
  } else if (user.orgs && perms.isElevated([user.login])) {
    options.headers['x-elevated-access'] = "true"
  } else {
    Object.keys(options.headers).forEach((key) => {
      if(key.toLowerCase() === 'x-elevated-access') {
        delete options.headers[key]
      }
    })
  }
  let connector = process.env.CONTROLLER_API_URL.startsWith("http://") ? http : https
  let req = connector.request(options, (response) => {
    let data = new Buffer(0);
    response.on('data', (chunk) =>  data = Buffer.concat([data, chunk]) )
    response.on('end', () => cb(null, {code:response.statusCode, headers:response.headers, data}) )
  })

  req.on('error', (err) => {
    console.log(err)
    cb(err)
  });

  if (body) {
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
