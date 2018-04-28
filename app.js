const bodyparser = require("body-parser");
const express    = require("express");
const rabbitmq   = require('amqplib');
const fs         = require("fs");
const app        = express();

app.use(bodyparser.json());

var webhooks = {};
var config = {};

if(fs.existsSync("./config.json"))
{
    config = JSON.parse(fs.readFileSync("./config.json"));
}

var amqpConn = rabbitmq.connect(config.rabbitUrl, {
    defaultExchangeName: config.rabbitExchange
});

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
              }).then(function(ch) 
              {
                return ch.assertQueue("webhooks").then(function(ok) 
                {
                    let payload = {
                        auth_code: hook.authCode,
                        data: req.body
                    };

                  return ch.sendToQueue("webhooks", Buffer.from(JSON.stringify(payload)));
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