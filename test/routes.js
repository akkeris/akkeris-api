/* eslint-disable max-len, func-names, global-require, no-unused-expressions */

describe('router', function () {
  this.timeout(10 * 60 * 1000);
  process.env.PORT = 5000;
  process.env.AUTH_KEY = 'bearer mike';

  const rewire = require('rewire');
  const httph = require('../lib/http_helper.js');
  const { expect } = require('chai');
  const runningApp = rewire('../main.js');

  const myUser = {
    name: 'Mike',
    email: 'mikemail',
    mail: 'mikemail',
    whenCreated: '20151002202538.0Z',
    whenChanged: '20151002202538.0Z',
    employeeID: '12345',
    lastLogon: '20161002202538.0Z',
    mobile: '5555555555',
    memberOf: [],
  };

  before(() => {
    runningApp.__set__({
      oauth: {
        getUser(id, cb) {
          if (!id || id.toLowerCase() !== 'bearer mike') { cb('unauthorized'); } else { cb(null, myUser); }
        },
        setUser(id, user, cb) {
          cb(null, id);
        },
        removeUser() {
        },
      },
    });
  });


  it('allows whitelisted aggregate routes', (done) => {
    httph.request('get', 'http://localhost:5000/apps', { Authorization: process.env.AUTH_KEY }, null, (err, data) => {
      expect(err).to.be.null;
      expect(data).to.be.a('string');
      const res = JSON.parse(data);
      expect(res).to.be.an('array');
      done();
    });
  });

  it('responds to /account', (done) => {
    httph.request('get', 'http://localhost:5000/account', { Authorization: process.env.AUTH_KEY }, null, (err, data) => {
      expect(err).to.be.null;
      expect(data).to.be.a('string');
      const expected = {
        allow_tracking: true,
        beta: false,
        created_at: '2015-10-03T02:25:38.000Z',
        id: 'f511b998-06da-59b3-caf5-a9c173cacfc5',
        last_login: '1601-01-24T08:01:40.220Z',
        name: 'Mike',
        sms_number: '5555555555',
        suspended_at: null,
        delinquent_at: null,
        two_factor_authentication: false,
        updated_at: '2015-10-03T02:25:38.000Z',
        verified: true,
      };

      const obj = JSON.parse(data);
      expect(obj.name).to.equal(expected.name);

      done();
    });
  });

  it('handles errors', (done) => {
    httph.request('get', 'http://localhost:5000/nosuchroute', { Authorization: process.env.AUTH_KEY }, null, (err) => {
      expect(err).to.be.an('object');
      expect(err.code).to.equal(404);

      done();
    });
  });
});
