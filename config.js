var nconf = require('nconf');

var defaults =  {
        workspaceServiceURL:"http://p3.theseed.org/services/Workspace",
	types: "*"
}

module.exports = nconf.argv().env().file("./p3-ws-importer.conf").defaults(defaults);
