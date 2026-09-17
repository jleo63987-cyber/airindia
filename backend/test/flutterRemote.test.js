import test from "node:test";
import assert from "node:assert/strict";
import {
  hashDeviceToken,
  issueDeviceToken,
  newSecurityCodeDigest,
  verifySecurityCode,
} from "../src/utils/deviceToken.js";
import {
  flutterDeviceRegistrationSchema,
  flutterSignalSchema,
} from "../src/validators/schemas.js";

test("device tokens are random and hash consistently", () => {
  const first = issueDeviceToken();
  const second = issueDeviceToken();
  assert.notEqual(first, second);
  assert.ok(first.length >= 32);
  assert.equal(hashDeviceToken(first), hashDeviceToken(first));
  assert.notEqual(hashDeviceToken(first), hashDeviceToken(second));
});

test("security code digest verifies without storing plaintext", () => {
  const digest = newSecurityCodeDigest("123456");
  assert.equal(verifySecurityCode("123456", digest.salt, digest.hash), true);
  assert.equal(verifySecurityCode("654321", digest.salt, digest.hash), false);
  assert.equal(digest.hash.includes("123456"), false);
});

test("Flutter registration contract accepts the mobile payload", () => {
  const result = flutterDeviceRegistrationSchema.safeParse({
    installationId: "9e78d32b-a381-4d27-9e0c-679949ca3705",
    username: "nw2244",
    mobile: "+923001234567",
    securityCode: "123456",
    platform: "android",
    manufacturer: "Xiaomi",
    model: "Redmi 13C",
    androidSdk: 35,
    appVersion: "1.0.0",
  });
  assert.equal(result.success, true);
});

test("Flutter signaling contract accepts SDP and ICE messages", () => {
  assert.equal(flutterSignalSchema.safeParse({ type: "offer", sdp: "v=0" }).success, true);
  assert.equal(flutterSignalSchema.safeParse({
    type: "candidate",
    candidate: "candidate:1 1 UDP 1 127.0.0.1 9000 typ host",
    sdpMid: "0",
    sdpMLineIndex: 0,
  }).success, true);
  assert.equal(flutterSignalSchema.safeParse({ type: "candidate", candidate: "" }).success, false);
});
