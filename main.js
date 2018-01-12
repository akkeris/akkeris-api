'use strict';

let express    = require('express'),
  bodyParser   = require('body-parser'),
  crypto       = require('crypto'),
  oauth        = require('./lib/oauth.js'),
  url          = require('url'),
  uuid         = require('node-uuid'),
  proxy        = require('./lib/proxy.js'),
  perms        = require('./lib/permissions.js'),
  httph        = require('./lib/http_helper.js'),
  app          = express();

app.disable('etag')
app.disable('x-powered-by');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

function tokenValidate(req, res, next){
  const token = req.get('Authorization');
  if(!token) {
    return res.sendStatus(401)
  }
  if(token.toLowerCase().startsWith('bearer')) {
    oauth.getUser(token, (err, user) => {
      if (err || !user){
        res.sendStatus(401);
      } else {
        if (typeof user === 'string') {
          user = JSON.parse(user)
        }
        if (!perms.isAllowed(user.memberOf) && user.sAMAccountName !== process.env.TEST_ACCOUNT) {
          return res.sendStatus(403);
        }
        req.user = user;
        console.log(req.user.name,'(' + req.user.mail + ')', 'requested', req.method, (req.url || req.path));
        next();
      }
    });
  } else {
    return res.sendStatus(401)
  }
}

function proxyToAkkeris(req, res){
  proxy.akkeris(req.url, req.headers, req.method, req.body, req.user, (err, proxied_response) => {
    if (err && err instanceof Error) {
      res.status(503).send("Internal Server Error");
    } else {
      delete proxied_response.headers['content-length']
      delete proxied_response.headers['transfer-encoding']
      res.status(proxied_response.code)
        .set(proxied_response.headers)
        .send(proxied_response.data)
        .end()
    }
  });
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
  res.type('json').send({
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
  });
});

app.all('*', tokenValidate, proxyToAkkeris);

process.on('uncaughtException', function (err) {
  console.error((new Date).toUTCString() + ' uncaughtException:', err.message);
  console.error(err.stack);
});

oauth.init();

app.listen(process.env.PORT || 5000);
console.log("Listening on " + (process.env.PORT || 5000))
