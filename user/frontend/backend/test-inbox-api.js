import fetch from "node-fetch";

async function testInboxEndpoint() {
  console.log("🧪 TESTING AGENT INBOX ENDPOINT...\n");

  try {
    // Test 1: Without agent ID (should return all waiting bookings for all agents)
    console.log("1️⃣ Test 1: Calling /api/agents/inbox without parameters");
    const res1 = await fetch("http://localhost:5000/api/agents/inbox", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    const data1 = await res1.json();
    console.log(`   Status: ${res1.status}`);
    console.log(`   Response keys: ${Object.keys(data1).join(", ")}`);

    if (data1.visibleWaiting) {
      console.log(`   ✅ Found ${data1.visibleWaiting.length} bookings`);
      if (data1.visibleWaiting.length > 0) {
        console.log(`   First booking ID: ${data1.visibleWaiting[0].booking_id}`);
      }
    } else {
      console.log(`   ❌ No visibleWaiting key in response`);
      console.log(`   Full response:`, JSON.stringify(data1, null, 2));
    }

    // Test 2: With agentId
    console.log(`\n2️⃣ Test 2: Calling /api/agents/inbox with agentId=1`);
    const res2 = await fetch("http://localhost:5000/api/agents/inbox?agentId=1", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    const data2 = await res2.json();
    console.log(`   Status: ${res2.status}`);
    if (data2.visibleWaiting) {
      console.log(`   ✅ Found ${data2.visibleWaiting.length} bookings for agent 1`);
    }

    // Test 3: With phone
    console.log(`\n3️⃣ Test 3: Calling /api/agents/inbox with phone=9004223553`);
    const res3 = await fetch("http://localhost:5000/api/agents/inbox?phone=9004223553", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    const data3 = await res3.json();
    console.log(`   Status: ${res3.status}`);
    if (data3.visibleWaiting) {
      console.log(`   ✅ Found ${data3.visibleWaiting.length} bookings for agent`);
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

testInboxEndpoint();
