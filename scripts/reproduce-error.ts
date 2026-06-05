async function reproduce() {
  const payload = {
    messages: [
      {
        id: "msg-1",
        role: "user",
        content: "Tell me about intentsync"
      }
    ]
  };

  console.log("Sending reproduce payload to http://localhost:3003/api/chat...");
  const res = await fetch("http://localhost:3003/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  console.log("Status:", res.status);
  console.log("Body:", await res.text());
}

reproduce();
