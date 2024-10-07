import dotenv from "dotenv";

dotenv.config();

const { MERCIAS_QUILL_API_KEY } = process.env;

if (!MERCIAS_QUILL_API_KEY) {
  throw new Error("Missing environment variables");
}

export const env = { MERCIAS_QUILL_API_KEY }
