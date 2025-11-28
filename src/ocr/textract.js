import AWS from "aws-sdk";
import fs from "fs";

const Textract = new AWS.Textract({
  region: process.env.AWS_REGION || "us-east-1",
});

export async function callTextract(filePath) {
  const imgBytes = fs.readFileSync(filePath);

  const params = {
    Document: { Bytes: imgBytes },
    FeatureTypes: ["TABLES", "FORMS"],
  };

  return Textract.analyzeDocument(params).promise();
}
