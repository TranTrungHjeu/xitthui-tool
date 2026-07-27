const { GmailProvider } = require("./gmailProvider");

// Factory: read EMAIL_PROVIDER from env and return the matching provider.
// Today only "gmail" is implemented. Adding SendGrid / SES / generic SMTP
// later is a matter of dropping a new provider file and adding a case here.
function createProvider() {
  const name = (process.env.EMAIL_PROVIDER || "gmail").toLowerCase();
  switch (name) {
    case "gmail":
      return new GmailProvider();
    default:
      throw new Error(`Unknown EMAIL_PROVIDER: ${name}`);
  }
}

module.exports = { createProvider };
