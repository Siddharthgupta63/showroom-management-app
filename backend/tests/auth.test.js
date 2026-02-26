const request = require("supertest");
const app = require("../server");  // IMPORTANT: your server.js must export app

describe("AUTH API TESTS", () => {
  it("should login successfully", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({
        email: "admin@gmail.com",
        password: "Owner2025"
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.token).toBeDefined();
  });
});
