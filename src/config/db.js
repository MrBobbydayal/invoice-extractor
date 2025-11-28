import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

let client;

export async function connectDB() {
  if (!client) {
    client = new MongoClient(process.env.MONGO_URI);
    await client.connect();
  }
  return client;
}
