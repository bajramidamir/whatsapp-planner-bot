// deps
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const Jimp = require("jimp");
const fs = require('fs');
const path = require('path');
const mongoose = require("mongoose");
const venom = require("venom-bot");
const MONGO = process.env.MONGO_URL;

// middleware and app
const app = express();
app.use(bodyParser.json());

// database
mongoose.connect(MONGO);

// plan schema
const planSchema = new mongoose.Schema({
  text: String,
});
const Plan = mongoose.model("Plan", planSchema);
let qrCodePath = '';

// venom bot init
venom
  .create(
    "plankooo",
    async (base64Qr, asciiQR, attempts, urlCode) => {
      console.log("Pairing code: ", urlCode);
      const imageBuffer = Buffer.from(
        base64Qr.replace(/^data:image\/png;base64,/, ""),
        "base64"
      );
      const imagePath = path.join(__dirname, "qrcode.png");
      qrCodePath = imagePath;
      const image = await Jimp.read(imageBuffer);
      image.write(imagePath);
    },
    (statusSession, session) => {
      console.log("Status Session: ", statusSession);
      console.log("Session: ", session);
    },
    {
      folderNameToken: "tokens", //folder name when saving tokens
      mkdirFolderToken: "", //folder directory tokens, just inside the venom folder, example:  { mkdirFolderToken: '/node_modules', } //will save the tokens folder in the node_modules directory
      headless: true, // Headless chrome
      devtools: false, // Open devtools by default
      useChrome: true, // If false will use Chromium instance
      debug: false, // Opens a debug session
      logQR: true, // Logs QR automatically in terminal
      browserArgs: ["--no-sandbox", "--disable-setuid-sandbox"], // Parameters to be added into the chrome browser instance
      disableSpins: true, // Will disable Spinnies animation, useful for containers (docker) for a better log
      disableWelcome: true, // Will disable the welcoming message which appears in the beginning
      updates: true, // Logs info updates automatically in terminal
      autoClose: 0, // Automatically closes the venom-bot only when scanning the QR code (default 60 seconds, if you want to turn it off, assign 0 or false)
    }
  )
  .then((client) => start(client))
  .catch((error) => console.error(error));

// main beep-boop function
function start(client) {
  client.onMessage(async (message) => {
    const msg = message.body.trim().toLowerCase();

    if (msg.startsWith("set plan:")) {
      const planText = msg.slice(9).trim();
      if (planText === "") {
        client.sendText(message.from, "Plan string cannot be empty!");
      } else {
        const plan = new Plan({ text: planText });
        await plan.save();
        client.sendText(message.from, `Plan added: ${planText}`);
      }
    } else if (msg === "plans") {
      const plans = await Plan.find({});
      if (plans.length > 0) {
        const planList = plans.map((p, i) => `${i + 1}. ${p.text}`).join("\n");
        client.sendText(
          message.from,
          `Here are the current plans:\n${planList}`
        );
      } else {
        client.sendText(message.from, "There are no current plans.");
      }
    } else if (msg.startsWith("remove plan:")) {
      const planNumbers = msg
        .slice(12)
        .trim()
        .split(",")
        .map((num) => parseInt(num.trim(), 10) - 1);
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
        client.sendText(
          message.from,
          `Plans removed: ${removedPlans.join(", ")}`
        );
      }
    }
  });
}

// endpoint to serve the QR code
app.get("/qrcode", (req, res) => {
  if (qrCodePath && fs.existsSync(qrCodePath)) {
    res.sendFile(qrCodePath);
  } else {
    res.status(404).send("QR code not generated yet.");
  }
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
