"use strict";

var https = require('https');
var http = require('http');
var url = require('url');

function clean_forward_slash(uri) {
    if (uri[uri.length - 1] === '/') {
        uri = uri.substring(0, uri.length - 1);
    }
    if (!uri.startsWith("http")) {
        uri = "https://" + uri;
    }
    return uri;
}

function first_match(uri, regex) {
    var matches = (new RegExp(regex)).exec(uri);
    if (matches && matches[1]) {
        return matches[1];
    }
    return null;
}

function common_headers() {
    return {
        'Content-Type': 'application/json',
        'RateLimit-Remaining': 2400
    };
}

function valid_response(code, res, message) {
    res.writeHead(code, common_headers());
    res.write(typeof(message) === 'string' ? message : JSON.stringify(message));
    res.end();
}
var ok_response = valid_response.bind(valid_response, 200);
var created_response = valid_response.bind(valid_response, 201);
var accepted_response = valid_response.bind(valid_response, 205);
var reset_response = valid_response.bind(valid_response, 205);

function err_request(code, res, message, log_err) {
    res.writeHead(code, common_headers());
    if (typeof(message) === 'string') {
        res.write(JSON.stringify({
            code: code,
            message: Buffer.isBuffer(message) ? message.toString('utf8') : message.toString()
        }));
    } else {
        res.write(JSON.stringify(message));
    }
    res.end();
    if (log_err) {
        console.error.apply(console.error, log_err);
    }
}
var bad_request = err_request.bind(err_request, 400);
var no_access_request = err_request.bind(err_request, 403);
var not_found_request = err_request.bind(err_request, 404);

function buffer(stream, callback) {
    var buffered = new Buffer(0);
    stream.on('data', (chunk) => {
        buffered = Buffer.concat([buffered, chunk]);
    });
    stream.on('end', () => {
        callback(buffered);
    });
}

function buffer_json(stream, res, callback) {
    buffer(stream, (data) => {
        let payload = null;
        try {
            payload = JSON.parse(data.toString('utf8'));
        } catch (e) {
            return bad_request(res, 'Malformed JSON request.');
        }
        callback(payload);
    });
}

function request(type, uri, headers, data, callback) {
    try {
        var options = url.parse(uri);
        options.method = type;
        options.headers = headers || {};
        var client = uri.startsWith("http://") ? http : https;
        var callback_made = false;
        var req = client.request(options, (res) => {
            buffer(res, (res_data) => {
                if (callback_made) {
                    return; // silently swallow this, as we've already sent a callback.
                }
                callback_made = true;
                if ((res.statusCode < 200 || res.statusCode > 299) && res.statusCode !== 302) {
                    callback({
                        code: res.statusCode,
                        message: Buffer.isBuffer(res_data) ? res_data.toString('utf8') : res_data
                    }, null);
                } else {
                    if (headers['X-Binary']) {
                        callback(null, res_data, res);
                    } else {
                        callback(null, res_data.toString('utf8'), res);
                    }
                }
            });
        });
        if (headers && headers['X-Timeout']) {
            req.setTimeout(headers['X-Timeout'], () => {
                if (callback_made) {
                    return; // silently swallow this, as we've already sent a callback.
                }
                callback_made = true;
                callback({code: 0, message: "timeout occured."});
            });
        } else {
            req.setTimeout(60 * 1000, () => {
                if (callback_made) {
                    return; // silently swallow this, as we've already sent a callback.
                }
                callback_made = true;
                console.error("Timeout after one minute trying to retrieve", type, uri);
                callback({code: 0, message: "timeout occured."});
            });
        }
        if (data) {
            req.write(typeof(data) === 'string' ? data : JSON.stringify(data));
        }
        req.on('error', (e) => {
            if (callback_made) {
                return; // silently swallow this, we've already disconnected from the client.
            }
            callback_made = true;
            callback({code: 500, message: Buffer.isBuffer(e) ? e.toString('utf8') : e.toString()}, null);
        });
        req.end();
    } catch (e) {
        callback({code: 500, message: Buffer.isBuffer(e) ? e.toString('utf8') : e.toString()}, null);
    }
}

function get_contents(uri, callback) {
    if (uri.startsWith("data:")) {
        try {
            callback(null, new Buffer(uri.split(",")[1], 'base64'));
        } catch (e) {
            console.error("Cannot parse invalid data uri: ", e);
            callback({code: 400, message: "An invalid data uri was passed."});
        }
    } else {
        request('GET', uri, {'User-Agent': 'akkeris-controller', 'X-Binary': 'true'}, null, (err, data) => {
            if (err) {
                return callback(err, null);
            }
            callback(null, data);
        });
    }
}


module.exports = {
    get_contents: get_contents,
    request: request,
    bad_request: bad_request,
    no_access_request: no_access_request,
    err_request: err_request,
    not_found_request: not_found_request,
    buffer: buffer,
    buffer_json: buffer_json,
    first_match: first_match,
    ok_response: ok_response,
    created_response: created_response,
    accepted_response: accepted_response,
    reset_response: reset_response,
    clean_forward_slash: clean_forward_slash
};