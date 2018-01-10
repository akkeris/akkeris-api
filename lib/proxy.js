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

function doHttpReq(base, headers, path, method, body, user, cb) {
    let options = url.parse(base + path);
    options.method = method;
    options.headers = headers
    if (user && user.name)
        options.headers['X-Username'] = user.name;

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
            if (response.statusCode > 299)
                cb({code:response.statusCode, message: data.toString()}, data.toString());
            else
                cb(null, data.toString());
        });
      }
    );

    req.on('error', (err) => {
        console.log(err)
        cb(err)
    });

    if (body){
        let b = JSON.stringify(body);
        if (b != "{}")
            req.write(b);
    }

    req.end();
}

let akkeris = doHttpReq.bind(null, process.env.CONTROLLER_API_URL, {
    Authorization: process.env.CONTROLLER_API_TOKEN
});

function unknown(path, method, body, user, cb) {
    akkeris(path, method, body, user, (err, result) => {
        if (err) {
            cb(err, result);    
        }
        else {
            result.platform = 'akkeris';
            cb(null, result);
        }
    })
}

module.exports = {
    akkeris: akkeris,
    unknown: unknown
};
