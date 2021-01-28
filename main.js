const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const uuid = require('node-uuid');
const jose = require('node-jose');
const proxy = require('./lib/proxy.js');
const perms = require('./lib/permissions.js');

let oauth = require('./lib/oauth.js'); // eslint-disable-line

const app = express();

app.disable('etag');
app.disable('x-powered-by');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

async function tokenValidate(req, res, next) {
  let token = req.get('Authorization');
  if (!token) {
    res.sendStatus(401);
    return;
  }

  if (token.toLowerCase().startsWith('basic')) {
    try {
      const encoded = Buffer.from(token.substring(6).trim(), 'base64').toString('utf8');
      token = `Bearer ${encoded.split(':')[1].trim()}`;
    } catch (e) {
      res.sendStatus(401);
      return;
    }
  } else if (!token.toLowerCase().startsWith('bearer')) {
    res.sendStatus(401);
    return;
  }


  // Possible JWT token
  if (token.includes('.') && token.length > 70 && token.toLowerCase().startsWith('bearer')) {
    try {
      // We only need to do a cursory validation, forward to the api controller
      // to determine if the request should actually do something.
      const [header, claims, signature] = token.substring(7).split('.'); // eslint-disable-line
      const claim = JSON.parse(jose.util.base64url.decode(claims).toString('utf8').toString());
      req.user = { name: claim.sub, login: claim.sub };
      if (claim.hook_id) {
        req.user = {
          name: `Service account ${claim.hook_id} (on behalf of ${claim.sub})`,
          login: `Service account ${claim.hook_id}`,
        };
      }
      req.user.proxyAuth = true;
      // pass through bearer account.
      console.log(req.user.name, 'requested', req.method, (req.url || req.path));
      return next();
    } catch (e) {
      console.log('JWT Error:', e);
      // do nothing, it failed.
    }
  }

  oauth.getUser(token, (err, user) => {
    if (err || !user) {
      if (err) {
        console.error(err);
      }
      res.sendStatus(401);
    } else {
      if (user.memberOf && !perms.isAllowed(user.memberOf) && user.sAMAccountName !== process.env.TEST_ACCOUNT) {
        res.sendStatus(403);
        return;
      }
      if (user.organizations_url) {
        oauth.getOrganization(token, `${process.env.OAUTH_USER_URL}/orgs?per_page=1000`, (error, orgs) => {
          if (error || !orgs) {
            res.sendStatus(401);
          } else {
            user.orgs = orgs;
            if (!perms.isAllowed(user.orgs.map((x) => x.login)) && user.id !== process.env.TEST_ACCOUNT) {
              res.sendStatus(403);
              return;
            }
            req.user = user;
            console.log(req.user.name, `(${req.user.mail})`, 'requested', req.method, (req.url || req.path));
            next();
          }
        });
      } else {
        req.user = user;
        console.log(req.user.name, `(${req.user.mail})`, 'requested', req.method, (req.url || req.path));
        next();
      }
    }
  });
}

function proxyToAkkeris(req, res) {
  proxy.akkeris(req.url, req.headers, req.method, req.body, req.user, (err, proxiedResponse) => {
    if (err && err instanceof Error) {
      res.status(503).send('Internal Server Error');
    } else {
      delete proxiedResponse.headers['content-length'];
      delete proxiedResponse.headers['transfer-encoding'];
      res.status(proxiedResponse.code)
        .set(proxiedResponse.headers)
        .send(proxiedResponse.data)
        .end();
    }
  });
}

app.get('/octhc', (req, res) => {
  res.send('overall_status=good');
});

// function fromMSLDAPSortOfUnixEpoch(time) {
//   // example: 131201779260607434 (amount of "100 nano seconds intervals" since Jan 1 1601 UTC..)
//   time = parseInt(time, 10);
//   // first step, get rid of "100 nano second intervals" (and two more values ot get to milliseconds).
//   time /= 1e+4;
//   // second subtract out the amount of milliseconds from Jan 1 1601 UTC to Jan 1 1970 UTC. So, 369 years..
//   time -= 11644473600000;
//   const d = new Date();
//   d.setTime(Math.round(time));
//   return d;
// }

function fromMSExchangeSortOfISO(time) {
  // example: 20161002202538.0Z
  //          YYYYMMDDHHMMSS.m
  return new Date(
    parseInt(time.substring(0, 4), 10),
    parseInt(time.substring(4, 6), 10) - 1, // month in javascript is 0 based..
    parseInt(time.substring(6, 8), 10),
    parseInt(time.substring(8, 10), 10),
    parseInt(time.substring(10, 12), 10),
    parseInt(time.substring(12, 14), 10),
  );
}

app.get('/account', tokenValidate, (req, res) => {
  const email = req.user.mail || req.user.email || `${req.user.login}@unknown`;
  let id = req.user.employeeID || req.user.id || req.user.login.toString();
  if (typeof id === 'number') {
    id = id.toString();
  }
  let updated = req.user.whenChanged || req.user.updated_at;
  try {
    updated = fromMSExchangeSortOfISO(updated).toISOString();
  } catch (e) {
    updated = new Date(updated).toISOString();
  }
  let created = req.user.whenCreated || req.user.created_at;
  try {
    created = fromMSExchangeSortOfISO(created).toISOString();
  } catch (e) {
    created = new Date(created).toISOString();
  }
  res.type('json').send({
    allow_tracking: true,
    beta: false,
    created_at: created,
    email,
    photo: req.user.picture || req.user.avatar_url,
    id: uuid.unparse(crypto.createHash('sha256').update(id).digest(), 16),
    last_login: updated,
    name: req.user.name || req.user.login || req.user.id,
    sms_number: req.user.mobile || '',
    elevated_access: perms.isElevated(req.user.memberOf || [req.user.login || req.user.id]),
    suspended_at: null,
    delinquent_at: null,
    two_factor_authentication: req.user.two_factor_authentication || false,
    updated_at: updated,
    verified: true,
  });
});

app.all('*', tokenValidate, proxyToAkkeris);

process.on('uncaughtException', (err) => {
  console.error(`${(new Date()).toUTCString()} uncaughtException:`, err.message);
  console.error(err.stack);
});

oauth.init();

const server = app.listen(process.env.PORT || 5000);
server.keepAliveTimeout = 1000 * (60 * 6); // 6 minutes

console.log(`Listening on ${process.env.PORT || 5000}`);
