// Keep the Express application and accept the supervised preview's port flag.
const args = process.argv.slice(2);
const portIndex = args.indexOf("--port");
if (portIndex >= 0) process.env.PORT = args[portIndex + 1];
process.env.NODE_ENV = "development";
require("../server.js");
