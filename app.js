const bodyparser = require("body-parser");
const express = require("express");
const rabbitmq = require('amqplib');
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

var amqpConn = rabbitmq.connect(config.rabbitUrl);

for(i = 0; i < config.webhooks.length; i++)
{
    var webhook = config.webhooks[i];
    webhooks[webhook.url] = webhook;

    app.post(webhook.url, (req, res) => {
        let id = req.originalUrl.split('?')[0];
        let hook = webhooks[id];

        if(req.query.key == hook.code)
        {
            amqpConn.then(function(conn) {
                return conn.createChannel();
              }).then(function(ch) {
                return ch.assertQueue("webhooks").then(function(ok) {
                  console.log(req.body);
                  return ch.sendToQueue("webhooks", Buffer.from(JSON.stringify(req.body)));
                });
              }).catch(console.warn);

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