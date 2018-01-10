## Akkeris API

This API is responsible for proxying back to the controller API and managing any user-based functions such as /account end points in addition to authorization, identification and auditing. 

## Settings

The oauth user url is the URL end point that will return user information and subsequently validate tokens passed into it.  This end point must return a 'groups'

```
OAUTH_USER_URL = 'https://auth.example.com/user'
```

These two settings are the host for the akkeris controller api and its shared secret authorization token.

```
CONTROLLER_API_TOKEN = 'mysecret'
CONTROLLER_API_URL = 'https://api.apps.example.com'
```

The following are semi-column seperated lists of LDAP groups who should have access to akkeris, these must be groups returned by the oauth user url. 
```
BASIC_ACCESS='CN=GroupName,OU=Groups,DC=example,DC=com;CN=OtherGroup,OU=Groups,DC=example,DC=com'
ELEVATED_ACCESS= 'CN=AdminGroupName,OU=Groups,DC=example,DC=com;CN=OtherAdminsGroup,OU=Groups,DC=example,DC=com'
```

The following stores a cache and information:
```
REDIS_URL=...
```