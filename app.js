const express = require("express");
const redis   = require("redis");
const fs      = require("fs");
const app     = express();

var config = {
    port: 80,
    redisUrl: "redis://localhost:6379",
    webhooks: [
        {
            authCode: "example",
            url:  "/",
            code: "changeme",
        },
    ]
};

if(!fs.existsSync("./config.json"))
{
    fs.writeFileSync("./config.json", JSON.stringify(config));
}
else
{
    config = JSON.parse(fs.readFileSync("./config.json"));
}

var redisClient = redis.createClient(config.redisUrl);

for(i = 0; i < config.webhooks.length; i++)
{
    var webhook = config.webhooks[i];

    console.log(webhook);

    app.post(webhook.url, (req, res) => {
        console.log("webhook received from " + webhook.authcode + ", data: " + req.body);

        if(req.query.key == webhook.code)
        {
            redisClient.publish("webhook", {
                auth_code: webhook.authCode,
                data: JSON.stringify(req.body),
            });

            return "OK";
        }
        return "FAILED";
    });
}

app.listen(config.port, () => {
    console.log("listening on " + config.port);
});