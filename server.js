// deps
require("dotenv").config();
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const venom = require('venom-bot');
const MONGO = process.env.MONGO_URL;

// middleware and app
const app = express();
app.use(bodyParser.json());

// database
mongoose.connect(MONGO);

// plan schema
const planSchema = new mongoose.Schema({
    text: String
});
const Plan = mongoose.model('Plan', planSchema);

// venom bot init
venom
    .create(
        'plankooo',
        (base64Qr, asciiQR, attempts, urlCode) => {
            console.log(asciiQR);
        },
        (statusSession, session) => {
            console.log('Status Session: ', statusSession);
            console.log('Session: ', session);
        },
        {
            folderNameToken: 'tokens',
            mkdirFolderToken: '',
        }
    )
    .then((client) => start(client))
    .catch((error) => console.error(error));

// main beep-boop function
function start(client) {
    client.onMessage(async (message) => {
        const msg = message.body.trim().toLowerCase();

        if (msg.startsWith('set plan:')) {
            const planText = msg.slice(9).trim();
            if (planText === "") {
                client.sendText(message.from, "Plan string cannot be empty!");
            } else {
                const plan = new Plan({ text: planText });
                await plan.save();
                client.sendText(message.from, `Plan added: ${planText}`);
            }
        } else if (msg === 'plans') {
            const plans = await Plan.find({});
            if (plans.length > 0) {
                const planList = plans.map((p, i) => `${i + 1}. ${p.text}`).join('\n');
                client.sendText(message.from, `Here are the current plans:\n${planList}`);
            } else {
                client.sendText(message.from, 'There are no current plans.');
            }
        } else if (msg.startsWith('remove plan:')) {
            const planNumbers = msg.slice(12).trim().split(',').map(num => parseInt(num.trim(), 10) - 1);
            const plans = await Plan.find({});
            const removedPlans = [];
            for (const index of planNumbers) {
                if (index >= 0 && index < plans.length) {
                    await Plan.findByIdAndDelete(plans[index]._id);
                    removedPlans.push(plans[index].text);
                } else {
                    client.sendText(message.from, `Invalid plan number: ${index + 1}`);
                }
            }
            if (removedPlans.length > 0) {
                client.sendText(message.from, `Plans removed: ${removedPlans.join(', ')}`);
            }
        }
    });
}

app.listen(3000, () => {
    console.log("Server running on port 3000");
});
