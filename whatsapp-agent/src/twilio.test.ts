import { expect, test } from "bun:test";
import { twilioSignature } from "./twilio";

test("matches Twilio's documented signature example", () => {
  const sig = twilioSignature("12345", "https://mycompany.com/myapp.php?foo=1&bar=2", {
    CallSid: "CA1234567890ABCDE",
    Caller: "+12349013030",
    Digits: "1234",
    From: "+12349013030",
    To: "+18005551212",
  });
  expect(sig).toBe("0/KCTR6DLpKmkAf8muzZqo1nDgQ=");
});
