const bodyparser = require("body-parser");
const express    = require("express");
const rabbitmq   = require('amqplib');
const fs         = require("fs");
const app        = express();

var conn = null;

app.use(bodyparser.json());

var webhooks = {};
var config = {};

if(fs.existsSync("./config.json"))
{
    config = JSON.parse(fs.readFileSync("./config.json"));
}

async function main()
{   
    conn = getConnection();

    init();
}

async function initConnection()
{
    try
    {
        let newConn = await rabbitmq.connect(config.rabbitUrl, {
            defaultExchangeName: config.rabbitExchange
        });

        newConn.on('error', async (err) => {
            console.log("[CRIT] CN " + err);
            conn = getConnection();
        });

        return newConn;
    }
    catch(err)
    {
        console.log("[WARN] >> " + err.code);
        return null;
    }
}

async function getConnection()
{
    while(true)
    {
        conn = await initConnection();

        if(conn == null)
        {
            console.log("[WARN] >> connection failed, retrying..")
            setTimeout(() => {}, 1000);
            continue;
        }

        break;
    }
    console.log("[ OK ] >> (re)connected")
    return conn;
}

async function init()
{
    for(i = 0; i < config.webhooks.length; i++)
    {
        var webhook = config.webhooks[i];
        webhooks[webhook.url] = webhook;

        app.post(webhook.url, async (req, res) => {
            let id = req.originalUrl.split('?')[0];
            let hook = webhooks[id];

            if(req.query.key == hook.code)
            {
                var channel = await conn.createChannel();

                channel.on('error', function(err) {
                    console.log("[CRIT] CH " + err);
                });

                var assert = await channel.assertQueue("webhooks");

                let payload = {
                    auth_code: hook.authCode,
                    data: JSON.stringify(req.body)
                };
                
                console.log(`[SENT] => ${payload.auth_code}`)
                await channel.sendToQueue("webhooks", Buffer.from(JSON.stringify(payload)));

                res.send("ok.");
                return;
            }
            res.send("unauthorized.");
        });
    }

    console.log(webhooks);
}

main();

app.listen(config.port, () => {
    console.log("listening on " + config.port);
});