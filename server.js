const express = require("express");
const crypto = require("crypto");
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));
require("dotenv").config();

const app = express();
app.use(express.json());

// === LOAD PRIVATE KEY (DIRECT FROM ENV) ===
const PRIVATE_KEY = process.env.NOVAPAY_PRIVATE_KEY;

if (!PRIVATE_KEY) {
  console.error("❌ ERROR: NOVAPAY_PRIVATE_KEY is missing!");
}

// === RSA SIGN FUNCTION ===
function signBody(bodyObject) {
  const bodyString = JSON.stringify(bodyObject);

  const signer = crypto.createSign("RSA-SHA1");
  signer.update(bodyString, "utf8");

  const signature = signer.sign(
    {
      key: PRIVATE_KEY,
      padding: crypto.constants.RSA_PKCS1_PADDING,
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
      amount: { value: Number(amount), currency: "UAH" },
      client_phone: phone.startsWith("+") ? phone : "+" + phone,
      description,
      callback_url: "https://noir.com.ua/api/novapay/webhook",
      success_url: "https://noir.com.ua/payment-success",
      fail_url: "https://noir.com.ua/payment-fail"
    };

    const { bodyString, signature } = signBody(payload);

    console.log("📤 BODY SENT:", bodyString);
    console.log("📌 SIGNATURE:", signature);

    const response = await fetch("https://api-ecom.novapay.ua/v1/checkout/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-sign": signature
      },
      body: bodyString
    });

    const rawText = await response.text();
    console.log("📩 RAW RESPONSE:", rawText);

    let data = null;
    try {
      data = JSON.parse(rawText);
    } catch {
      return res.json({ error: true, raw: rawText });
    }

    if (!response.ok) {
      return res.json({ error: true, details: data });
    }

    return res.json({
      success: true,
      paymentUrl: data.checkout_url,
      sessionId: data.session_id,
      raw: data,
    });

  } catch (err) {
    console.error("🔥 SERVER ERROR:", err);
    return res.json({ error: true, message: "Internal Server Error" });
  }
});

// === WEBHOOK ===
app.post("/api/novapay/webhook", (req, res) => {
  console.log("📩 WEBHOOK RECEIVED:", req.body);
  res.status(200).send("OK");
});

// === ADMIN PANEL ===
app.use("/admin", express.static(__dirname + "/admin"));

// === START SERVER ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🚀 NovaPay server running on port", PORT);
});
