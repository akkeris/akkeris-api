'use strict';

process.env.BASIC_ACCESS = 'CN=dev,OU=Security,OU=OCT-Groups,DC=example,DC=com;CN=SG-LinuxAdmins,OU=Admin,OU=OCT-Groups,DC=example,DC=com;CN=SG-SysOps,OU=Admin,OU=OCT-Groups,DC=example,DC=com;CN=QA Tester,OU=Security,OU=OCT-Groups,DC=example,DC=com';
process.env.ELEVATED_ACCESS = 'CN=SG-LinuxAdmins,OU=Admin,OU=OCT-Groups,DC=example,DC=com;CN=SG-SysOps,OU=Admin,OU=OCT-Groups,DC=example,DC=com;CN=QA Tester,OU=Security,OU=OCT-Groups,DC=example,DC=com';

var perms = require('../lib/permissions.js');
const expect = require("chai").expect;

describe("permissions", function() {
    this.timeout(10 * 60 * 1000);
     
    it('ensure permissions actually work', (done) => {
        expect(perms.isAllowed(["CN=dev,OU=Security,OU=OCT-Groups,DC=example,DC=com"])).to.be.true;
        expect(perms.isAllowed(["CN=dev2,OU=Security,OU=OCT-Groups,DC=example,DC=com"])).to.be.false;
        expect(perms.isAllowed(["CN=dev,OU=Security,OU=OCT-Groups,DC=example,DC=com","CN=dev2,OU=Security,OU=OCT-Groups,DC=example,DC=com"])).to.be.true;
        expect(perms.isAllowed([" CN=dev,OU=Security,OU=OCT-Groups,DC=example,DC=com ","CN=dev2,OU=Security,OU=OCT-Groups,DC=example,DC=com"])).to.be.true;

        process.env.BASIC_ACCESS = 'CN=dev2,OU=Security,OU=OCT-Groups,DC=example,DC=com;CN=SG-LinuxAdmins2,OU=Admin,OU=OCT-Groups,DC=example,DC=com;CN=SG-SysOps2,OU=Admin,OU=OCT-Groups,DC=example,DC=com;CN=QA Tester2,OU=Security,OU=OCT-Groups,DC=example,DC=com'

        expect(perms.isAllowed(["CN=dev,OU=Security,OU=OCT-Groups,DC=example,DC=com"])).to.be.false;
        done()

    });
});