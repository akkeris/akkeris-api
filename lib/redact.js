module.exports = {};

var blacklistEnv = process.env.BLACKLIST_ENV || 'PASS,KEY,SECRET,PRIVATE,TOKEN';
var blacklistPassInUrl = true;
var blacklistPassInUrlRegex = /([A-z]+\:\/\/[A-z0-9\-\_\.]+\:)[A-z0-9\-\_\.]+(\@[A-z0-9\-\_\.\:\/]+)/;

module.exports.redactSecrets = function(data) {
  if (!blacklistEnv || blacklistEnv === '') {
    return data;
  }

  try {
    var blacklist = blacklistEnv.split(',');

    var str;
    if (typeof data == 'object')
      str = JSON.stringify(data);
    else if (typeof data == 'string')
      str = data;
    else
      str = data.toString('utf8');

    var envs = JSON.parse(str);

    Object.keys(envs).forEach(env => {
      blacklist.forEach(blEnv => {
        if (blEnv && blEnv !== '' && env && env !== '' && env.toLowerCase().trim().indexOf(blEnv.toLowerCase().trim()) > -1) {
          envs[env] = '[redacted]';
        }

        if (blacklistPassInUrl) {
          envs[env] = envs[env].replace(blacklistPassInUrlRegex, '$1[redacted]$2');
        }
      });
    });

    return new Buffer(JSON.stringify(envs));
  }
  catch (e) {
    console.log('error filtering environments, returning safety response.');
    console.log(e);
    console.log(e ? e.message : '');
    console.log(e ? e.stack : '');
    return new Buffer(0);
  }
};