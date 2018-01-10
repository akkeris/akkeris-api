'use strict';

let express    = require('express'),
  bodyParser   = require('body-parser'),
  crypto       = require('crypto'),
  oauth        = require('./lib/oauth.js'),
  url          = require('url'),
  uuid         = require('node-uuid'),
  proxy        = require('./lib/proxy.js'),
  perms        = require('./lib/permissions.js'),
  redact       = require('./lib/redact.js').redactSecrets,
  httph        = require('./lib/http_helper.js'),
  app          = express();


// Declares that the specified routes only allow the associated methods.
const methodRestrictions = {
    'organizations': ['get', 'post'],
    'organizations/*': ['get'],
    'spaces': ['get', 'post'],
    'spaces/*': ['get'],
    'addon-services': ['get'],
    'addon-services/*': ['get'],
    'account': ['get']
};
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

function tokenValidate(req, res, next){
    const token = req.get('Authorization');

    let finished = (err, user) => {
        if (err || !user){
            res.sendStatus(401);
        } else {
            if (typeof user == 'string')
                user = JSON.parse(user);

            if (!perms.isAllowed(user.memberOf) && user.sAMAccountName !== process.env.TEST_ACCOUNT) {
                return res.sendStatus(403);
            }

            req.user = user;
            console.log(req.user.name,'(' + req.user.mail + ')', 'requested', req.method, (req.url || req.path));
            next();
        }
    };
    if(!token) {
        return res.sendStatus(401)
    }
    if(token.toLowerCase().startsWith('bearer')) {
        oauth.getUser(token, finished);
    } else {
        return res.sendStatus(401)
    }
    
}

function methodValidate(req, res, next){
    let resource = req.url;
    if (resource.indexOf('/') == 0)
        resource = resource.substr(1);

    resource = resource.replace(/\/.*$/, '/*');

    if (methodRestrictions[resource] && methodRestrictions[resource].indexOf(req.method.toLowerCase()) < 0){
        res.sendStatus(403);
    }
    else {
        next();
    }
}

function validResponseHandler(res) {
    return (err, result) => {
        if (err){
            if (typeof(err) === 'number') {
                res.status(err);
                res.send(result);
            }
            else if (typeof err == 'string') {
                res.status(500);
                res.send(err + "\n" + result);
            }
            else {
                let code = err.code || err.status;
                res.status(code || 500);
                res.send(err.message ? err.message : result);
            }
        }
        else {
            res.send(result);
        }
    }
}

function proxyToAkkeris(req, res){
    proxy.akkeris(req.url, req.method, req.body, req.user, validResponseHandler(res));
}

app.get('/octhc', (req, res) => {
    res.send("overall_status=good");
});

function fromMSLDAPSortOfUnixEpoch(time) {
    // example: 131201779260607434 (amount of "100 nano seconds intervals" since Jan 1 1601 UTC..)
    time = parseInt(time, 10);
    // first step, get rid of "100 nano second intervals" (and two more values ot get to milliseconds).
    time = time / 1e+4;
    // second subtract out the amount of milliseconds from Jan 1 1601 UTC to Jan 1 1970 UTC. So, 369 years..
    time = time - 11644473600000;
    let d = new Date();
    d.setTime(Math.round(time));
    return d;
}

function fromMSExchangeSortOfISO(time) {
    // example: 20161002202538.0Z
    //          YYYYMMDDHHMMSS.m
    return new Date(
        parseInt(time.substring(0,4), 10), 
        parseInt(time.substring(4,6), 10) - 1, // month in javascript is 0 based..
        parseInt(time.substring(6,8), 10), 
        parseInt(time.substring(8,10), 10), 
        parseInt(time.substring(10,12), 10), 
        parseInt(time.substring(12,14), 10)); 
}

app.get('/account', tokenValidate, (req, res) => {
    res.send(JSON.stringify({
      "allow_tracking": true,
      "beta": false,
      "created_at": fromMSExchangeSortOfISO(req.user.whenCreated).toISOString(),
      "email": req.user.mail,
      "id": uuid.unparse(crypto.createHash('sha256').update(req.user.employeeID).digest(), 16),
      "last_login": fromMSLDAPSortOfUnixEpoch(req.user.lastLogon).toISOString(),
      "name": req.user.name,
      "sms_number": req.user.mobile,
      "suspended_at": null,
      "delinquent_at": null,
      "two_factor_authentication": false,
      "updated_at": fromMSExchangeSortOfISO(req.user.whenChanged).toISOString(),
      "verified": true
    }));
});

/*
 * Routes that go to all backends:
 */
app.get('/apps', tokenValidate, methodValidate, proxyToAkkeris);
app.get('/spaces', tokenValidate, methodValidate, proxyToAkkeris);
app.get('/addon-services', tokenValidate, methodValidate, proxyToAkkeris);

/*
 * Routes that need secrets redacted:
 */
app.get('/apps/:app/config-vars', tokenValidate, methodValidate, proxyToAkkeris);

/*
 * Catch-all routes. These must be at the bottom. DO NOT REORDER!
 */
app.get('*', tokenValidate, methodValidate, proxyToAkkeris);
app.put('*', tokenValidate, methodValidate, proxyToAkkeris);
app.patch('*', tokenValidate, methodValidate, proxyToAkkeris);
app.post('*', tokenValidate, methodValidate, proxyToAkkeris);
app.delete('*', tokenValidate, methodValidate, proxyToAkkeris);

process.on('uncaughtException', function (err) {
    console.error((new Date).toUTCString() + ' uncaughtException:', err.message);
    console.error(err.stack);
});

oauth.init();

app.listen(process.env.PORT || 5000);
