const request = require("supertest");
const app = require("../server"); // your express app

describe("Renewal API", () => {

  let token;
  beforeAll(async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "admin@gmail.com", password: "Owner2025" });
    token = res.body.token;
  });

  it("Should create renewal", async () => {
    const res = await request(app)
      .post("/renewal/2")
      .set("Authorization", `Bearer ${token}`)
      .send({
        renewal_type: "insurance",
        company: "ICICI",
        policy_number: "POLX1",
        premium_amount: 300,
        renewal_date: "2025-11-25"
      });

    expect(res.statusCode).toBe(201);
  });

  it("Should get renewal", async () => {
    const res = await request(app)
      .get("/renewal/2")
      .set("Authorization", `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.renewal).toBeDefined();
  });

});
