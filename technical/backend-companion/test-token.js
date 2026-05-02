const token = "e66577448108d213351ff5b345d2ba2168c9cbfe3ab982ceb392c3c6544fb180";

async function testEndpoint() {
  const response = await fetch("http://localhost:3000/roster-slots/populate-for-companion", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Token": token
    },
    body: JSON.stringify({
      companionId: "test-id",
      venueIds: ["venue-1"]
    })
  });
  
  console.log("Status:", response.status);
  const data = await response.text();
  console.log("Response:", data);
}

testEndpoint().catch(console.error);
