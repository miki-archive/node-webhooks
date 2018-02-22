const bodyparser = require("body-parser");
const express = require("express");
const redis   = require("redis");
const fs      = require("fs");
const app     = express();

app.use(bodyparser.json());

var webhooks = {};

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
    webhooks[webhook.url] = webhook;

    app.post(webhook.url, (req, res) => {
        console.log(req.originalUrl);
        let id = req.originalUrl.split('?')[0];
        
        console.log(id);
        let hook = webhooks[id];

        console.log(hook);

        console.log("webhook received from " + hook.authCode + ", data: " + JSON.stringify(req.body));

        if(req.query.key == hook.code)
        {
            redisClient.publish("webhook", JSON.stringify({
                auth_code: hook.authCode,
                data: JSON.stringify(req.body),
            }));

            res.send("ok.");
            return;
        }
        res.send("unauthorized.");
    });
}

console.log(webhooks);

app.listen(config.port, () => {
    console.log("listening on " + config.port);
});