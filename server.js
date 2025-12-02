const express = require("express");
const fs = require("fs");
const crypto = require("crypto");
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));
require("dotenv").config();

const app = express();
app.use(express.json());

// === LOAD PRIVATE KEY ===
const PRIVATE_KEY = fs.readFileSync(process.env.NOVAPAY_PRIVATE_KEY_PATH, "utf8");

// === RSA SIGN FUNCTION ===
function signBody(bodyObject) {
  const bodyString = JSON.stringify(bodyObject);

  const signer = crypto.createSign("RSA-SHA1");
  signer.update(bodyString, "utf8");

  const signature = signer.sign(
    {
      key: PRIVATE_KEY,
      padding: crypto.constants.RSA_PKCS1_PADDING
    },
    "base64"
  );

  return { bodyString, signature };
}

// === CREATE CHECKOUT SESSION ===
app.post("/api/novapay/create-payment", async (req, res) => {
  try {
    const { orderId, amount, description, phone } = req.body;

    const payload = {
      merchant_id: process.env.NOVAPAY_MERCHANT_ID,
      order_id: orderId,
      amount: {
        value: Number(amount),
        currency: "UAH",
      },
      client_phone: phone.startsWith("+") ? phone : "+" + phone,
      description: description,
      callback_url: "https://noir.com.ua/api/novapay/webhook",
      success_url: "https://noir.com.ua/payment-success",
      fail_url: "https://noir.com.ua/payment-fail"
    };

    const { bodyString, signature } = signBody(payload);

    console.log("📤 BODY SENT:", bodyString);
    console.log("📌 SIGNATURE:", signature);

    const url = "https://api-ecom.novapay.ua/v1/checkout/session";

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-sign": signature,
      },
      body: bodyString
    });

    const status = response.status;
    const headers = Object.fromEntries(response.headers.entries());
    const rawText = await response.text();

    console.log("📡 RESPONSE STATUS:", status);
    console.log("📡 RESPONSE HEADERS:", headers);
    console.log("📩 RAW RESPONSE:", rawText);

    let data = null;
    try {
      data = JSON.parse(rawText);
    } catch {
      return res.json({
        error: true,
        message: "NovaPay returned non-JSON response",
        raw: rawText
      });
    }

    if (!response.ok) {
      console.log("❌ NovaPay ERROR:", data);
      return res.json({ error: true, details: data });
    }

    console.log("✅ SUCCESS:", data);

    return res.json({
      success: true,
      paymentUrl: data.checkout_url,
      sessionId: data.session_id,
      raw: data
    });

  } catch (err) {
    console.error("🔥 SERVER ERROR:", err);
    res.json({ error: true, message: "Internal Server Error" });
  }
});

// === WEBHOOK (POSTBACK) ===
app.post("/api/novapay/webhook", (req, res) => {
  console.log("📩 WEBHOOK RECEIVED:", req.body);
  res.status(200).send("OK");
});

// === ADMIN PANEL ===
app.use("/admin", express.static(__dirname + "/admin"));

// === START SERVER ===
app.listen(process.env.PORT, () => {
  console.log("🚀 NovaPay server running on port", process.env.PORT);
});
