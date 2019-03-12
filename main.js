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
  let token = req.get('Authorization');
  if(!token) {
    return res.sendStatus(401)
  }

  if (token.toLowerCase().startsWith('basic')) {
    try {
      let encoded = Buffer.from(token.substring(6).trim(), 'base64').toString('utf8')
      token = 'Bearer ' + encoded.split(':')[1].trim()
    } catch (e) {
      return res.sendStatus(401)
    }
  } else if(!token.toLowerCase().startsWith('bearer')) {
    return res.sendStatus(401)
  }


  oauth.getUser(token, (err, user) => {
    if (err || !user){
      if(err) {
        console.error(err)
      }
      res.sendStatus(401);
    } else {
      if (user.memberOf && !perms.isAllowed(user.memberOf) && user.sAMAccountName !== process.env.TEST_ACCOUNT) {
        return res.sendStatus(403);
      }
      if (user.organizations_url) {
        oauth.getOrganization(token, process.env.OAUTH_USER_URL + '/orgs', (err, orgs) => {
          if (err || !orgs) {
            res.sendStatus(401);
          } else {
            user.orgs = orgs;
            if (!perms.isAllowed(user.orgs.map((x) => x.login)) && user.id !== process.env.TEST_ACCOUNT) {
              return res.sendStatus(403);
            }
            req.user = user;
            console.log(req.user.name,'(' + req.user.mail + ')', 'requested', req.method, (req.url || req.path));
            next();
          }
        })
      } else {
        req.user = user;
        console.log(req.user.name,'(' + req.user.mail + ')', 'requested', req.method, (req.url || req.path));
        next();
      }
    }
  });
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
  let email = req.user.mail || req.user.email || `${req.user.login}@unknown`
  let id = req.user.employeeID || req.user.id || req.user.login.toString();
  if (typeof id === "number") {
    id = id.toString()
  }
  let updated = req.user.whenChanged || req.user.updated_at
  try {
    updated = fromMSExchangeSortOfISO(updated).toISOString()
  } catch (e) {
    updated = new Date(updated).toISOString()
  }
  let created = req.user.whenCreated || req.user.created_at
  try {
    created = fromMSExchangeSortOfISO(created).toISOString()
  } catch (e) {
    created = new Date(created).toISOString()
  }
  res.type('json').send({
    "allow_tracking": true,
    "beta": false,
    "created_at": created,
    "email": email,
    "photo": req.user.picture || req.user.avatar_url,
    "id": uuid.unparse(crypto.createHash('sha256').update(id).digest(), 16),
    "last_login": updated,
    "name": req.user.name || req.user.login || req.user.id,
    "sms_number": req.user.mobile || "",
    "elevated_access": perms.isElevated(req.user.memberOf || [req.user.login || req.user.id]),
    "suspended_at": null,
    "delinquent_at": null,
    "two_factor_authentication": req.user.two_factor_authentication || false,
    "updated_at": updated,
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
