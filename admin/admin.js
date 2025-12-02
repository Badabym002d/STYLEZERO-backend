async function createPayment() {
  const orderId = document.getElementById("orderId").value;
  const amount = Number(document.getElementById("amount").value);
  const description = document.getElementById("description").value;
  const phone = document.getElementById("phone").value;

  const res = await fetch("/api/novapay/create-payment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      orderId,
      amount,
      description,
      phone
    })
  });

  const data = await res.json();

  if (data.success) {
    document.getElementById("result").innerHTML = `
      <p><b>Лінк на оплату:</b></p>
      <a href="${data.paymentUrl}" target="_blank">${data.paymentUrl}</a>
    `;
  } else {
    document.getElementById("result").innerHTML =
      "<p style='color:red;'>Помилка створення оплати</p>";
    console.log("Помилка:", data);
  }
}
